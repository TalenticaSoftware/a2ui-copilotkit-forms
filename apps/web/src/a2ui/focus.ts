/**
 * Which record a row action was about, remembered on the way out and read back
 * on the way in — so an id never makes a round trip through the model. The
 * agent's own copy is preferred when it sends one.
 *
 * Not React state: written in a click handler, read a turn later while a
 * different component renders.
 */

type Focus = { resource: string; id: string; label: string }

let pending: Focus | null = null

export function rememberFocus(focus: Focus) {
  pending = focus
}

/** The last row acted on, if it was this resource — a stale users focus must not answer for projects. */
export function recallFocus(resource: string | undefined): Focus | null {
  if (!resource || pending?.resource !== resource) return null
  return pending
}
