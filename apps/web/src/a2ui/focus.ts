/**
 * Which record a row action was about.
 *
 * The browser knows this exactly: someone pressed Delete on a row, and that row
 * has an id. It then travels to the agent as a sentence — "Delete Website
 * refresh" — and comes back as a card the agent drew, which is where it goes
 * missing. The id is declared REQUIRED on ConfirmCard, but the injected A2UI
 * tool validates nothing (F24), so a required prop is a request rather than a
 * guarantee, and the agent routinely omits it.
 *
 * So the id does not make that round trip at all. It is remembered here on the
 * way out and read back on the way in, and the agent's copy is preferred when
 * it sent one. What the model is for is deciding that a confirmation belongs on
 * screen; which record it concerns is not a judgement call, and asking a
 * language model to carry an identifier faithfully is a bet this project keeps
 * losing.
 *
 * Deliberately NOT React state: it is written in a click handler and read while
 * a different component renders, one turn later. A store the size of a variable
 * is the honest shape for that.
 */

type Focus = { resource: string; id: string; label: string }

let pending: Focus | null = null

export function rememberFocus(focus: Focus) {
  pending = focus
}

/**
 * The last row acted on, if it was in this resource.
 *
 * Matching on resource matters: a stale focus from a users table must not
 * answer for a card about projects. Wrong-but-plausible is the failure mode
 * worth spending a comparison on.
 */
export function recallFocus(resource: string | undefined): Focus | null {
  if (!resource || pending?.resource !== resource) return null
  return pending
}
