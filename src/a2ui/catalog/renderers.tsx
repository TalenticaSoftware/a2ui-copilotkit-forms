import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { RendererProps } from '@copilotkit/a2ui-renderer'
import type { Field, FormSpec } from '@contract/form-spec'
import { parseFormSpec } from '@contract/form-spec'
import { emptyValueFor, rendererFor, type FieldValue, type FormValues } from './fields'

/**
 * Draws a form from a recipe.
 *
 * It knows nothing about where the recipe came from — hand-written today, an
 * agent's `render_a2ui` call later. That seam is deliberate: the renderer can be
 * exercised without a server, which is the whole reason this step comes before
 * the agent.
 *
 * Values live in `useState` for now. That will not survive the streaming
 * remounts CopilotKit does to a message being generated beside it — Portal-Lite
 * moved its form state out of React for exactly that reason. Leaving it here is
 * not an oversight: whether an A2UI surface takes the same remounts is one of
 * the questions this app exists to answer, and moving the state pre-emptively
 * would hide the answer.
 */

/**
 * Checking what a PERSON typed — a different job from `parseFormSpec`, which
 * checks what the AGENT sent.
 *
 * Kept apart on purpose. A bad recipe is refused whole, because a register form
 * quietly missing its password box is worse than no form. A person's answer is
 * refused one field at a time, in place, with their other answers untouched.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorFor(field: Field, value: FieldValue): string | null {
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
function errorsFor(fields: Field[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const problem = errorFor(field, values[field.name] ?? '')
    if (problem) errors[field.name] = problem
  }
  return errors
}

/**
 * The A2UI renderer for our `Form` component.
 *
 * Takes `RendererProps` — `props` resolved from the surface, and `dispatch` for
 * sending an action back. It is not given an `onSubmit` by the app: where a
 * completed form goes is not the browser's decision to make.
 */
type FormRendererComponentProps = RendererProps<unknown>

function initialValues(fields: Field[]): FormValues {
  return Object.fromEntries(fields.map((field) => [field.name, emptyValueFor(field)]))
}

export function FormRenderer({ props, dispatch }: FormRendererComponentProps) {
  /**
   * Checked here even though the agent was constrained by the same schema.
   *
   * The duplicate-field-name rule is a zod refinement that cannot survive
   * translation to JSON Schema, so nothing upstream has ever enforced it — and a
   * surface can reach this renderer from a path that did not validate at all.
   * This is the renderer refusing malformed input, the way it would refuse a bad
   * prop; it is not the app's business rules living in the browser.
   */
  const parsed = parseFormSpec(props)

  if (!parsed.ok) {
    return (
      <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-4">
        <p className="text-destructive text-sm font-medium">This form can't be drawn.</p>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs">
          {parsed.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    )
  }

  return <Form spec={parsed.spec} dispatch={dispatch} />
}

/**
 * The form itself, once the recipe is known good.
 *
 * Split out so the hooks below never run against an unparsed spec — a component
 * that returns early before its own useState is a Rules-of-Hooks violation, and
 * the error it produces points nowhere useful.
 */
function Form({
  spec,
  dispatch,
}: {
  spec: FormSpec
  dispatch: FormRendererComponentProps['dispatch']
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(spec.fields))
  /**
   * Errors appear on submit, not on the first keystroke.
   *
   * Validating while someone is still typing marks a half-written email as
   * wrong before they have finished writing it, which reads as the form
   * arguing with them.
   */
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState(false)

  const errors = errorsFor(spec.fields, values)
  const showing = submitted ? errors : {}

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return

    /**
     * The answers go to the AGENT, not into browser state.
     *
     * A2UI actions forward to the agent by default, which is what makes this a
     * form rather than a picture of one — and it puts the decision about what a
     * submission MEANS on the side that owns decisions. The client-side
     * validation above is an affordance: it stops an obviously bad submit
     * travelling, and it is not the control.
     */
    dispatch?.({
      name: 'form_submitted',
      context: { title: spec.title, values },
    })
    setSent(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{spec.title}</CardTitle>
        {spec.description && <CardDescription>{spec.description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {spec.fields.map((field) => {
            const id = `${spec.title}-${field.name}`
            const error = showing[field.name]
            const render = rendererFor(field.kind)

            /**
             * A kind we do not have gets a card that NAMES it.
             *
             * Not a blank space, and not a silently dropped field. This card is
             * the backlog — it says which kind to add next, and we only learn
             * that if it is visible. Second Brain drops unknown values into
             * plausible filler instead, which looks like success.
             */
            if (!render) {
              return (
                <Alert key={field.name} variant="destructive">
                  <AlertTitle>Can't draw "{field.label}" yet</AlertTitle>
                  <AlertDescription>
                    This form asks for a <code className="font-mono">{field.kind}</code> field,
                    which isn't in the catalog.
                  </AlertDescription>
                </Alert>
              )
            }

            return (
              <div key={field.name} className="flex flex-col gap-2">
                {/* A checkbox carries its own label beside the box, so repeating
                    it above would show the same words twice. */}
                {field.kind !== 'checkbox' && (
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-0.5" aria-hidden="true">
                        *
                      </span>
                    )}
                  </Label>
                )}

                {render({
                  field,
                  value: values[field.name] ?? emptyValueFor(field),
                  onChange: (next) => setValues((current) => ({ ...current, [field.name]: next })),
                  id,
                  invalid: Boolean(error),
                })}

                {error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : (
                  field.help && <p className="text-muted-foreground text-sm">{field.help}</p>
                )}
              </div>
            )
          })}

          <Button type="submit" className="self-start" disabled={sent}>
            {sent ? 'Sent' : spec.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
