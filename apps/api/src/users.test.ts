import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createUserSchema, users } from './users'
import { createProjectSchema, projects } from './projects'

/**
 * The descriptor must be DERIVED, never described twice.
 *
 * These read the published JSON Schema and check it against the zod schema the
 * routes actually validate with. The failure they exist to catch is someone
 * hand-editing the descriptor to "fix" a form — at which point the API says one
 * thing and enforces another, and the mismatch only surfaces on a save.
 */

type JsonSchema = {
  properties: Record<string, { type?: string; enum?: string[]; description?: string }>
  required?: string[]
}

const cases = [
  { name: 'users', collection: users, schema: createUserSchema },
  { name: 'projects', collection: projects, schema: createProjectSchema },
] as const

describe.each(cases)('the $name descriptor', ({ collection, schema }) => {
  const descriptor = collection.describe()
  const operation = (key: string) => descriptor.operations.find((entry) => entry.key === key)!
  const body = operation('create').body as JsonSchema

  it('publishes exactly the fields the schema accepts', () => {
    expect(Object.keys(body.properties).sort()).toEqual(Object.keys(schema.shape).sort())
  })

  it('marks as required exactly what zod requires', () => {
    const required = Object.entries(schema.shape)
      .filter(([, field]) => !(field as z.ZodTypeAny).isOptional())
      .map(([name]) => name)
      .sort()
    expect([...(body.required ?? [])].sort()).toEqual(required)
  })

  it('carries the descriptions, which are what the agent reads to write labels', () => {
    for (const field of Object.keys(schema.shape)) {
      expect(body.properties[field]?.description, `${field} has no description`).toBeTruthy()
    }
  })

  /**
   * All five, or the resource is not really CRUD. A missing operation is not a
   * compile error anywhere — the agent would simply never learn it exists.
   */
  it('describes the whole of CRUD', () => {
    expect(descriptor.operations.map((entry) => entry.key).sort()).toEqual([
      'create',
      'delete',
      'get',
      'list',
      'update',
    ])
  })

  /**
   * A client rendering a list has to know the shape of a row. Assuming it is
   * the same mistake as hand-copying the request shape, one direction later.
   */
  it('says what comes back, including the id it assigns', () => {
    const returns = operation('get').returns as JsonSchema
    expect(Object.keys(returns.properties).sort()).toEqual(
      [...Object.keys(schema.shape), 'id'].sort(),
    )
  })

  it('describes the id in the path of every operation that takes one', () => {
    for (const key of ['get', 'update', 'delete']) {
      const entry = operation(key)
      expect(entry.path, `${key} should address one record`).toContain(':id')
      expect((entry.params as JsonSchema).properties.id, `${key} must describe :id`).toBeTruthy()
    }
  })

  /** An update sends only what changed, so nothing may be required. */
  it('lets an update send a subset', () => {
    expect((operation('update').body as JsonSchema).required ?? []).toEqual([])
  })

  /**
   * The error envelope is part of the contract now, not an assumption in the
   * client. This is A2 from the architecture review.
   */
  it('publishes how it reports failure', () => {
    const envelope = descriptor.errors as JsonSchema
    expect(Object.keys(envelope.properties).sort()).toEqual(['fields', 'message'])
  })
})

describe('the users descriptor', () => {
  it('carries the enum values, so the agent need not invent options', () => {
    const body = users.describe().operations.find((entry) => entry.key === 'create')!.body as JsonSchema
    expect(body.properties.role?.enum).toEqual(['admin', 'editor', 'viewer'])
  })

  it('names a real route, so the client can post without being told', () => {
    const create = users.describe().operations.find((entry) => entry.key === 'create')
    expect(create).toMatchObject({ method: 'POST', path: '/api/users' })
  })
})

describe('the projects descriptor', () => {
  /**
   * The reference is the reason this resource exists. Its valid values are
   * whatever rows exist right now, which no schema can state — so the
   * descriptor has to, or the client is left guessing.
   */
  it('says ownerId points at users, and what to show instead of the id', () => {
    expect(projects.describe().references).toEqual({
      ownerId: { resource: 'users', label: 'fullName' },
    })
  })

  it('does not pretend the reference is an enum', () => {
    const body = projects.describe().operations.find((entry) => entry.key === 'create')!
      .body as JsonSchema
    expect(body.properties.ownerId?.enum).toBeUndefined()
  })
})
