import { describe, expect, test } from 'vitest'
import { definitions } from './definitions'
import { COMPONENT_NAMES, catalog } from './index'

/**
 * Definitions and renderers must stay the same set.
 *
 * `createCatalog` would enforce this at compile time, but it drops the `context`
 * our inputs need to write values, so the catalog is assembled by hand — and
 * this test is what replaces the guarantee we gave up. A component defined and
 * not rendered is exactly Second Brain's failure: 25 of its 53 components are
 * unreachable from the running code while staying registered and tested at both
 * ends, and nothing there could fail.
 */
describe('the catalog matches its definitions', () => {
  test('every defined component has a renderer, and vice versa', () => {
    expect(COMPONENT_NAMES.sort()).toEqual(Object.keys(definitions).sort())
  })

  test('the catalog is built under the id the client advertises', () => {
    expect(catalog).toBeTruthy()
  })

  /**
   * Every input must bind, or it cannot store an answer.
   *
   * A field whose `value` is a literal rather than a `{ path }` binding reads
   * back as undefined at submit time, long after the cause.
   */
  test('every input declares a bindable value', () => {
    for (const name of ['TextField', 'SelectField', 'CheckboxField'] as const) {
      const shape = definitions[name].props.shape as Record<string, unknown>
      expect(shape.value, `${name} must have a value`).toBeTruthy()
    }
  })

  test('every input can carry validation the binder will evaluate', () => {
    for (const name of ['TextField', 'SelectField', 'CheckboxField'] as const) {
      expect(Object.keys(definitions[name].props.shape)).toContain('checks')
    }
  })

  test('the container takes children by id, never inline', () => {
    const description = String(definitions.FormCard.props.shape.children.description)
    expect(description.toLowerCase()).toContain('inline')
  })
})
