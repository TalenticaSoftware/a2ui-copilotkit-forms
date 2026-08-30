import { z } from 'zod'

/**
 * The menu.
 *
 * Everything the app can render, and the exact shape an answer must arrive in.
 * This file is the contract: the prompt is built from it, the model's reply is
 * parsed against it, and the renderer switches on it.
 *
 * One declaration, not three. The Second Brain dashboard next door keeps a
 * validator that disagrees with the code it claims to guard — it requires a
 * `label` prop the generator never emits, and nothing noticed because the
 * validator is called only by its own tests. A schema that also produces the
 * types cannot drift from them.
 */

/**
 * How this catalog and its one component are named on the wire.
 *
 * Both halves need these: the server stamps them onto the surface it emits, and
 * the browser registers its renderer under the same names. They live here
 * because a name only one side knows is not a contract.
 */
export const CATALOG_ID = 'prompt-to-form/v1'
export const FORM_COMPONENT = 'Form'

/**
 * Seven kinds, and adding an eighth is a deliberate decision.
 *
 * Written once, as a const array, so the model's allowed values, the TypeScript
 * union and the renderer's switch all come from the same line. Two lists would
 * be one list and a lie waiting to happen.
 */
export const FIELD_KINDS = [
  'text',
  'email',
  'password',
  'textarea',
  'number',
  'select',
  'checkbox',
] as const

export type FieldKind = (typeof FIELD_KINDS)[number]

/** How each kind reads when we explain the menu to the model. */
export const KIND_DESCRIPTIONS: Record<FieldKind, string> = {
  text: 'A short single-line answer — a name, a job title, an address line.',
  email: 'An email address. Validated as one, so never use plain text for email.',
  password: 'A secret. Rendered masked, with a show/hide toggle.',
  textarea: 'A long answer — a message, a description, notes.',
  number: 'A numeric answer — a quantity, an age, a price.',
  select: 'One choice from a short fixed list. Must come with its options.',
  checkbox: 'A single yes/no — accepting terms, opting in.',
}

/**
 * A field's key. It becomes the property the answer is stored under, so it has
 * to be a plain identifier: no spaces, no dots, nothing that would collide with
 * object plumbing. Rejecting a bad name is cheaper than sanitising one, because
 * sanitising two different names into the same key silently merges two answers.
 */
const fieldName = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Field names must be camelCase, starting with a letter.')
  .describe('camelCase key for this answer, e.g. firstName. Unique within the form.')

const optionSchema = z.object({
  value: z.string().min(1).max(100).describe('Stored value, e.g. "mon".'),
  label: z.string().min(1).max(100).describe('What the person reads, e.g. "Monday".'),
})

const fieldBase = {
  name: fieldName,
  label: z.string().min(1).max(80).describe('What the person reads above the control.'),
  /**
   * Stated, never inferred.
   *
   * Portal-Lite marked a field required because it happened to HAVE a
   * validation rule, which held only while optional fields had none. So there
   * is no default here: the model must say, and an answer that stays silent is
   * an answer we reject rather than guess at.
   */
  required: z
    .boolean()
    .describe('Must this be filled in? State it either way; there is no default.'),
  placeholder: z.string().max(100).optional().describe('Faint example text inside the control.'),
  help: z.string().max(200).optional().describe('A short note under the control.'),
}

/**
 * A field, as a discriminated union rather than one shape with optional extras.
 *
 * The whole point is that `select` cannot exist without its options. Expressed
 * as an optional `options?` on a single object, a select with none would parse
 * cleanly and render an empty dropdown — the exact failure the plan calls out.
 * As a union it is unrepresentable: no options, no parse.
 */
export const fieldSchema = z.discriminatedUnion('kind', [
  z.object({ ...fieldBase, kind: z.literal('text').describe(KIND_DESCRIPTIONS.text) }),
  z.object({ ...fieldBase, kind: z.literal('email').describe(KIND_DESCRIPTIONS.email) }),
  z.object({ ...fieldBase, kind: z.literal('password').describe(KIND_DESCRIPTIONS.password) }),
  z.object({ ...fieldBase, kind: z.literal('textarea').describe(KIND_DESCRIPTIONS.textarea) }),
  z.object({ ...fieldBase, kind: z.literal('number').describe(KIND_DESCRIPTIONS.number) }),
  z.object({ ...fieldBase, kind: z.literal('checkbox').describe(KIND_DESCRIPTIONS.checkbox) }),
  z.object({
    ...fieldBase,
    kind: z.literal('select').describe(KIND_DESCRIPTIONS.select),
    options: z
      .array(optionSchema)
      .min(2, 'A select needs at least two options.')
      .max(20)
      .describe('The choices. Real ones drawn from the request, never placeholders.'),
  }),
])

export type Field = z.infer<typeof fieldSchema>
export type SelectField = Extract<Field, { kind: 'select' }>

/**
 * A whole form.
 *
 * The upper bound on `fields` is not decoration. "I need a login form" answered
 * with thirty fields is a wrong answer, and a wrong answer that renders looks
 * enough like a right one to ship. Better to refuse it and see why.
 */
export const formSpecObject = z
  .object({
    title: z.string().min(1).max(80).describe('The form\'s heading, e.g. "Create an account".'),
    description: z.string().max(200).optional().describe('One line under the heading, if it helps.'),
    submitLabel: z
      .string()
      .min(1)
      .max(40)
      .describe('What the button says. Name the action: "Create account", not "Submit".'),
    fields: z
      .array(fieldSchema)
      .min(1, 'A form needs at least one field.')
      .max(20)
      .describe('Only the fields this form genuinely needs. Do not pad it.'),
  })

/**
 * The same form, plus the rule JSON Schema cannot express.
 *
 * Split from `formSpecObject` because both A2UI catalog APIs — the client's
 * `createCatalog` and our own `z.toJSONSchema` — need a plain ZodObject, and a
 * refinement wraps it into something neither accepts. The refined version is
 * what actually parses an arriving answer, which is why the duplicate-name rule
 * is still enforced even though it never reaches the wire.
 */
export const formSpecSchema = formSpecObject
  .superRefine((spec, ctx) => {
    /**
     * Two fields sharing a name means one silently overwrites the other's
     * answer. zod cannot express this inside the array, so it is checked here —
     * and checked at all, because the symptom is a missing value at submit
     * time, long after the cause.
     */
    const seen = new Set<string>()
    for (const [index, field] of spec.fields.entries()) {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'name'],
          message: `Duplicate field name "${field.name}".`,
        })
      }
      seen.add(field.name)
    }
  })

export type FormSpec = z.infer<typeof formSpecSchema>

/**
 * Parse an answer, and never half-parse one.
 *
 * Returns the spec or the reasons it was refused — deliberately not a spec with
 * the bad fields stripped out. A register form quietly missing its password box
 * is worse than no form, because nothing on screen says anything went wrong.
 */
export type ParseResult =
  | { ok: true; spec: FormSpec }
  | { ok: false; problems: string[] }

export function parseFormSpec(value: unknown): ParseResult {
  const result = formSpecSchema.safeParse(value)
  if (result.success) return { ok: true, spec: result.data }

  return {
    ok: false,
    problems: result.error.issues.map((issue) => {
      const where = issue.path.length ? `${issue.path.join('.')}: ` : ''
      return `${where}${issue.message}`
    }),
  }
}


/**
 * What the schema cannot carry, and the agent still needs telling.
 *
 * JSON Schema can say a select needs at least two options. It cannot say "and
 * they must be real ones, not Option 1 and Option 2" — that is a rule about
 * meaning. It lives here rather than in the prompt file because these rules
 * exist to protect the contract's guarantees, and reading them beside the
 * contract is how they stay in step with it.
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
