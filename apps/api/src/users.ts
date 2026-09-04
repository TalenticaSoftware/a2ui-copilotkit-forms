import { z } from 'zod'
import { collection } from './crud'

/**
 * The users resource: one schema, used everywhere.
 *
 * `createUserSchema` is what the routes validate against AND what the
 * descriptor publishes. There is no second copy for the client to read, which
 * is the entire point — add a field here and the form grows one, with nothing
 * else edited anywhere.
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

  /**
   * Uniqueness is not something a schema can state — it is a fact about the
   * other records. Reported field-keyed so it lands on the email input, the
   * same way a malformed address does; the client needs no second code path
   * for "business" errors.
   */
  validate: (input, others) =>
    others.some((other) => other.email === input.email)
      ? { email: 'Someone already has that email address.' }
      : null,

  /**
   * Seeded, so a fresh server can be listed and a project can be owned.
   *
   * An empty collection makes the read direction untestable without first
   * exercising the write direction, which couples two demonstrations that
   * should fail independently.
   */
  seed: [
    { fullName: 'Ada Okonkwo', email: 'ada@example.com', role: 'admin', sendInvite: false },
    { fullName: 'Bo Lindqvist', email: 'bo@example.com', role: 'editor', sendInvite: false },
  ],
})
