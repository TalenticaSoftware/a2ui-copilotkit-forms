import { useEffect, useState, type ReactNode } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { describeResource, labelsFor, read, submit, type SubmitResult } from '@/lib/api'

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
    subscribeDynamicValue?: (
      value: { path: string },
      onChange: (next: unknown) => void,
    ) => { unsubscribe: () => void }
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

/**
 * Where a rejection from the server is kept: `/email` fails, `/_errors/email`
 * says why.
 *
 * The submit button is the component that hears the API, and the input is the
 * component that has to show it — they are siblings with no props between them.
 * The data model is the only thing they share, so it carries the message, the
 * same way it carries the answers.
 *
 * Underscored because the model is also the POST body, and `submit` strips this
 * key before sending. A field literally called `_errors` would collide; nothing
 * stops that, and nothing needs to yet.
 */
const ERRORS = '/_errors'

/**
 * The server's complaint about one field, kept current.
 *
 * Subscribed rather than read, because a plain `get` is a snapshot: the value
 * arrives AFTER the person presses submit, and an input that read it at render
 * time would go on looking fine. `subscribeDynamicValue` is the same mechanism
 * the binder uses for bound values, so this re-renders for exactly the reason
 * a typed character does.
 *
 * Callers must invoke this unconditionally and choose afterwards. Written as
 * `errorOf(props) ?? useServerError(...)` it is a conditional hook, skipped
 * whenever a local check already failed.
 */
function useServerError(context: A2UIContext, path: string | null): string | null {
  const [message, setMessage] = useState<string | null>(null)
  const subscribe = context.dataContext.subscribeDynamicValue
  useEffect(() => {
    if (!path || !subscribe) return
    const subscription = subscribe.call(context.dataContext, { path: `${ERRORS}${path}` }, (next) =>
      setMessage(typeof next === 'string' && next ? next : null),
    )
    return () => subscription.unsubscribe()
  }, [context.dataContext, subscribe, path])
  return message
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

export function FormCardRenderer({ props, context, buildChild }: RenderArgs<any>) {
  const children: string[] = Array.isArray(props.children) ? props.children : []
  const resource: string | undefined = props.load?.resource
  const id: string | undefined = props.load?.id

  /**
   * Editing starts from the record, not from a blank form.
   *
   * Fetched here and written into the data model, so the inputs — which read
   * that model and know nothing about where it came from — start at the current
   * values. `/id` is written too: the submit button needs it to fill the `:id`
   * in the update route.
   */
  const [failed, setFailed] = useState<string | null>(null)
  const dataContext = context.dataContext
  useEffect(() => {
    if (!resource || !id) return
    let cancelled = false
    read(resource, 'get', { id }).then((result) => {
      if (cancelled) return
      if (!result.ok) return setFailed(result.message)
      for (const [key, value] of Object.entries((result.data ?? {}) as Record<string, unknown>)) {
        dataContext.set(`/${key}`, value)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resource, id, dataContext])
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.description && <CardDescription>{props.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {failed}
          </p>
        )}
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
  const serverError = useServerError(context, path)
  const error = errorOf(props) ?? serverError
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
  const serverError = useServerError(context, path)
  const error = errorOf(props) ?? serverError
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
  const serverError = useServerError(context, path)
  const error = errorOf(props) ?? serverError

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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const target: { resource?: string; operation?: string } | undefined = props.submit

  /**
   * The answers, as a request body.
   *
   * `/_errors` is stripped because the data model is shared: it holds what the
   * person typed AND what the server said about it last time, and only the
   * first half is the API's business.
   */
  const values = () => {
    const model = context.dataContext?.dataModel?.get?.('/')
    const { _errors, ...answers } = (model ?? {}) as Record<string, unknown>
    void _errors
    return answers
  }

  /**
   * Put the server's complaints where the inputs can see them, and clear the
   * previous round first — a message left behind from an earlier attempt reads
   * as a field that is still wrong when it is not.
   */
  const showErrors = (result: SubmitResult, previous: string[]) => {
    for (const field of previous) context.dataContext.set(`${ERRORS}/${field}`, '')
    if (result.ok) return []
    for (const [field, message] of Object.entries(result.fields)) {
      context.dataContext.set(`${ERRORS}/${field}`, message)
    }
    return Object.keys(result.fields)
  }

  const [shown, setShown] = useState<string[]>([])

  /**
   * The button does the write itself.
   *
   * A2UI's own answer to this is `action.functionCall`, which the spec says
   * runs "immediately on the renderer" — but web_core 0.10.4 ships no function
   * registry, and its dispatcher only ever emits payloads containing `event`,
   * so a functionCall action goes nowhere at all. Intercepting instead at
   * A2UIProvider's `onAction` is possible in principle and not from here:
   * CopilotKit mounts that provider itself and the prop it exposes to us is
   * `{ theme, catalog, loadingComponent, sendSchemas }`, with no `onAction`.
   *
   * So the interception happens in the one place we already own — this
   * renderer, which the binder hands both the data model and the raw node. The
   * person's input reaches the API without passing through a language model,
   * and no round trip stands between pressing the button and the record being
   * written.
   */
  const save = async (resource: string, operation: string) => {
    setBusy(true)
    setNotice(null)
    const result = await submit(resource, operation, values())
    setShown(showErrors(result, shown))
    setNotice(result.ok ? null : result.message)
    setBusy(false)

    /**
     * Told afterwards, not asked beforehand.
     *
     * The agent gets the outcome as an ordinary A2UI event so it can confirm
     * the save or explain the rejection in words — it is the narrator here, not
     * the courier.
     */
    context.dispatchAction({
      event: {
        name: result.ok ? 'save_succeeded' : 'save_failed',
        context: result.ok ? { resource, operation, saved: result.data } : { resource, operation, ...result },
      },
    })
  }

  /**
   * `props.action` arrives from the binder as a ready-to-call closure — its
   * docs call ACTION props "a ready-to-call `() => void`". A form with no
   * `submit` target keeps the old behaviour of handing everything to the agent,
   * which is what a form that saves nowhere should do.
   */
  const fire = () => {
    if (busy) return
    if (target?.resource && target.operation) return void save(target.resource, target.operation)
    if (typeof props.action === 'function') return props.action()
    const raw = context.componentModel?.properties?.action
    if (raw) return context.dispatchAction(raw)
    return context.dispatchAction({
      event: { name: 'form_submitted', context: values() },
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={fire} disabled={busy} className="self-start">
        {busy ? 'Saving…' : props.label}
      </Button>
      {notice && (
        <p role="alert" className="text-destructive text-sm">
          {notice}
        </p>
      )}
    </div>
  )
}

type Row = Record<string, unknown>

/**
 * A table of what actually exists.
 *
 * The agent decides a table belongs here and which columns to show; the browser
 * fetches the rows. That split matters twice over — a listing of any size stays
 * off the token bill, and nothing on screen can be a record the model invented,
 * which is the failure Second Brain demonstrates at length.
 *
 * `resource` and the operation name, never a URL: same rule as the submit
 * button, for the same reason.
 */
export function TableViewRenderer({ props, context }: RenderArgs<any>) {
  const resource: string = props.resource
  const columns: Array<{ field: string; label: string }> = Array.isArray(props.columns)
    ? props.columns
    : []
  const showActions = props.actions !== false

  const [rows, setRows] = useState<Row[] | null>(null)
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  /** Bumped after a delete, to re-read rather than patch the list in place. */
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([read(resource, 'list'), describeResource(resource).catch(() => null)]).then(
      async ([listed, descriptor]) => {
        if (cancelled) return
        if (!listed.ok) return setProblem(listed.message)
        // Cleared here rather than at the top of the effect: resetting state
        // synchronously inside an effect starts a second render for nothing.
        setProblem(null)
        setRows(Array.isArray(listed.data) ? (listed.data as Row[]) : [])
        if (descriptor) {
          const resolved = await labelsFor(descriptor)
          if (!cancelled) setLabels(resolved)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [resource, generation])

  /** A reference shows its label; everything else shows itself. */
  const display = (field: string, value: unknown) => {
    const byId = labels[field]
    if (byId && typeof value === 'string') return byId[value] ?? value
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  const remove = async (id: string) => {
    setBusy(id)
    const result = await submit(resource, 'delete', { id })
    setBusy(null)
    setConfirming(null)
    if (!result.ok) {
      /**
       * A refused delete is shown here AND told to the agent. The API refuses
       * one that would strand a reference — "still owns a project" — and that
       * is a sentence the person needs, not a row that quietly stayed put.
       */
      setProblem(result.message)
    } else {
      setProblem(null)
      setGeneration((n) => n + 1)
    }
    context.dispatchAction({
      event: {
        name: result.ok ? 'record_deleted' : 'delete_refused',
        context: { resource, id, ...(result.ok ? {} : { reason: result.message }) },
      },
    })
  }

  /**
   * Edit hands back to the agent rather than rendering a form itself.
   *
   * A renderer cannot invent a surface the agent did not describe, and it
   * should not want to: the agent knows the schema, so it can draw the right
   * form with `load` pointing at this row. The button says what happened and
   * lets the thing that knows how to draw, draw.
   */
  const edit = (id: string) =>
    context.dispatchAction({ event: { name: 'edit_requested', context: { resource, id } } })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title ?? resource}</CardTitle>
        {rows && (
          <CardDescription>
            {rows.length === 1 ? '1 record' : `${rows.length} records`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}

        {rows === null && !problem && <p className="text-muted-foreground text-sm">Loading…</p>}

        {rows?.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        )}

        {rows && rows.length > 0 && (
          // Wide tables scroll inside their own box rather than pushing the
          // conversation sideways.
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.field}>{column.label}</TableHead>
                  ))}
                  {showActions && <TableHead className="w-px text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const id = typeof row.id === 'string' ? row.id : String(index)
                  return (
                    <TableRow key={id}>
                      {columns.map((column) => (
                        <TableCell key={column.field}>
                          {display(column.field, row[column.field])}
                        </TableCell>
                      ))}
                      {showActions && (
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => edit(id)}>
                            Edit
                          </Button>
                          {/*
                            Two presses, not a dialog. Delete cannot be undone —
                            the records live in memory — and a button that removes
                            a row on one click, in a chat, is the wrong default.
                          */}
                          <Button
                            variant={confirming === id ? 'destructive' : 'ghost'}
                            size="sm"
                            disabled={busy === id}
                            onClick={() => (confirming === id ? remove(id) : setConfirming(id))}
                            onBlur={() => setConfirming((current) => (current === id ? null : current))}
                          >
                            {busy === id ? '…' : confirming === id ? 'Sure?' : 'Delete'}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
