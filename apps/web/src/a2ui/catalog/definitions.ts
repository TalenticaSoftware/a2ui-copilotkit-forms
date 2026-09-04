import { z } from 'zod'

/**
 * What this client can draw, described for the agent.
 *
 * LEAVES, not a container. The previous version published one `Form` component
 * whose props were a whole form spec, and the agent could not use it: given
 * A2UI's own primitives alongside it, it composed those and ignored ours (F22);
 * given ours alone, it refused outright — "the catalog does not include the
 * necessary input fields (such as text fields, password inputs, or buttons)"
 * (F23).
 *
 * A2UI's injected tool composes a TREE of small components. It does not fill one
 * rich component. Every implementation that works — Second Brain's 53 cards,
 * shadify's row/column/input, A2UI's own basic catalog — exposes leaves, so
 * these are leaves.
 *
 * The shapes mirror A2UI's own basic catalog — a `TextField`, `checks`, a button
 * with an `action` — because the agent has seen that vocabulary and composes it
 * correctly. What changes is who DRAWS them: these render as shadcn. Where the
 * model's instinct and A2UI's naming disagree, the model wins (see `type`).
 */

/** How this catalog is named on the wire. */
export const CATALOG_ID = 'prompt-to-form/v1'

/**
 * Values bind to the data model rather than being literals.
 *
 * It must be a UNION whose members include `{ path }`. That is not decoration:
 * A2UI's binder decides which props are data bindings by inspecting the zod
 * schema — `_def.typeName === 'ZodUnion'` with an option shaped `{ path }` —
 * and anything else is classified STATIC and passed through unresolved. Written
 * as a bare object, `value` arrived at the renderer as the binding itself and
 * every input displayed "[object Object]" (F25).
 *
 * `{ path: "/email" }` is A2UI's binding form: the binder resolves it to the
 * current value on the way in, and the component writes back to the same path
 * on change. That shared model is what lets a submit button read fields it does
 * not own — the thing our container version had to hand-roll.
 */
const binding = z
  .union([
    z.string(),
    z.object({ path: z.string().describe('JSON pointer into the form data, e.g. "/email".') }),
  ])
  .describe('A literal, or a binding to a value in the form data.')

/**
 * Declarative validation, evaluated by A2UI's binder.
 *
 * The binder watches these and injects `isValid` and `validationErrors` into the
 * component's props. It is the answer to F16 — constraints were never dropped by
 * A2UI, the agent simply never expressed them, because nothing in the basic
 * catalog's descriptions told it to.
 */
const checks = z
  .array(
    z.object({
      condition: z.any().describe('An expression over the form data that must hold.'),
      message: z.string().describe('What to show the person when it does not.'),
    }),
  )
  .optional()
  .describe(
    'Validation rules. ALWAYS add one per required field, e.g. condition that ' +
      'the bound value is non-empty, with a message naming the field.',
  )

export const definitions = {
  /**
   * The container. Named `FormCard` rather than `Form` so it reads as "a card
   * holding fields" — a layout, not a thing that owns a domain model.
   */
  FormCard: {
    description:
      'A card that groups form fields, with a heading. Use one per form and put ' +
      'the fields and the submit button inside it.',
    props: z.object({
      title: z.string().describe('The heading, e.g. "Create an account".'),
      description: z.string().optional().describe('One line under the heading.'),
      children: z
        .array(z.string())
        .describe('Ids of the components inside, in order. Never define them inline.'),
    }),
  },

  TextField: {
    description:
      'A labelled text input. Set `type` to the narrowest that fits: text for a ' +
      'name, email for an email address, password for a secret, number for a ' +
      'quantity, textarea for a message. Bind `value` to a path in the form ' +
      'data, and always set `required`.',
    props: z.object({
      label: z.string().describe('What the person reads above the input.'),
      value: binding,
      /**
       * Named `type`, not `variant`, because that is what the model writes.
       *
       * Declared as `variant` — A2UI's own name — the agent ignored it and sent
       * `"type": "email"` anyway, so every field rendered as plain text. The
       * injected tool's schema is `items: { type: "object" }`, which validates
       * nothing, so a prop name the model does not expect is simply dropped in
       * silence. Matching its instinct costs nothing and is the difference
       * between an email input and a text box (F24).
       */
      type: z
        .enum(['text', 'email', 'password', 'number', 'textarea'])
        .describe('The input type, as in HTML. Choose the narrowest that fits.'),
      placeholder: z.string().optional().describe('Faint example text inside the input.'),
      help: z.string().optional().describe('A short note under the input.'),
      required: z
        .boolean()
        .describe('REQUIRED PROPERTY. Whether the person must fill this in. Always set it.'),
      checks,
    }),
  },

  SelectField: {
    description: 'A labelled dropdown. One choice from a short list of real options.',
    props: z.object({
      label: z.string(),
      value: binding,
      options: z
        .array(z.object({ value: z.string(), label: z.string() }))
        .describe('The choices. Real ones drawn from the request, never placeholders.'),
      required: z.boolean(),
      checks,
    }),
  },

  CheckboxField: {
    description: 'A single yes/no — accepting terms, opting in.',
    props: z.object({
      label: z.string(),
      value: binding,
      required: z.boolean(),
      checks,
    }),
  },

  SubmitButton: {
    description:
      'The button that submits the form. Name the action it performs — ' +
      '"Create account", not "Submit". Its action carries the form data back.',
    props: z.object({
      label: z.string(),
      /**
       * WHICH operation, never WHERE it lives.
       *
       * The browser looks these two names up in the descriptor it fetched
       * itself, and posts to the route the API named. Handing the agent a URL
       * prop instead would let it write a plausible wrong one — and a form that
       * posts confidently into nowhere is a worse failure than one that refuses.
       *
       * A plain object, not a union with `{ path }`: that shape is how the
       * binder detects a data binding (F25), and these are literals the agent
       * copies out of the descriptor, not values a person edits.
       */
      submit: z
        .object({
          resource: z.string().describe('The resource name, as returned by list_resources.'),
          operation: z.string().describe('The operation key from the descriptor, e.g. "create".'),
        })
        .optional()
        .describe('Which API operation this button performs. Omit for a form that saves nothing.'),
      /**
       * A UNION containing `{ event }`, because that shape is how the binder
       * recognises an action and hands the renderer a ready-to-call closure.
       * Declared as `z.any()` it stays STATIC and the button does nothing.
       */
      action: z
        .union([
          z.object({
            event: z.object({
              name: z.string().describe('What happened, e.g. "form_submitted".'),
              context: z.any().optional().describe('The values to send back.'),
            }),
          }),
          z.any(),
        ])
        .optional()
        .describe('Optional. Omit it and the whole form is submitted as-is.'),
    }),
  },
} as const
