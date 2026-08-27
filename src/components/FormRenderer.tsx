import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { Field, FormSpec } from '@/lib/form-spec'
import { emptyValueFor, rendererFor, type FormValues } from '@/lib/catalog'
import { errorsFor } from '@/lib/validate'

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

export type FormRendererProps = {
  spec: FormSpec
  /** Given the answers when the person submits a form that passes validation. */
  onSubmit: (values: FormValues) => void
}

function initialValues(fields: Field[]): FormValues {
  return Object.fromEntries(fields.map((field) => [field.name, emptyValueFor(field)]))
}

export function FormRenderer({ spec, onSubmit }: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(spec.fields))
  /**
   * Errors appear on submit, not on the first keystroke.
   *
   * Validating while someone is still typing marks a half-written email as
   * wrong before they have finished writing it, which reads as the form
   * arguing with them.
   */
  const [submitted, setSubmitted] = useState(false)

  const errors = errorsFor(spec.fields, values)
  const showing = submitted ? errors : {}

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length === 0) onSubmit(values)
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

          <Button type="submit" className="self-start">
            {spec.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
