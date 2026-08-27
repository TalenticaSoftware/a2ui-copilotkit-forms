import { describe, expect, test } from 'vitest'
import { buildCatalog, CATALOG_ID, FORM_COMPONENT } from './a2ui-catalog'
import { FIELD_KINDS, parseFormSpec } from './form-spec'
import { catalog } from './catalog'
import { LOGIN, REGISTER, BOOKING } from './sample-specs'

/**
 * Does the catalog we publish still describe the app we built?
 *
 * The catalog is generated, so it cannot drift by hand — but it can drift by
 * omission, which is how the Second Brain dashboard ended up with 25 of its 53
 * components unreachable from the running code while staying registered and
 * tested at both ends. Nothing there could fail. These are the assertions that
 * would have failed.
 */

type JsonSchema = Record<string, any>

const built = buildCatalog()
const form = built.components[FORM_COMPONENT] as JsonSchema
const branches: JsonSchema[] = form.properties.fields.items.oneOf

describe('the catalog matches the app', () => {
  test('it publishes one component, under the id the server will use', () => {
    expect(built.catalogId).toBe(CATALOG_ID)
    expect(Object.keys(built.components)).toEqual([FORM_COMPONENT])
  })

  /**
   * The three-way tie, and the reason this file exists.
   *
   * What the agent may send, what we declared, and what we can actually draw
   * have to be the same set. Any two of the three agreeing is exactly the state
   * that looks healthy and ships a component nobody can reach.
   */
  test('every kind the agent may send is one the renderer can draw', () => {
    const offered = branches.map((branch) => branch.properties.kind.const).sort()
    const declared = [...FIELD_KINDS].sort()
    const drawable = Object.keys(catalog).sort()

    expect(offered).toEqual(declared)
    expect(drawable).toEqual(declared)
  })

  test('each kind carries its guidance onto the wire', () => {
    // The middleware hands the catalog to the agent as context, so a kind with
    // no description is a kind the agent has to guess the purpose of.
    for (const branch of branches) {
      expect(branch.properties.kind.description).toBeTruthy()
    }
  })
})

describe('the constraints survive translation to JSON Schema', () => {
  const select = branches.find((branch) => branch.properties.kind.const === 'select')!

  test('a select cannot exist without at least two real options', () => {
    expect(select.required).toContain('options')
    expect(select.properties.options.minItems).toBe(2)
  })

  test('`required` is mandatory on every field, with no default', () => {
    for (const branch of branches) {
      expect(branch.required).toContain('required')
      expect(branch.properties.required).not.toHaveProperty('default')
    }
  })

  test('field names keep their camelCase rule', () => {
    expect(select.properties.name.pattern).toBe('^[a-z][a-zA-Z0-9]*$')
  })

  test('a form is bounded at both ends', () => {
    expect(form.properties.fields.minItems).toBe(1)
    expect(form.properties.fields.maxItems).toBe(20)
  })

  /**
   * Stated as a fact, not discovered as a surprise.
   *
   * The duplicate-name check is a zod refinement, and JSON Schema has no way to
   * express it, so it is silently dropped in translation. That is not a bug —
   * it is the reason `parseFormSpec` runs again on arrival instead of trusting
   * that the middleware already validated. If this test ever fails, the two
   * checks have stopped being complementary and the second one may be
   * redundant.
   */
  test('the duplicate-name rule does NOT survive, which is why we re-check', () => {
    expect(JSON.stringify(form)).not.toContain('Duplicate')

    const duplicated = {
      ...LOGIN,
      fields: [...LOGIN.fields, { ...LOGIN.fields[0], label: 'Email again' }],
    }
    const result = parseFormSpec(duplicated)
    expect(result.ok).toBe(false)
  })
})

describe('the samples are what we claim they are', () => {
  /**
   * These double as the acceptance criteria for the agent. If a hand-written
   * sample stops parsing, the target moved.
   */
  test.each([
    ['login', LOGIN],
    ['register', REGISTER],
    ['booking', BOOKING],
  ])('%s parses', (_name, spec) => {
    expect(parseFormSpec(spec).ok).toBe(true)
  })

  test('the login sample stays minimal — the absence is the point', () => {
    // A model that pads a login form with a phone number and a full name has
    // answered a different question. This pins what "right" looks like.
    expect(LOGIN.fields.map((field) => field.name)).toEqual([
      'email',
      'password',
      'rememberMe',
    ])
  })
})
