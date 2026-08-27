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

const optionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
})

const fieldBase = {
  name: fieldName,
  label: z.string().min(1).max(80),
  /**
   * Stated, never inferred.
   *
   * Portal-Lite marked a field required because it happened to HAVE a
   * validation rule, which held only while optional fields had none. So there
   * is no default here: the model must say, and an answer that stays silent is
   * an answer we reject rather than guess at.
   */
  required: z.boolean(),
  placeholder: z.string().max(100).optional(),
  help: z.string().max(200).optional(),
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
  z.object({ ...fieldBase, kind: z.literal('text') }),
  z.object({ ...fieldBase, kind: z.literal('email') }),
  z.object({ ...fieldBase, kind: z.literal('password') }),
  z.object({ ...fieldBase, kind: z.literal('textarea') }),
  z.object({ ...fieldBase, kind: z.literal('number') }),
  z.object({ ...fieldBase, kind: z.literal('checkbox') }),
  z.object({
    ...fieldBase,
    kind: z.literal('select'),
    options: z.array(optionSchema).min(2, 'A select needs at least two options.').max(20),
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
export const formSpecSchema = z
  .object({
    title: z.string().min(1).max(80),
    description: z.string().max(200).optional(),
    submitLabel: z.string().min(1).max(40),
    fields: z.array(fieldSchema).min(1, 'A form needs at least one field.').max(20),
  })
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
