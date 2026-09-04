import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { z } from 'zod'
import { collection } from './crud'

/**
 * The routes, exercised over HTTP.
 *
 * A4 from the architecture review: the write path had no tests at all, and it
 * is the code most likely to be wrong. These drive a real express app on a real
 * port rather than calling handlers directly, because the thing being checked
 * is what a client receives — status codes and envelopes included.
 *
 * A throwaway resource rather than users or projects: this is testing `collection`
 * itself, and coupling it to a real schema would mean every field change here
 * breaks tests about routing.
 */

const widgets = collection({
  name: 'widgets',
  singular: 'widget',
  schema: z.object({
    label: z.string().min(2).describe('What it is called.'),
    size: z.enum(['small', 'large']).describe('How big.'),
  }),
  validate: (input, others) =>
    others.some((other) => other.label === input.label) ? { label: 'Already taken.' } : null,
  seed: [{ label: 'Seeded', size: 'small' }],
})

let server: Server
let origin: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(widgets.router)
  await new Promise<void>((resolve) => {
    // Port 0: let the OS pick, so a busy dev server never fails the suite.
    server = app.listen(0, () => resolve())
  })
  const address = server.address()
  origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

/** `any` on the payload deliberately: these tests assert the SHAPE, so typing it here would beg the question. */
const call = async (
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; payload: any }> => {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, payload: await response.json().catch(() => null) }
}

describe('reading', () => {
  it('lists what exists', async () => {
    const { status, payload } = await call('GET', '/api/widgets')
    expect(status).toBe(200)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({ id: 'widget_1', label: 'Seeded' })
  })

  it('reads one by id', async () => {
    const { status, payload } = await call('GET', '/api/widgets/widget_1')
    expect(status).toBe(200)
    expect(payload.data.label).toBe('Seeded')
  })

  it('404s for an id that is not there, and says which', async () => {
    const { status, payload } = await call('GET', '/api/widgets/nope')
    expect(status).toBe(404)
    expect(payload.error.message).toContain('nope')
  })
})

describe('creating', () => {
  it('stores a valid record and returns it with an id', async () => {
    const { status, payload } = await call('POST', '/api/widgets', { label: 'Made', size: 'large' })
    expect(status).toBe(201)
    expect(payload.data).toMatchObject({ id: 'widget_2', label: 'Made', size: 'large' })
  })

  /**
   * The shape the client depends on: messages keyed by the property they are
   * about, so each one can land on the input it belongs to.
   */
  it('rejects a bad field with a message keyed to that field', async () => {
    const { status, payload } = await call('POST', '/api/widgets', { label: 'x', size: 'huge' })
    expect(status).toBe(422)
    expect(Object.keys(payload.error.fields).sort()).toEqual(['label', 'size'])
  })

  it('reports a conflict the schema cannot express the same way', async () => {
    const { status, payload } = await call('POST', '/api/widgets', { label: 'Seeded', size: 'small' })
    expect(status).toBe(422)
    expect(payload.error.fields).toEqual({ label: 'Already taken.' })
  })
})

describe('updating', () => {
  it('changes only what is sent', async () => {
    const { status, payload } = await call('PATCH', '/api/widgets/widget_2', { size: 'small' })
    expect(status).toBe(200)
    // label survives, because a PATCH that dropped unsent fields would silently
    // erase everything the person did not retype.
    expect(payload.data).toMatchObject({ id: 'widget_2', label: 'Made', size: 'small' })
  })

  /**
   * The bug this prevents: editing a record without touching its unique field
   * fails, because the record conflicts with itself.
   */
  it('does not find a record in conflict with itself', async () => {
    const { status } = await call('PATCH', '/api/widgets/widget_2', { label: 'Made', size: 'large' })
    expect(status).toBe(200)
  })

  it('still refuses a conflict with a different record', async () => {
    const { status, payload } = await call('PATCH', '/api/widgets/widget_2', { label: 'Seeded' })
    expect(status).toBe(422)
    expect(payload.error.fields.label).toBe('Already taken.')
  })

  it('404s for an id that is not there', async () => {
    expect((await call('PATCH', '/api/widgets/nope', { size: 'small' })).status).toBe(404)
  })
})

describe('deleting', () => {
  it('removes the record and confirms which', async () => {
    const { status, payload } = await call('DELETE', '/api/widgets/widget_2')
    expect(status).toBe(200)
    expect(payload.data).toEqual({ id: 'widget_2' })
    expect((await call('GET', '/api/widgets/widget_2')).status).toBe(404)
  })

  it('404s twice rather than pretending the second worked', async () => {
    expect((await call('DELETE', '/api/widgets/widget_2')).status).toBe(404)
  })

  /**
   * A reference checked on the way in means nothing if it can be voided on the
   * way out. Refused rather than cascaded: removing records the person never
   * named, from a chat, with no undo, is the worse of the two.
   */
  it('refuses a delete that would strand a reference elsewhere', async () => {
    widgets.guardDelete((record) => (record.label === 'Seeded' ? 'Something depends on it.' : null))
    const { status, payload } = await call('DELETE', '/api/widgets/widget_1')
    expect(status).toBe(409)
    expect(payload.error.message).toBe('Something depends on it.')
    expect((await call('GET', '/api/widgets/widget_1')).status).toBe(200)
  })
})
