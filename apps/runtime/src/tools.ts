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

/**
 * Names to ids, which is the one thing the agent cannot work out for itself.
 *
 * It reads schemas, never rows, so asked to "edit the Website refresh project"
 * it had nothing to resolve against — and rather than saying so it invented an
 * id, `"1"` or `"website-refresh"`, which the browser dutifully tried to load.
 * Sometimes it admitted defeat instead, so which behaviour you got was luck.
 * This is what a person does: look at the list, find the row, then act on it.
 *
 * Returns ONLY an id and a label, never whole records. The label is chosen
 * structurally — the first string that is not an identifier — so this file
 * still names no field of any resource, and `boundaries.test.ts` still holds.
 * A listing does not belong in a language model's context, and the browser
 * fetches everything it draws for itself.
 */
export const findRecords = defineTool({
  name: 'find_records',
  description:
    'Find records of a resource by name, and get their ids. Call this BEFORE ' +
    'editing or deleting anything the person named rather than picked from a ' +
    'list. Never invent an id: if nothing matches, say so instead of guessing.',
  parameters: z.object({
    resource: z.string().describe('A name returned by list_resources.'),
    search: z
      .string()
      .optional()
      .describe('Part of the name to look for. Omit to get everything.'),
  }),
  execute: async ({ resource, search }) => {
    const payload = await get(`/api/${encodeURIComponent(resource)}`)
    const rows = (payload as { data?: unknown })?.data
    if (!Array.isArray(rows)) return payload

    const term = search?.trim().toLowerCase()
    const matches = (row: Record<string, unknown>) =>
      !term ||
      Object.values(row).some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(term),
      )

    /** The first string that is not an identifier reads as the record's name. */
    const nameOf = (row: Record<string, unknown>) => {
      const key = Object.keys(row).find(
        (candidate) =>
          candidate !== 'id' && !/Id$/.test(candidate) && typeof row[candidate] === 'string',
      )
      return key ? String(row[key]) : String(row.id)
    }

    const found = (rows as Array<Record<string, unknown>>)
      .filter(matches)
      .slice(0, 25)
      .map((row) => ({ id: String(row.id), label: nameOf(row) }))

    return { resource, found, count: found.length }
  },
})

export const tools = [listResources, describeResource, findRecords]
