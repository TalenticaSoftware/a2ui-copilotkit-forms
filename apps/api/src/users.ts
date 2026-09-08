import { z } from 'zod'
import { collection } from './crud'

/**
 * One schema, validated against and published. Add a field here and the form
 * grows one, with nothing else edited anywhere.
 */
export const createUserSchema = z.object({
  fullName: z.string().min(2).max(80).describe("The person's full name."),
  email: z.string().email().describe('Work email address. Must be unique.'),
  role: z
    .enum(['admin', 'editor', 'viewer'])
    .describe('What they may do: admin manages everything, editor writes, viewer reads.'),
  sendInvite: z
    .boolean()
    .optional()
    .describe('Email them an invitation now. Defaults to true when omitted.'),
})

export const users = collection({
  name: 'users',
  singular: 'user',
  schema: createUserSchema,

  /** Uniqueness is a fact about the other records, not something a schema can state. */
  validate: (input, others) =>
    others.some((other) => other.email === input.email)
      ? { email: 'Someone already has that email address.' }
      : null,

  /** Seeded, so the read direction works without exercising the write direction first. */
  seed: [
    { fullName: 'Ada Okonkwo', email: 'ada@example.com', role: 'admin', sendInvite: false },
    { fullName: 'Bo Lindqvist', email: 'bo@example.com', role: 'editor', sendInvite: false },
  ],
})
