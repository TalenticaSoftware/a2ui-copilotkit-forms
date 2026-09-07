/**
 * Talking to the backend, from the browser.
 *
 * This is the whole of the client's knowledge about the API: one base URL. It
 * does not know a route, a method or a field — those come from the descriptor
 * the API publishes about itself, fetched below and looked up by name.
 *
 * That indirection is the point of `submit()` taking `{ resource, operation }`
 * rather than a URL. The agent chooses WHICH operation; it never writes WHERE.
 * A model that transcribed a path could transcribe a wrong one, and a form that
 * posts confidently to a plausible-looking endpoint is a worse failure than one
 * that refuses.
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

/**
 * One fetch per resource per page load.
 *
 * The descriptor is `no-store` at the server, so this is not a cache in the
 * HTTP sense — it is deduplication for a value read once per submit. A person
 * pressing a button twice should not cause two schema fetches.
 */
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
 * Fill `:name` segments from the values, and say which were used.
 *
 * The path comes from the descriptor and the values from the form, so neither
 * the agent nor this file writes a URL. A segment with nothing to fill it is
 * reported rather than left in place: posting to a literal "/api/users/:id" is
 * a 404 whose cause is three layers from where it looks.
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

/**
 * Post the answers to whichever route the API said this operation lives at.
 *
 * Both outcomes are returned rather than thrown, because both have to travel
 * back to the agent as the same kind of value — one for it to confirm, one for
 * it to explain.
 */
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
      message: `This needs ${missing.join(' and ')} to know which ${resource} record to change.`,
      fields: {},
    }
  }

  /**
   * What went in the path does not also go in the body.
   *
   * The id identifies the record; sending it as a field as well invites an API
   * to treat it as an attempted change of identity, and ours would reject it as
   * an unknown property on a strict schema.
   */
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
 * Read, by operation name.
 *
 * Same rule as `submit`: the caller names WHICH operation, and the route comes
 * from the descriptor. A table that was handed a URL could be handed a wrong
 * one; a table that names "list" either finds it or says so.
 *
 * Rows never travel through the agent. It decides that a table belongs here and
 * which columns to show; the browser fetches the contents. That keeps a listing
 * of any size off the token bill, and — more to the point — means nothing in the
 * table can be something the model made up.
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
 * Ids resolved to something readable: user_1 becomes "Ada Okonkwo".
 *
 * The descriptor says which properties are references and which field to show
 * for them, so this needs no knowledge of what a user or a project is. Failure
 * is deliberately soft — a lookup that does not answer leaves the raw id, which
 * is worse to read and still true.
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
