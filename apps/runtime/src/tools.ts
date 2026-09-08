import { z } from 'zod'
import { defineTool } from '@copilotkit/runtime/v2'

/**
 * How the agent finds out what the API accepts. Pure plumbing: fetch, hand the
 * JSON back untouched. The payload is `unknown` on purpose — a typed descriptor
 * here would mean the runtime knows the API's shape. It knows one URL.
 */

export const API_URL = process.env.API_URL ?? 'http://localhost:4200'

/** Failures returned, not thrown: a thrown tool error ends the run with nothing said. */
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
 * Names to ids — the one thing the agent cannot work out for itself, since it
 * reads schemas and never rows. Without this it invented ids.
 *
 * Returns only an id and a label, never whole records, and picks the label
 * structurally, so this file still names no field of any resource.
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
