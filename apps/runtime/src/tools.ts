import { z } from 'zod'
import { defineTool } from '@copilotkit/runtime/v2'

/**
 * How the agent finds out what the API accepts.
 *
 * Two tools, and both are pure plumbing: they fetch, they hand the JSON back
 * untouched. Nothing here parses a schema, names a field or decides what a form
 * should contain — the agent reads the descriptor itself, exactly as a person
 * reading the docs would.
 *
 * That is why this file has no types for the payload beyond `unknown`. Giving
 * the runtime a `ResourceDescriptor` interface would mean the runtime knows the
 * API's shape, which is the thing we are trying not to do. It knows one URL.
 */

export const API_URL = process.env.API_URL ?? 'http://localhost:4200'

/**
 * Failures are returned to the agent, not thrown.
 *
 * A thrown tool error ends the run, and the person sees a chat that stopped for
 * no stated reason. Handing back the problem as a value lets the agent say "the
 * API is not answering" — which is both true and actionable, the API being a
 * separate process someone probably forgot to start.
 */
async function get(path: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`)
  } catch (cause) {
    return { error: `Could not reach the API at ${API_URL}. Is it running?`, cause: String(cause) }
  }
  if (!response.ok) return { error: `The API answered ${response.status} for ${path}.` }
  return response.json()
}

export const listResources = defineTool({
  name: 'list_resources',
  description:
    'List the resources this API can create or change. Call this first when ' +
    'someone asks to add or edit something, before assuming a resource exists.',
  parameters: z.object({}),
  execute: () => get('/api/schema'),
})

export const describeResource = defineTool({
  name: 'describe_resource',
  description:
    'Describe one resource: its operations, and the JSON Schema of the body ' +
    'each accepts. Read the schema to decide what fields the form needs — the ' +
    'field names, which are required, and any enum values — and never guess a ' +
    'field the schema does not list.',
  parameters: z.object({
    resource: z.string().describe('A name returned by list_resources.'),
  }),
  execute: ({ resource }) => get(`/api/schema/${encodeURIComponent(resource)}`),
})

export const tools = [listResources, describeResource]
