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
import { useIsCurrentTurn, staleClass } from '@/a2ui/turn'
import { useAsk } from '@/a2ui/ask'
import { recallFocus, rememberFocus } from '@/a2ui/focus'

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
 * Where a finished save leaves its confirmation.
 *
 * The button knows the save worked; the card is what has to stop being a form.
 * They are a leaf and its container with no props between them, so the message
 * travels the only way they share — the data model — exactly as field errors
 * do. Underscored, and stripped from the body before posting.
 */
const SAVED = '/_saved'

/**
 * Two pixels, so the card's ring is not shaved off its left edge.
 *
 * CopilotKit renders every A2UI surface inside a scroll viewport — `flex-1
 * min-h-0 overflow-auto` — whose padding is `24px 0px`: vertical only. An
 * `overflow` other than visible clips to the PADDING box, so with no horizontal
 * padding the clip edge and the card's left edge are the same pixel.
 *
 * shadcn's `ring-1` is a box-shadow with 1px spread, which paints OUTSIDE the
 * border box. At zero inset that pixel is outside the clip box, and the card
 * looks sliced down its left side — at rest, with nothing scrolled and nothing
 * overflowing, which is why it reads as a layout bug rather than a scroll one.
 *
 * Fixed from our side rather than by overriding their container: a rule aimed
 * at CopilotKit's DOM would break the day they rename a class, and this cannot.
 * 2px covers the 1px ring and the 1.5px focus outline.
 */
const SURFACE = 'm-0.5'

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
   * Editing starts from the record, not from a blank form.
   *
   * Fetched here and written into the data model, so the inputs — which read
   * that model and know nothing about where it came from — start at the current
   * values. `/id` is written too: the submit button needs it to fill the `:id`
   * in the update route.
   */
  const [failed, setFailed] = useState<string | null>(null)
  const saved = useModelValue(context, SAVED)
  const stale = !useIsCurrentTurn()
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
  /**
   * A finished save is a sentence, not a card with a heading.
   *
   * "Edit User / Update details for Ada Okonkwo" describes a form, and once the
   * form is gone it describes nothing — a title over a one-line confirmation
   * reads as though there is still something to do.
   */
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

  return (
    <Card className={SURFACE}>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.description && <CardDescription>{props.description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-5', staleClass(stale))}>
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
  const stale = !useIsCurrentTurn()
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
    const { _errors, _saved, ...answers } = (model ?? {}) as Record<string, unknown>
    void _errors
    void _saved
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
    const sent = values()
    const result = await submit(resource, operation, sent)
    setShown(showErrors(result, shown))
    setNotice(result.ok ? null : result.message)
    setBusy(false)

    /**
     * Told to the card, which is what has to stop being a form.
     *
     * Named from what was sent rather than from what came back, because the
     * API decides the record's shape and this has no business knowing which
     * field is its name.
     */
    if (result.ok) {
      const [named] = Object.entries(sent)
        /**
         * Identifiers are not names. An edit carries `/id` in the data model
         * so the button can fill the `:id` in the route, and taking the first
         * string in the object found that first — "Saved — user_1." for a
         * person whose name was sitting two fields further down.
         *
         * `*Id` goes too: a reference stores an id and shows a label, so it is
         * no better a name than `id` itself.
         */
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
export function TableViewRenderer({ props }: RenderArgs<any>) {
  const ask = useAsk()
  const stale = !useIsCurrentTurn()
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
   * Both actions ASK, rather than act.
   *
   * Pressing Edit or Delete now says so in the conversation and lets the agent
   * answer — an edit form, or a confirmation card. Nothing destructive happens
   * from a table row, and nothing appears without the transcript explaining
   * where it came from.
   *
   * The record is named rather than identified: "Delete Bo Lindqvist" is what a
   * person would say, and the agent already has the id from the same row it is
   * looking at. The id goes along for the cases where two records read alike.
   */
  /**
   * What is on screen, so a NAME is enough to act on.
   *
   * The message says "Edit Ada Okonkwo" and never "(user_1)", because an id in
   * a sentence a person reads is noise. But the agent still has to know which
   * record that is, and it cannot: it reads schemas, never rows.
   *
   * So the ids of the visible rows travel as context — and only the id and the
   * one column used as a label, not the records. The trade is deliberate and
   * worth naming: this is the first row data to reach the model at all. It buys
   * something real beyond tidier text, which is that TYPING "edit Ada Okonkwo"
   * now works exactly as pressing the button does.
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
 * The one place a record gets removed.
 *
 * Drawn by the agent when someone asks to delete something, so the decision
 * lives in the conversation rather than in the corner of a table row. The
 * button still does the work from the browser — the agent has no ability to
 * destroy anything, it can only ask whether we should.
 */
export function ConfirmCardRenderer({ props, context }: RenderArgs<any>) {
  const stale = !useIsCurrentTurn()
  const ask = useAsk()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)

  const resource: string = props.resource
  const focus = recallFocus(resource)
  const id: string | undefined = props.id ?? focus?.id
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
          <p role="alert" className="text-destructive text-sm">
            I could not tell which {resource ?? 'record'} that refers to. Ask for the list again,
            then delete it from there.
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
            className={cn('flex items-center gap-2 text-sm', !outcome.ok && 'text-destructive')}
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
