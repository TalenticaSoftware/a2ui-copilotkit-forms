import { z } from 'zod'
import { collection } from './crud'
import { users } from './users'

/**
 * The projects resource, which exists to test one thing users cannot.
 *
 * `ownerId` is a REFERENCE. Every other field in this app is answerable from
 * the schema alone — a string is a string, an enum lists its own values — but
 * the valid owners are whichever users exist at the moment the form is drawn.
 * No schema can state that, which is why `references` is part of the descriptor
 * and why the client fetches the options itself rather than being handed them.
 */
export const createProjectSchema = z.object({
  name: z.string().min(2).max(80).describe('What the project is called.'),
  summary: z.string().max(200).optional().describe('One line on what it is for.'),
  status: z
    .enum(['planning', 'active', 'paused', 'done'])
    .describe('Where the project has got to.'),
  ownerId: z.string().describe('The user who owns this project. Must be an existing user id.'),
})

export const projects = collection({
  name: 'projects',
  singular: 'project',
  schema: createProjectSchema,

  references: {
    /**
     * Stored as an id, shown as a name. Both halves matter: showing the id
     * makes the form unreadable, and storing the name makes it unjoinable.
     */
    ownerId: { resource: 'users', label: 'fullName' },
  },

  /**
   * A reference to a user who does not exist is a broken record, and the schema
   * cannot catch it — `ownerId` is a well-formed string either way. Checked
   * here, against the other collection, and reported on the field so it lands
   * on the owner dropdown rather than as a banner.
   */
  validate: (input) =>
    users.has(String(input.ownerId)) ? null : { ownerId: 'That user does not exist.' },

  seed: [
    {
      name: 'Website refresh',
      summary: 'New marketing site before the launch.',
      status: 'active',
      ownerId: 'user_1',
    },
  ],
})
