import { z } from 'zod'
import { formSpecSchema } from './form-spec'

/**
 * The field vocabulary, in the shape CopilotKit's A2UI middleware wants.
 *
 * A2UI catalogs are `component name → JSON Schema`, and the middleware does two
 * things with one: it feeds the catalog to the agent as context so the agent
 * knows what it may ask for, and it validates the agent's reply against the same
 * catalog before anything is painted.
 *
 * So this file is a translation, not a second declaration. Every constraint here
 * is generated from `formSpecSchema` — which the renderer also switches on, and
 * which `parseFormSpec` also checks. One source, three consumers.
 *
 * That is the whole difference from the Second Brain dashboard, which shares
 * component NAMES across its two halves perfectly and shares nothing about their
 * shapes, then patches the resulting drift by widening the receiving end.
 */

/** Identifies this catalog to the middleware. */
export const CATALOG_ID = 'prompt-to-form/v1'

/**
 * The one component we publish, and why it is one rather than seven.
 *
 * A2UI would happily take seven components — a component per field kind, nested
 * inside a form — and that would exercise more of the protocol. It would also
 * mean each field is validated on its own, and a form is exactly the thing that
 * must be judged whole: a register form silently missing its password box is
 * worse than no form. Publishing one `Form` component means one recipe, one
 * verdict.
 *
 * Splitting it later is a real experiment worth running, and the finding it
 * produces is "does A2UI let a parent refuse because of a child".
 */
export const FORM_COMPONENT = 'Form'

/**
 * `io: 'input'` — the shape the agent must SEND.
 *
 * Zod distinguishes what a schema accepts from what it produces. They are the
 * same here, and stating it keeps that true if a default or a transform is ever
 * added: the agent would then be handed the shape it must write, not the shape
 * we end up holding.
 */
function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>
}

export type A2UIInlineCatalog = {
  catalogId: string
  components: Record<string, Record<string, unknown>>
}

/**
 * Build the catalog.
 *
 * A function rather than a constant so nothing is computed at import time — the
 * server builds it once at startup, and a build that throws should do so where
 * the stack trace names the caller.
 */
export function buildCatalog(): A2UIInlineCatalog {
  const schema = toJsonSchema(formSpecSchema)

  return {
    catalogId: CATALOG_ID,
    components: {
      [FORM_COMPONENT]: {
        ...schema,
        description:
          'A form for a person to fill in. Choose only the fields the request ' +
          'genuinely calls for — a login form is an email, a password, and ' +
          'nothing else. Every field kind you may use is listed below; there ' +
          'are no others.',
      },
    },
  }
}

/**
 * What the JSON Schema cannot carry, and the agent still needs to be told.
 *
 * JSON Schema can say a select must have at least two options. It cannot say
 * "and they must be real ones, not Option 1 and Option 2" — that is a rule about
 * meaning, and it belongs in the prompt.
 *
 * It is here rather than in the prompt file because these rules exist to protect
 * the catalog's guarantees, and reading them next to the catalog is how they stay
 * in step with it.
 */
export const CATALOG_RULES = [
  'Use only the field kinds in the catalog. If the request needs something you ' +
    'cannot express — a date, a file, a signature — say so in words instead of ' +
    'substituting a text field that pretends to be one.',
  'Never invent placeholder content. A select must carry real options drawn ' +
    'from the request; "Option 1, Option 2" is a wrong answer, not a fallback.',
  'State `required` on every field. It has no default and an omission is refused.',
  'Prefer the narrowest kind that fits: email over text for an email address, ' +
    'number over text for a quantity.',
  'Do not pad. Extra plausible fields nobody asked for are the most common way ' +
    'to get this wrong.',
] as const
