import { Router } from 'express'
import { z } from 'zod'
import { json, type ResourceDescriptor } from './describe'

/**
 * The users resource: one schema, used twice.
 *
 * `createUserSchema` is what the route validates against AND what the
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

export function describeUsers(): ResourceDescriptor {
  return {
    resource: 'users',
    operations: [
      {
        key: 'create',
        method: 'POST',
        path: '/api/users',
        summary: 'Add a person to the workspace.',
        body: json(createUserSchema),
      },
    ],
  }
}

/** Stands in for a database. Restarting the server forgets everyone. */
const users: Array<z.infer<typeof createUserSchema> & { id: string }> = []

export const usersRouter = Router()

usersRouter.post('/users', (request, response) => {
  const parsed = createUserSchema.safeParse(request.body)

  /**
   * Field-keyed errors, not a sentence.
   *
   * The client puts these back on the inputs they belong to, so the shape has
   * to be addressable. A flat "Validation failed" string would force the form
   * to show a banner and leave the person hunting for which box is wrong.
   */
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.')
      if (field && !fields[field]) fields[field] = issue.message
    }
    return response.status(422).json({ error: { message: 'Some fields need attention.', fields } })
  }

  if (users.some((user) => user.email === parsed.data.email)) {
    return response.status(422).json({
      error: {
        message: 'Some fields need attention.',
        // A conflict the schema cannot express, reported the same way as one it
        // can, so the client needs no second code path for "business" errors.
        fields: { email: 'Someone already has that email address.' },
      },
    })
  }

  const user = { id: `user_${users.length + 1}`, ...parsed.data }
  users.push(user)
  return response.status(201).json({ data: user })
})
