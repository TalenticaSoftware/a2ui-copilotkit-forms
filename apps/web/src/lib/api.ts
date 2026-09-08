/**
 * The whole of the client's knowledge about the API: one base URL. Routes,
 * methods and fields come from the descriptor. The agent chooses WHICH
 * operation and never writes WHERE.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4200'

type Operation = {
  key: string
  method: string
  path: string
  params?: unknown
  body?: unknown
  returns?: unknown
}
type Reference = { resource: string; label: string }
export type Descriptor = {
  resource: string
  operations: Operation[]
  references?: Record<string, Reference>
}

/** Deduplication, not caching: pressing a button twice should not fetch the schema twice. */
const descriptors = new Map<string, Promise<Descriptor>>()

export function describeResource(resource: string): Promise<Descriptor> {
  const existing = descriptors.get(resource)
  if (existing) return existing
  const pending = fetch(`${API_URL}/api/schema/${encodeURIComponent(resource)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`The API does not describe "${resource}".`)
      return (await response.json()).data as Descriptor
    })
    .catch((cause) => {
      // Do not keep a rejected promise: the next attempt should retry rather
      // than replay the failure for the rest of the session.
      descriptors.delete(resource)
      throw cause
    })
  descriptors.set(resource, pending)
  return pending
}

/**
 * Fill `:name` segments from the values. An unfilled segment is reported, not
 * left in place: posting to a literal "/api/users/:id" is a 404 whose cause is
 * three layers from where it looks.
 */
function fillPath(path: string, values: Record<string, unknown>) {
  const used: string[] = []
  const missing: string[] = []
  const filled = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const value = values[name]
    if (value === undefined || value === null || value === '') {
      missing.push(name)
      return `:${name}`
    }
    used.push(name)
    return encodeURIComponent(String(value))
  })
  return { filled, used, missing }
}

export type SubmitResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string; fields: Record<string, string> }

/** Post to whichever route the API named. Both outcomes returned, not thrown — the agent narrates either. */
export async function submit(
  resource: string,
  operation: string,
  values: Record<string, unknown>,
): Promise<SubmitResult> {
  let target: Operation | undefined
  try {
    const descriptor = await describeResource(resource)
    target = descriptor.operations.find((candidate) => candidate.key === operation)
  } catch (cause) {
    return { ok: false, message: String(cause instanceof Error ? cause.message : cause), fields: {} }
  }
  if (!target) {
    return { ok: false, message: `"${resource}" has no "${operation}" operation.`, fields: {} }
  }

  const { filled, used, missing } = fillPath(target.path, values)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `I could not tell which ${resource} record that refers to — no ${missing.join(' or ')} was given.`,
      fields: {},
    }
  }

  // What went in the path does not also go in the body.
  const body: Record<string, unknown> = { ...values }
  for (const name of used) delete body[name]

  const sendsBody = target.method !== 'GET' && target.method !== 'DELETE'

  let response: Response
  try {
    response = await fetch(`${API_URL}${filled}`, {
      method: target.method,
      headers: sendsBody ? { 'content-type': 'application/json' } : undefined,
      body: sendsBody ? JSON.stringify(body) : undefined,
    })
  } catch {
    return { ok: false, message: `Could not reach the API at ${API_URL}.`, fields: {} }
  }

  const payload = await response.json().catch(() => null)
  if (response.ok) return { ok: true, data: payload?.data }
  return {
    ok: false,
    message: payload?.error?.message ?? `The API answered ${response.status}.`,
    fields: payload?.error?.fields ?? {},
  }
}

/**
 * Read, by operation name. Rows never travel through the agent: it decides a
 * table belongs and which columns to show, the browser fetches the contents.
 */
export async function read(
  resource: string,
  operation: string,
  values: Record<string, unknown> = {},
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  let target: Operation | undefined
  let descriptor: Descriptor
  try {
    descriptor = await describeResource(resource)
    target = descriptor.operations.find((candidate) => candidate.key === operation)
  } catch (cause) {
    return { ok: false, message: String(cause instanceof Error ? cause.message : cause) }
  }
  if (!target) return { ok: false, message: `"${resource}" has no "${operation}" operation.` }

  const { filled, missing } = fillPath(target.path, values)
  if (missing.length > 0) {
    return { ok: false, message: `Reading one ${resource} needs ${missing.join(' and ')}.` }
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${filled}`)
  } catch {
    return { ok: false, message: `Could not reach the API at ${API_URL}.` }
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false, message: payload?.error?.message ?? `The API answered ${response.status}.` }
  }
  return { ok: true, data: payload?.data }
}

/**
 * Ids resolved to labels, from the descriptor's `references` — so this needs no
 * idea what a user is. Soft failure: an unresolved id is worse to read, still true.
 */
export async function labelsFor(
  descriptor: Descriptor,
): Promise<Record<string, Record<string, string>>> {
  const entries = Object.entries(descriptor.references ?? {})
  const resolved: Record<string, Record<string, string>> = {}
  await Promise.all(
    entries.map(async ([property, reference]) => {
      const result = await read(reference.resource, 'list')
      if (!result.ok || !Array.isArray(result.data)) return
      const byId: Record<string, string> = {}
      for (const row of result.data as Array<Record<string, unknown>>) {
        if (typeof row.id === 'string') byId[row.id] = String(row[reference.label] ?? row.id)
      }
      resolved[property] = byId
    }),
  )
  return resolved
}
