import { describe, expect, it } from 'vitest'
import { createUserSchema, describeUsers } from './users'

/**
 * The descriptor must be DERIVED, never described twice.
 *
 * These read the published JSON Schema and check it against the zod schema the
 * route actually validates with. The failure they exist to catch is someone
 * hand-editing the descriptor to "fix" a form — at which point the API says one
 * thing and enforces another, and the mismatch only surfaces on a save.
 */

const body = describeUsers().operations[0]!.body as {
  properties: Record<string, { type?: string; enum?: string[]; description?: string }>
  required?: string[]
}

describe('the users descriptor', () => {
  it('publishes exactly the fields the schema accepts', () => {
    expect(Object.keys(body.properties).sort()).toEqual(Object.keys(createUserSchema.shape).sort())
  })

  it('marks as required exactly what zod requires', () => {
    const required = Object.entries(createUserSchema.shape)
      .filter(([, field]) => !field.isOptional())
      .map(([name]) => name)
      .sort()
    expect([...(body.required ?? [])].sort()).toEqual(required)
  })

  it('carries the enum values, so the agent need not invent options', () => {
    expect(body.properties.role?.enum).toEqual(['admin', 'editor', 'viewer'])
  })

  it('carries the descriptions, which are what the agent reads to write labels', () => {
    for (const field of Object.keys(createUserSchema.shape)) {
      expect(body.properties[field]?.description, `${field} has no description`).toBeTruthy()
    }
  })
})

describe('the create operation', () => {
  it('names a real route, so the client can post to it without being told', () => {
    const create = describeUsers().operations.find((operation) => operation.key === 'create')
    expect(create).toMatchObject({ method: 'POST', path: '/api/users' })
  })
})
