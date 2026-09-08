import { useEffect, useState, type ReactNode } from 'react'
import { CheckIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import { useAgentContext } from '@copilotkit/react-core/v2'
import { StaleProvider, staleClass, useStale, useSurface } from '@/a2ui/turn'
import { useAsk } from '@/a2ui/ask'
import { recallFocus, rememberFocus } from '@/a2ui/focus'

/**
 * shadcn components, drawn from A2UI nodes.
 *
 *   props      resolved by the binder — a `{ path }` binding arrives as its value
 *   context    the live surface: `dataContext.set()` writes, `componentModel` is the raw node
 *   buildChild renders a child by id, for containers
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

/** The path a component writes to. `props.value` is resolved, so read the raw node. */
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
 * Server errors, keyed by field: `/email` fails, `/_errors/email` says why.
 * The button hears the API and the input must show it; the data model is all
 * they share. Stripped from the body before posting.
 */
const ERRORS = '/_errors'

/** Where a finished save leaves its confirmation, for the card to show instead of inputs. */
const SAVED = '/_saved'

/**
 * CopilotKit's surface viewport has vertical padding only, and `overflow` clips
 * to the padding box — so a card at zero inset loses its 1px ring. 2px of margin
 * fixes it from our side, without depending on their class names.
 */
const SURFACE = 'm-0.5'

/**
 * A value from the data model, kept current. Subscribed rather than read: the
 * value arrives after submit, and a snapshot would leave the input looking fine.
 * Call unconditionally — `errorOf(props) ?? useServerError(…)` is a conditional hook.
 */
function useModelValue(context: A2UIContext, path: string | null): string | null {
  const [message, setMessage] = useState<string | null>(null)
  const subscribe = context.dataContext.subscribeDynamicValue
  useEffect(() => {
    if (!path || !subscribe) return
    const subscription = subscribe.call(context.dataContext, { path }, (next) =>
      setMessage(typeof next === 'string' && next ? next : null),
    )
    return () => subscription.unsubscribe()
  }, [context.dataContext, subscribe, path])
  return message
}

/** The server's complaint about one field. */
const useServerError = (context: A2UIContext, path: string | null) =>
  useModelValue(context, path ? `${ERRORS}${path}` : null)

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
  const id: string | undefined = props.load?.id ?? recallFocus(resource)?.id

  /**
   * Editing starts from the record. Fetched here into the data model, so the
   * inputs start at current values; `/id` goes in too, for the update route.
   */
  const [failed, setFailed] = useState<string | null>(null)
  const saved = useModelValue(context, SAVED)
  const stale = useSurface()
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
  /** A finished save is a sentence: the heading described a form that is gone. */
  if (saved) {
    return (
      <Card className={SURFACE}>
        <CardContent className={cn('py-1', staleClass(stale))}>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CheckIcon className="text-foreground size-4 shrink-0" aria-hidden="true" />
            {saved}
          </p>
        </CardContent>
      </Card>
    )
  }

  /**
   * A record that could not be read is not a form to fill in — empty inputs above
   * a Save that would overwrite everything. Muted, not red: naming a record that
   * does not exist is ordinary, and nothing broke.
   */
  if (failed) {
    return (
      <Card className={SURFACE}>
        <CardContent className="py-1">
          <p className="text-muted-foreground text-sm">{failed}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <StaleProvider stale={stale}>
      <Card className={SURFACE}>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
        <CardContent className={cn('flex flex-col gap-5', staleClass(stale))}>
          {children.map((child: any) => {
            // A2UI hands children either as ids or as { id, basePath } objects.
            const id = typeof child === 'string' ? child : child?.id
            return id ? <div key={id}>{buildChild(id)}</div> : null
          })}
        </CardContent>
      </Card>
    </StaleProvider>
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

  /**
   * Choices fetched, when the field holds another resource's id.
   *
   * The label to show comes from that resource's own descriptor —
   * `references[property].label` on the resource we belong to — so this needs no
   * idea of what a user or a project is. Failing soft: no choices is an empty
   * dropdown, which is honest, where inventing one would not be.
   */
  const from: string | undefined = props.optionsFrom?.resource
  const [fetched, setFetched] = useState<Array<{ value: string; label: string }> | null>(null)

  useEffect(() => {
    if (!from) return
    let cancelled = false
    Promise.all([read(from, 'list'), describeResource(from).catch(() => null)]).then(
      ([listed, descriptor]) => {
        if (cancelled || !listed.ok || !Array.isArray(listed.data)) return
        /**
         * Which field reads as the record's name. The referenced resource does
         * not say, so this takes the first string that is not an identifier —
         * the same rule the saved-confirmation uses, for the same reason.
         */
        const rows = listed.data as Array<Record<string, unknown>>
        const naming =
          Object.keys(rows[0] ?? {}).find(
            (key) => key !== 'id' && !/Id$/.test(key) && typeof rows[0]?.[key] === 'string',
          ) ?? 'id'
        void descriptor
        setFetched(
          rows.map((row) => ({ value: String(row.id), label: String(row[naming] ?? row.id) })),
        )
      },
    )
    return () => {
      cancelled = true
    }
  }, [from])

  const options: Array<{ value: string; label: string }> = from
    ? (fetched ?? [])
    : (props.options ?? [])

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
  const stale = useStale()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const target: { resource?: string; operation?: string } | undefined = props.submit

  /** The answers, as a request body. Our own bookkeeping keys are not the API's business. */
  const values = () => {
    const model = context.dataContext?.dataModel?.get?.('/')
    const { _errors, _saved, ...answers } = (model ?? {}) as Record<string, unknown>
    void _errors
    void _saved
    return answers
  }

  /** Put complaints where the inputs can see them, clearing the previous round first. */
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
   * The button does the write itself. A2UI's `action.functionCall` goes nowhere
   * (web_core ships no function registry), and CopilotKit mounts A2UIProvider
   * itself, so `onAction` is out of reach. Input reaches the API without passing
   * through a language model.
   */
  const save = async (resource: string, operation: string) => {
    setBusy(true)
    setNotice(null)
    const sent = values()
    const result = await submit(resource, operation, sent)
    setShown(showErrors(result, shown))
    setNotice(result.ok ? null : result.message)
    setBusy(false)

    /** Told to the card, which is what stops being a form. Named from what was sent. */
    if (result.ok) {
      const [named] = Object.entries(sent)
        // Identifiers are not names: `/id` rides along for the route, and a
        // reference stores an id while showing a label.
        .filter(([key]) => key !== 'id' && !/Id$/.test(key))
        .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        .map(([, value]) => String(value))

      context.dataContext.set(SAVED, named ? `Saved — ${named}.` : 'Saved.')
    }

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
      <Button type="button" onClick={fire} disabled={busy || stale} className="self-start">
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
 * A table of what actually exists. The agent picks the columns; the browser
 * fetches the rows — so a listing stays off the token bill, and nothing on
 * screen can be a record the model invented. A resource name, never a URL.
 */
export function TableViewRenderer({ props }: RenderArgs<any>) {
  const ask = useAsk()
  const stale = useSurface()
  const resource: string = props.resource
  const columns: Array<{ field: string; label: string }> = Array.isArray(props.columns)
    ? props.columns
    : []
  const showActions = props.actions !== false

  const [rows, setRows] = useState<Row[] | null>(null)
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({})
  const [problem, setProblem] = useState<string | null>(null)

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
  }, [resource])

  /** A reference shows its label; everything else shows itself. */
  const display = (field: string, value: unknown) => {
    const byId = labels[field]
    if (byId && typeof value === 'string') return byId[value] ?? value
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  /**
   * Both actions ASK rather than act: they say so in the conversation and let the
   * agent answer. Nothing destructive happens straight from a table row.
   */
  /**
   * What is on screen, so a name is enough to act on: an id in a sentence a
   * person reads is noise. Only ids and one label column travel, never records.
   */
  useAgentContext({
    description:
      `Records currently listed on screen for "${resource}". Use these ids when ` +
      'the person names one of them.',
    value: {
      resource,
      records: (rows ?? []).map((row) => ({
        id: String(row.id),
        label: columns[0]?.field ? display(columns[0].field, row[columns[0].field]) : String(row.id),
      })),
    },
  })

  const nameOf = (row: Row, id: string) => {
    const first = columns[0]?.field
    const label = first ? display(first, row[first]) : null
    return label && label !== '—' ? label : id
  }

  const act = (verb: string) => (row: Row, id: string) => {
    const label = nameOf(row, id)
    rememberFocus({ resource, id, label })
    ask(`${verb} ${label}`)
  }

  const edit = act('Edit')
  const remove = act('Delete')

  return (
    <Card className={SURFACE}>
      <CardHeader>
        <CardTitle>{props.title ?? resource}</CardTitle>
        {rows && (
          <CardDescription>
            {rows.length === 1 ? '1 record' : `${rows.length} records`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-3', staleClass(stale))}>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={stale}
                            onClick={() => edit(row, id)}
                          >
                            Edit
                          </Button>
                          {/*
                            No inline "Sure?" any more. Confirming a delete in a
                            table cell hides the decision in the corner of a row;
                            asked in the conversation it is a turn a person reads,
                            and one the transcript keeps.
                          */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={stale}
                            onClick={() => remove(row, id)}
                          >
                            Delete
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

/**
 * The one place a record gets removed. The agent draws it; the button does the
 * work. The agent can ask to destroy something, never do it.
 */
export function ConfirmCardRenderer({ props, context }: RenderArgs<any>) {
  const stale = useSurface()
  const ask = useAsk()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)

  const resource: string = props.resource
  const focus = recallFocus(resource)
  const id: string | undefined = props.recordId ?? focus?.id
  const label: string | undefined = props.label ?? focus?.label

  const confirm = async () => {
    setBusy(true)
    const result = await submit(resource, 'delete', { id })
    setBusy(false)
    setOutcome({
      ok: result.ok,
      message: result.ok ? `Deleted — ${label ?? id}.` : result.message,
    })
    /**
     * The agent is told either way, and a refusal matters more than a success:
     * the API declines a delete that would strand a reference, and that reason
     * is a sentence the person needs rather than a button that did nothing.
     */
    context.dispatchAction({
      event: {
        name: result.ok ? 'record_deleted' : 'delete_refused',
        context: { resource, id, ...(result.ok ? {} : { reason: result.message }) },
      },
    })
  }

  /**
   * No id, no button.
   *
   * The injected tool validates nothing (F24), so a required prop is a request
   * rather than a guarantee, and a card drawn without an id used to render a
   * Delete that could only fail — with "This needs id to know which projects
   * record to change", which is a sentence about our plumbing, not about the
   * person's problem. Better to say plainly that we do not know which record,
   * and offer nothing to press.
   */
  if (!id) {
    return (
      <Card className={SURFACE}>
        <CardContent className="py-1">
          {/*
            Muted, not red. Naming a record that is not there is ordinary — a
            typo, or an id the agent invented — and it destroyed nothing. Red is
            for something that went wrong, and the users flow gets this right by
            answering in prose; this should read the same way.
          */}
          <p className="text-muted-foreground text-sm">
            I could not tell which {resource ?? 'record'} that refers to. Ask for the list, then
            delete it from there.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (outcome) {
    return (
      <Card className={SURFACE}>
        <CardContent className="py-1">
          <p
            className={cn(
              'flex items-center gap-2 text-sm',
              outcome.ok ? 'text-muted-foreground' : 'text-destructive',
            )}
            role={outcome.ok ? undefined : 'alert'}
          >
            {outcome.ok && <CheckIcon className="size-4 shrink-0" aria-hidden="true" />}
            {outcome.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={SURFACE}>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.message}</CardDescription>
      </CardHeader>
      <CardContent className={cn('flex gap-2', staleClass(stale))}>
        <Button variant="destructive" disabled={busy || stale} onClick={confirm}>
          {busy ? 'Deleting…' : (props.confirmLabel ?? 'Delete')}
        </Button>
        {/*
          Cancel says so out loud. A card that silently vanishes leaves a
          transcript where someone asked to delete something and nothing
          answered — which reads, later, as though it went through.
        */}
        <Button variant="outline" disabled={busy || stale} onClick={() => ask('Cancel that.')}>
          Cancel
        </Button>
      </CardContent>
    </Card>
  )
}
