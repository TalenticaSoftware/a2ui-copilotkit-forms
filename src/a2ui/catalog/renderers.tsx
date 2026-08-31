import { useState, type ReactNode } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * shadcn, drawn from A2UI component nodes.
 *
 * Each renderer receives three things from A2UI:
 *
 *   props    — resolved by the binder. A `{ path }` binding arrives as its
 *              current VALUE, and validation `checks` arrive evaluated, as
 *              `isValid` and `validationErrors`.
 *   context  — the live surface. `context.dataContext.set(path, value)` is how a
 *              component pushes user input back into the shared data model, and
 *              `context.componentModel.properties` is the RAW node, which is
 *              where the unresolved `{ path }` still lives.
 *   buildChild — renders a child by id, for containers.
 *
 * That `context` is why these use `createReactComponent` directly rather than
 * `createCatalog`: createCatalog wraps each renderer and passes on only
 * `{ props, children, dispatch }`, dropping `context` — and with it every way to
 * write a value. The capability is in the library; its convenience wrapper hides
 * it.
 */

/** What A2UI hands a renderer. Typed loosely because the library's own types are. */
type A2UIContext = {
  dataContext: {
    set: (path: string, value: unknown) => void
    dataModel?: { get?: (path: string) => unknown }
  }
  componentModel: { properties: Record<string, any> }
  dispatchAction: (action: unknown) => Promise<void> | void
}

export type RenderArgs<P> = {
  props: P
  context: A2UIContext
  buildChild: (id: string, basePath?: string) => ReactNode
}

/**
 * The path a component writes to.
 *
 * `props.value` has already been resolved to the current value, so the binding
 * itself has to come from the raw node. Returning null rather than guessing: a
 * field the agent bound to nothing is a field that cannot store an answer, and
 * silently writing to an invented path would lose the input somewhere nobody
 * looks.
 */
function pathOf(context: A2UIContext, prop = 'value'): string | null {
  const raw = context.componentModel?.properties?.[prop]
  return typeof raw?.path === 'string' ? raw.path : null
}

/** The first failing check, if the binder evaluated any. */
function errorOf(props: Record<string, any>): string | null {
  const errors = props.validationErrors
  if (Array.isArray(errors) && errors.length > 0) return String(errors[0])
  return null
}

function Field({
  label,
  required,
  help,
  error,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  help?: string
  error?: string | null
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        help && <p className="text-muted-foreground text-sm">{help}</p>
      )}
    </div>
  )
}

export function FormCardRenderer({ props, buildChild }: RenderArgs<any>) {
  const children: string[] = Array.isArray(props.children) ? props.children : []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.description && <CardDescription>{props.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {children.map((child: any) => {
          // A2UI hands children either as ids or as { id, basePath } objects.
          const id = typeof child === 'string' ? child : child?.id
          return id ? <div key={id}>{buildChild(id)}</div> : null
        })}
      </CardContent>
    </Card>
  )
}

export function TextFieldRenderer({ props, context }: RenderArgs<any>) {
  const [revealed, setRevealed] = useState(false)
  const path = pathOf(context)
  const id = `a2ui-${path ?? props.label}`
  const error = errorOf(props)
  const write = (value: string) => path && context.dataContext.set(path, value)

  if (props.type === 'textarea') {
    return (
      <Field label={props.label} required={props.required} help={props.help} error={error} htmlFor={id}>
        <Textarea
          id={id}
          rows={4}
          value={props.value ?? ''}
          placeholder={props.placeholder}
          aria-invalid={Boolean(error)}
          onChange={(event) => write(event.target.value)}
        />
      </Field>
    )
  }

  const type =
    props.type === 'email' ? 'email'
    : props.type === 'number' ? 'number'
    : props.type === 'password' ? (revealed ? 'text' : 'password')
    : 'text'

  return (
    <Field label={props.label} required={props.required} help={props.help} error={error} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={props.value ?? ''}
          placeholder={props.placeholder}
          aria-invalid={Boolean(error)}
          className={props.type === 'password' ? 'pr-10' : undefined}
          onChange={(event) => write(event.target.value)}
        />
        {props.type === 'password' && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:outline-none"
          >
            {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        )}
      </div>
    </Field>
  )
}

export function SelectFieldRenderer({ props, context }: RenderArgs<any>) {
  const path = pathOf(context)
  const id = `a2ui-${path ?? props.label}`
  const error = errorOf(props)
  const options: Array<{ value: string; label: string }> = props.options ?? []

  return (
    <Field label={props.label} required={props.required} error={error} htmlFor={id}>
      <Select
        value={props.value || null}
        onValueChange={(next) => path && context.dataContext.set(path, next ?? '')}
      >
        <SelectTrigger id={id} aria-invalid={Boolean(error)} className="w-full">
          {/* The LABEL, never the stored value — choosing Wednesday must not
              display "wed". Portal-Lite carries a formatValue hook for the same
              reason, added after a form printed a raw role id. */}
          <SelectValue placeholder="Choose one">
            {(selected) => options.find((o) => o.value === selected)?.label ?? 'Choose one'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function CheckboxFieldRenderer({ props, context }: RenderArgs<any>) {
  const path = pathOf(context)
  const id = `a2ui-${path ?? props.label}`
  const error = errorOf(props)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={props.value === true}
          onCheckedChange={(checked) => path && context.dataContext.set(path, checked)}
        />
        <Label htmlFor={id} className="font-normal">
          {props.label}
          {props.required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export function SubmitButtonRenderer({ props, context }: RenderArgs<any>) {
  /**
   * `props.action` arrives from the binder as a ready-to-call closure — its
   * docs call ACTION props "a ready-to-call `() => void`". Falling back to
   * dispatching the raw node covers the case where the agent wrote an action
   * shape the binder did not recognise, so the button is never inert.
   */
  const fire = () => {
    if (typeof props.action === 'function') return props.action()
    const raw = context.componentModel?.properties?.action
    if (raw) return context.dispatchAction(raw)

    /**
     * No action declared — submit the form anyway.
     *
     * The agent routinely omits `action`, and a submit button that does nothing
     * is the worst of the failure modes we have catalogued: it looks finished.
     * The data model already holds every answer, keyed by the paths the fields
     * bound to, so sending it whole is the obvious default rather than an
     * invention.
     */
    const values = context.dataContext?.dataModel?.get?.('/')
    return context.dispatchAction({
      action: { event: { name: 'form_submitted', context: values ?? {} } },
    })
  }

  return (
    <Button type="button" onClick={fire} className="self-start">
      {props.label}
    </Button>
  )
}
