import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Field, FieldKind, SelectField } from './definitions'

/**
 * The catalog: one field kind, one component.
 *
 * This is the half of the Second Brain dashboard that actually worked — 53
 * component names, in sync on both sides, no drift. What it did not do is share
 * the SHAPE, so props travelled as an untyped bag and the scars are still in its
 * source: a prop commented "accepts both 'label' and 'title' from backend",
 * which is drift patched by widening the receiver instead of fixing the sender.
 *
 * Here the props are typed, and narrowed per kind.
 */

/** A value a person has entered. Numbers arrive from inputs as strings. */
export type FieldValue = string | boolean

export type FormValues = Record<string, FieldValue>

export type FieldRendererProps = {
  field: Field
  value: FieldValue
  onChange: (value: FieldValue) => void
  /** The id the <Label> points at, so clicking the label focuses the control. */
  id: string
  invalid: boolean
}

type FieldRenderer = (props: FieldRendererProps) => React.ReactElement

/** Shared across the text-ish kinds, which differ only by input type. */
function textLike(type: string): FieldRenderer {
  return ({ field, value, onChange, id, invalid }) => (
    <Input
      id={id}
      type={type}
      value={String(value)}
      placeholder={field.placeholder}
      aria-invalid={invalid}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function PasswordField({ field, value, onChange, id, invalid }: FieldRendererProps) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={revealed ? 'text' : 'password'}
        value={String(value)}
        placeholder={field.placeholder}
        aria-invalid={invalid}
        className="pr-10"
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        // Not a <Button>: nesting a button's own focus ring inside the input's
        // border reads as two overlapping controls.
        onClick={() => setRevealed((shown) => !shown)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:outline-none"
      >
        {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  )
}

function SelectRenderer({ field, value, onChange, id, invalid }: FieldRendererProps) {
  // Narrowed by the catalog's own keying, but stated so this component can be
  // read on its own without tracing where it was looked up from.
  const { options } = field as SelectField
  return (
    <Select
      value={String(value) || null}
      onValueChange={(next) => onChange(next === null ? '' : String(next))}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
        {/*
          The LABEL, never the value.
          Left to itself the trigger prints whatever is stored, so choosing
          Wednesday displayed "wed" — a wire value on screen, in front of a
          person. Portal-Lite carries a `formatValue` hook for the same reason,
          added after a form printed a raw role id.
        */}
        <SelectValue placeholder={field.placeholder ?? 'Choose one'}>
          {(selected) =>
            options.find((option) => option.value === selected)?.label ??
            (field.placeholder ?? 'Choose one')
          }
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
  )
}

function CheckboxRenderer({ field, value, onChange, id }: FieldRendererProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked)}
      />
      {/* The checkbox's label sits beside it, so the form's own label is hidden
          for this kind — see FormRenderer. */}
      <Label htmlFor={id} className="font-normal">
        {field.label}
      </Label>
    </div>
  )
}

/**
 * Every kind, mapped.
 *
 * Typed as `Record<FieldKind, ...>` on purpose: adding an eighth kind to
 * FIELD_KINDS makes this object a compile error until it is rendered. Second
 * Brain has 25 of its 53 components unreachable from the running code while
 * staying registered and tested at both ends — nothing there could fail.
 */
export const catalog: Record<FieldKind, FieldRenderer> = {
  text: textLike('text'),
  email: textLike('email'),
  number: textLike('number'),
  password: PasswordField,
  textarea: ({ field, value, onChange, id, invalid }) => (
    <Textarea
      id={id}
      rows={4}
      value={String(value)}
      placeholder={field.placeholder}
      aria-invalid={invalid}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  select: SelectRenderer,
  checkbox: CheckboxRenderer,
}

/**
 * Look up a renderer by a kind we are not yet sure of.
 *
 * `parseFormSpec` should have made this impossible, and it still returns
 * `undefined` rather than throwing: a recipe can reach the renderer from
 * somewhere that did not parse it, and the honest answer then is a card naming
 * the kind we do not have — not a blank space, and not a crash.
 */
export function rendererFor(kind: string): FieldRenderer | undefined {
  return catalog[kind as FieldKind]
}

/** The value a field starts at, by kind. */
export function emptyValueFor(field: Field): FieldValue {
  return field.kind === 'checkbox' ? false : ''
}
