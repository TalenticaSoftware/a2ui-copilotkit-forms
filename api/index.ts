import express from 'express'
import cors from 'cors'
import { describeUsers, usersRouter } from './users'
import type { ResourceDescriptor } from './describe'

/**
 * The backend under test.
 *
 * A separate app on a separate port, and that separation is load-bearing rather
 * than tidy-minded. In production the API is a different repository from the
 * agent runtime and from the web client; if any of the three could `import`
 * another's schemas, this project would prove nothing. Over HTTP only. The
 * boundary test next door asserts it stays that way.
 *
 * It is deliberately small and deliberately unauthenticated. Adding a login
 * here would be theatre — there is no principal to authenticate — and pretending
 * otherwise would hide the real question, which is whether a form can be
 * derived from a schema and posted back.
 */

const PORT = Number(process.env.API_PORT ?? 4200)

const DESCRIBERS: Record<string, () => ResourceDescriptor> = {
  users: describeUsers,
}

const app = express()

// The agent runtime and the browser both call this from other origins.
app.use(cors())
app.use(express.json())

/** What resources exist. The agent starts here, knowing no names in advance. */
app.get('/api/schema', (_request, response) => {
  response.json({ data: { resources: Object.keys(DESCRIBERS) } })
})

/**
 * One resource, described.
 *
 * `no-store` because a stale descriptor renders a form for an API that has
 * moved on, and a form built from yesterday's schema fails at the last step,
 * after someone has typed everything in.
 */
app.get('/api/schema/:resource', (request, response) => {
  const describe = DESCRIBERS[String(request.params.resource)]
  if (!describe) return response.status(404).json({ error: { message: 'No such resource.' } })
  response.set('Cache-Control', 'no-store')
  return response.json({ data: describe() })
})

app.use('/api', usersRouter)

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`)
  console.log(`[api] resources: ${Object.keys(DESCRIBERS).join(', ')} — described at /api/schema/:resource`)
})
