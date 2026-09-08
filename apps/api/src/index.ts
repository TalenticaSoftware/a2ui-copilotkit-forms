import path from 'node:path'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'

// The one .env at the repository root — see apps/runtime/src/env.ts. The path
// is stated because `pnpm --filter` runs with this package as the cwd.
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') })
import { users } from './users'
import { projects } from './projects'
import type { Collection } from './crud'

/**
 * The backend. A separate app on a separate port: if any of the three could
 * import another's schemas, this project would prove nothing.
 *
 * Deliberately unauthenticated — there is no principal to authenticate, and a
 * login here would be theatre. See docs/verdict.md.
 */

const PORT = Number(process.env.API_PORT ?? 4200)

/** Every resource this API serves. Adding one is adding a line here. */
const COLLECTIONS: Collection[] = [users, projects]
const BY_NAME = new Map(COLLECTIONS.map((entry) => [entry.name, entry]))

/** Cross-resource rules, wired where both are in scope: a reference checked on the way in can be voided on the way out. */
users.guardDelete((user) =>
  projects.all().some((project) => project.ownerId === user.id)
    ? 'That person still owns a project. Give it a new owner first.'
    : null,
)

const app = express()

// The agent runtime and the browser both call this from other origins.
app.use(cors())
app.use(express.json())

/**
 * Every request, one line. The claim is that the agent DISCOVERS the schema, and
 * a log line mid-run is the only way to see that from outside.
 */
app.use((request, response, next) => {
  response.on('finish', () =>
    console.log(`[api] ${request.method} ${request.originalUrl} → ${response.statusCode}`),
  )
  next()
})

/** What resources exist. The agent starts here, knowing no names in advance. */
app.get('/api/schema', (_request, response) => {
  response.json({ data: { resources: COLLECTIONS.map((entry) => entry.name) } })
})

/** One resource. `no-store`: a stale descriptor builds a form that fails at the last step. */
app.get('/api/schema/:resource', (request, response) => {
  const found = BY_NAME.get(String(request.params.resource))
  if (!found) return response.status(404).json({ error: { message: 'No such resource.' } })
  response.set('Cache-Control', 'no-store')
  return response.json({ data: found.describe() })
})

for (const entry of COLLECTIONS) app.use(entry.router)

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`)
  console.log(
    `[api] resources: ${COLLECTIONS.map((entry) => entry.name).join(', ')} — described at /api/schema/:resource`,
  )
})
