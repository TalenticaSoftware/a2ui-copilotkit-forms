import type { FormValues } from './fields'

/**
 * Where a submitted A2UI form puts its answers.
 *
 * Outside React deliberately. The catalog is built once and handed to the
 * provider, so its submit handler is captured at that moment — while the
 * component that wants to DISPLAY the result lives inside a chat that
 * CopilotKit remounts as messages stream. Portal-Lite lost typed input to
 * exactly this and moved its form state out of React in response.
 *
 * A module-level store with a subscription is the smallest thing that survives
 * both: the handler writes, any component reads, and neither has to exist when
 * the other runs.
 */

export type Submission = {
  values: FormValues
  /** Rises on every submit, so two identical submissions still register. */
  seq: number
}

let current: Submission | null = null
let seq = 0
const listeners = new Set<() => void>()

export function submit(values: FormValues): void {
  seq += 1
  current = { values, seq }
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Returns the SAME object reference until something is submitted.
 *
 * `useSyncExternalStore` compares snapshots by identity and loops forever if a
 * fresh object is handed back on every read.
 */
export function getSubmission(): Submission | null {
  return current
}

export function clearSubmission(): void {
  current = null
  for (const listener of listeners) listener()
}
