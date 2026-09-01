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

type Operation = { key: string; method: string; path: string; body: unknown }
type Descriptor = { resource: string; operations: Operation[] }

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

  let response: Response
  try {
    response = await fetch(`${API_URL}${target.path}`, {
      method: target.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
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
