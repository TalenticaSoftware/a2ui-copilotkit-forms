import { z } from 'zod'
import { collection } from './crud'
import { users } from './users'

/**
 * Projects exist to test what users cannot: `ownerId` is a REFERENCE, and its
 * valid values are whichever users exist when the form is drawn. No schema can
 * state that, so `references` is part of the descriptor.
 */
export const createProjectSchema = z.object({
  name: z.string().min(2).max(80).describe('What the project is called.'),
  summary: z.string().max(200).optional().describe('One line on what it is for.'),
  status: z
    .enum(['planning', 'active', 'paused', 'done'])
    .describe('Where the project has got to.'),
  /** Described as a person, not an id: the label on screen is written from this sentence. */
  ownerId: z.string().describe('Who owns this project.'),
})

export const projects = collection({
  name: 'projects',
  singular: 'project',
  schema: createProjectSchema,

  references: {
    // Stored as an id, shown as a name.
    ownerId: { resource: 'users', label: 'fullName' },
  },

  /** A well-formed string can still name a user who does not exist. */
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
