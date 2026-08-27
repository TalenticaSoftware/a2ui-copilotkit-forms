import type { Field } from './form-spec'
import type { FieldValue, FormValues } from './catalog'

/**
 * Checking what a PERSON typed — a different job from checking what the agent
 * sent, which `parseFormSpec` does.
 *
 * Keeping them apart matters. The agent's recipe is refused whole: a bad field
 * means no form. A person's answer is refused one field at a time, in place,
 * with their other answers left alone.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function errorFor(field: Field, value: FieldValue): string | null {
  if (field.kind === 'checkbox') {
    /**
     * The only way a checkbox fails: required, and unticked.
     *
     * The message deliberately does not repeat the label. A checkbox's label
     * sits inches away, so "<label> is required" reads as "I accept the terms
     * is required" — a sentence with the subject said twice and no verb where
     * one is expected.
     */
    return field.required && value !== true ? 'This needs to be ticked.' : null
  }

  const text = String(value).trim()

  if (!text) return field.required ? `${field.label} is required.` : null

  if (field.kind === 'email' && !EMAIL.test(text)) {
    return 'Enter a valid email address.'
  }

  if (field.kind === 'number' && Number.isNaN(Number(text))) {
    return `${field.label} must be a number.`
  }

  if (field.kind === 'select') {
    /**
     * A value not on the list.
     *
     * Unreachable through the dropdown, and checked anyway: values also arrive
     * as a prefill, and a select silently holding something it never offered is
     * the kind of thing that surfaces as a rejected submit with no explanation.
     */
    const allowed = field.options.some((option) => option.value === text)
    if (!allowed) return `Choose one of the listed options.`
  }

  return null
}

/** Every error on the form, keyed by field name. Empty means it can be sent. */
export function errorsFor(fields: Field[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const problem = errorFor(field, values[field.name] ?? '')
    if (problem) errors[field.name] = problem
  }
  return errors
}
