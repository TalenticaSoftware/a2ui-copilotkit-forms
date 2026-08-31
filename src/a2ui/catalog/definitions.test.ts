import { describe, expect, test } from 'vitest'
import { FIELD_KINDS, KIND_DESCRIPTIONS, parseFormSpec, type FormSpec } from './definitions'
import { fieldRenderers } from '@/components/form-fields'

/**
 * Does our renderer honour the contract?
 *
 * It lives on the browser side, not beside the contract, because it imports
 * both — and only this side is allowed to. The server may read the contract and
 * nothing else.
 *
 * These assertions exist because of the Second Brain dashboard, which has 25 of
 * its 53 components unreachable from the running code while staying registered
 * and tested at both ends. Nothing there could fail. This is what would have
 * failed.
 */

const LOGIN: FormSpec = {
  title: 'Log in',
  submitLabel: 'Log in',
  fields: [
    { name: 'email', label: 'Email', kind: 'email', required: true },
    { name: 'password', label: 'Password', kind: 'password', required: true },
  ],
}

describe('every declared kind can be drawn', () => {
  /**
   * The tie that matters: what the agent may send, and what the browser can
   * draw. `Record<FieldKind, …>` already makes a missing renderer a compile
   * error; this catches the reverse — a renderer for a kind nobody declared.
   */
  test('the renderer covers FIELD_KINDS exactly', () => {
    expect(Object.keys(fieldRenderers).sort()).toEqual([...FIELD_KINDS].sort())
  })

  test('every kind is described for the agent', () => {
    // The descriptions ride the tool schema, so a kind without one is a kind the
    // agent has to guess the purpose of.
    for (const kind of FIELD_KINDS) {
      expect(KIND_DESCRIPTIONS[kind]).toBeTruthy()
    }
  })
})

describe('an answer is accepted whole or refused whole', () => {
  test('a good spec parses', () => {
    expect(parseFormSpec(LOGIN).ok).toBe(true)
  })

  test.each([
    [
      'a select with no options',
      { fields: [{ name: 'plan', label: 'Plan', kind: 'select', required: true, options: [] }] },
    ],
    ['a field that omits required', { fields: [{ name: 'email', label: 'Email', kind: 'email' }] }],
    [
      'a kind we cannot draw',
      { fields: [{ name: 'when', label: 'When', kind: 'datepicker', required: true }] },
    ],
    ['no fields at all', { fields: [] }],
  ])('refuses %s', (_name, patch) => {
    expect(parseFormSpec({ ...LOGIN, ...patch }).ok).toBe(false)
  })

  test('refuses two fields sharing a name', () => {
    // One would silently overwrite the other's answer, and the symptom is a
    // missing value at submit time — long after the cause.
    const duplicated = { ...LOGIN, fields: [...LOGIN.fields, { ...LOGIN.fields[0]! }] }
    expect(parseFormSpec(duplicated).ok).toBe(false)
  })

  test('a refusal explains itself rather than half-parsing', () => {
    const result = parseFormSpec({ ...LOGIN, fields: [{ name: 'x', label: 'X', kind: 'text' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems.join(' ')).toContain('required')
  })
})
