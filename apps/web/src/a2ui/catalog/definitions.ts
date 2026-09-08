import { z } from 'zod'

/**
 * What this client can draw, described for the agent.
 *
 * LEAVES, not one rich container. A2UI's injected tool composes a TREE of small
 * components; given a container it either ignored ours or refused outright
 * (F22, F23). The shapes mirror A2UI's own basic catalog because the agent has
 * seen that vocabulary — what changes is that these render as shadcn.
 */

/** How this catalog is named on the wire. */
export const CATALOG_ID = 'a2ui-copilotkit-forms/v1'

/**
 * Values bind to the data model. It MUST be a union including `{ path }`: A2UI's
 * binder detects bindings by reading `_def.typeName === 'ZodUnion'` for an option
 * shaped `{ path }`. Anything else is STATIC, and every input renders
 * "[object Object]" with no error (F25).
 */
const binding = z
  .union([
    z.string(),
    z.object({ path: z.string().describe('JSON pointer into the form data, e.g. "/email".') }),
  ])
  .describe('A literal, or a binding to a value in the form data.')

/** Validation the binder evaluates, injecting `isValid` and `validationErrors` into props. */
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
  /** Named `FormCard`, not `Form`: a layout holding fields, not a thing owning a domain model. */
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
      /**
       * Editing without the record passing through the agent: the card fetches it
       * and seeds the data model itself.
       */
      load: z
        .object({
          resource: z.string().describe('The resource name, e.g. "users".'),
          id: z.string().describe('Which record to load into the form.'),
        })
        .optional()
        .describe('Fill the form from an existing record. Omit when creating.'),
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
       * `type`, not `variant`: declared as A2UI's own name the agent sent `type`
       * anyway and every field rendered as plain text. The injected tool's schema
       * validates nothing, so an unexpected prop name is dropped in silence (F24).
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
    description:
      'A labelled dropdown. Give it `options` for a fixed list — an enum from ' +
      'the schema — or `optionsFrom` when the field holds another resource\'s ' +
      'id, and the browser will fetch the real choices itself.',
    props: z.object({
      label: z
        .string()
        .describe('What the person reads. Write it for a person: "Owner", never "Owner Id".'),
      value: binding,
      options: z
        .array(z.object({ value: z.string(), label: z.string() }))
        .optional()
        .describe('A fixed list, e.g. the values of an enum. Real ones, never placeholders.'),
      /**
       * A reference's choices are whichever records exist right now. Naming the
       * resource lets the browser fetch them, rather than the agent writing out a
       * listing that is stale by the time it is read.
       */
      optionsFrom: z
        .object({
          resource: z.string().describe('The resource whose records are the choices, e.g. "users".'),
        })
        .optional()
        .describe('Fill the choices from a resource. Use this for any property holding another record\'s id.'),
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

  TableView: {
    description:
      'A table of existing records. Use this whenever someone asks to SEE, ' +
      'list, show or find things. Name the resource and the columns worth ' +
      'showing — you know the fields from the descriptor — and the browser ' +
      'fetches the rows itself. Never type the rows out yourself.',
    props: z.object({
      title: z.string().describe('A heading, e.g. "Users".'),
      resource: z.string().describe('The resource name, as returned by list_resources.'),
      /** Chosen by the agent from the descriptor's `returns` — a table showing every field is unreadable. */
      columns: z
        .array(
          z.object({
            field: z.string().describe('The property name, as in the schema.'),
            label: z.string().describe('The column heading, written for a person.'),
          }),
        )
        .describe('The columns to show, in order. Pick the useful ones, not all of them.'),
      actions: z
        .boolean()
        .optional()
        .describe('Show Edit and Delete on each row. Default true; set false for a plain listing.'),
    }),
  },

  ConfirmCard: {
    description:
      'Ask the person to confirm something destructive, then do it. Use this ' +
      'when someone asks to DELETE or remove a record: name what will go, and ' +
      'give the resource and the id. Never delete without drawing this first.',
    props: z.object({
      title: z.string().describe('e.g. "Delete this user?"'),
      message: z
        .string()
        .describe('What will happen, naming the record. Say if it cannot be undone.'),
      resource: z.string().describe('The resource name, as returned by list_resources.'),
      /**
       * NOT `id`: A2UI destructures every node as `{ id, component, ...properties }`,
       * so a prop called `id` is eaten before a renderer sees it — a dangling tree
       * that draws nothing and still answers "rendered" (F35).
       */
      recordId: z
        .string()
        .describe(
          'REQUIRED. The id of the record to remove — NOT the component id. ' +
            'You have it from the list on screen; never draw this card without one.',
        ),
      label: z
        .string()
        .describe('The record\'s name, for the confirmation afterwards, e.g. "Website refresh".'),
      confirmLabel: z
        .string()
        .optional()
        .describe('The destructive button, e.g. "Delete user". Defaults to "Delete".'),
    }),
  },

  SubmitButton: {
    description:
      'The button that submits the form. Name the action it performs — ' +
      '"Create account", not "Submit". Its action carries the form data back.',
    props: z.object({
      label: z.string(),
      /**
       * WHICH operation, never WHERE it lives — a model can transcribe a plausible
       * wrong URL, and a form posting confidently into nowhere is the worse failure.
       */
      submit: z
        .object({
          resource: z.string().describe('The resource name, as returned by list_resources.'),
          operation: z.string().describe('The operation key from the descriptor, e.g. "create".'),
        })
        .optional()
        .describe('Which API operation this button performs. Omit for a form that saves nothing.'),
      /** A union containing `{ event }` — the shape the binder recognises as an action. */
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
