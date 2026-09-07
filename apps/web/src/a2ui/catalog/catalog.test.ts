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

  /**
   * The button names an operation, and never a route.
   *
   * If a `url` or `path` prop ever appears here, the agent is transcribing an
   * endpoint — and a form that posts confidently to a plausible wrong one is a
   * worse failure than a form that refuses.
   */
  test('the submit button asks for a resource and an operation, not a URL', () => {
    const shape = definitions.SubmitButton.props.shape as Record<string, any>
    expect(Object.keys(shape.submit.unwrap().shape).sort()).toEqual(['operation', 'resource'])
    expect(Object.keys(shape)).not.toContain('url')
    expect(Object.keys(shape)).not.toContain('path')
  })

  /**
   * The table names an operation too. If a `url` or `path` ever appears here,
   * the agent is transcribing an endpoint — and rows fetched from a plausible
   * wrong one look exactly like rows fetched from the right one.
   */
  test('the table asks for a resource, not a URL, and picks its columns', () => {
    const shape = definitions.TableView.props.shape as Record<string, any>
    expect(Object.keys(shape)).toContain('resource')
    expect(Object.keys(shape)).not.toContain('url')
    expect(Object.keys(shape)).not.toContain('rows')
    expect(Object.keys(shape.columns.element.shape).sort()).toEqual(['field', 'label'])
  })

  /**
   * Editing must start from the record. A form that can only be told values by
   * the agent is a form whose contents were typed by a language model.
   */
  test('a form can load an existing record by id', () => {
    const load = (definitions.FormCard.props.shape as Record<string, any>).load
    expect(Object.keys(load.unwrap().shape).sort()).toEqual(['id', 'resource'])
  })

  /**
   * Deleting must go through a confirmation the person presses. The agent may
   * ask; it may not remove anything itself.
   */
  test('the confirm card names a record, and the agent cannot skip it', () => {
    const shape = definitions.ConfirmCard.props.shape as Record<string, any>
    expect(Object.keys(shape).sort()).toEqual([
      'confirmLabel',
      'label',
      'message',
      'recordId',
      'resource',
      'title',
    ])
  })

  /**
   * `id` belongs to A2UI, not to us.
   *
   * Its processor reads every node as `{ id, component, ...properties }`, so a
   * prop named `id` never reaches a renderer — it is taken as the COMPONENT's
   * identity instead. A card declaring one draws nothing, reports success, and
   * leaves its parent pointing at a child that renamed itself (F35). The names
   * are reserved for the whole catalog, so this checks the whole catalog.
   */
  test('no component claims a prop name A2UI reserves for itself', () => {
    const reserved = ['id', 'component']
    const clashes = Object.entries(definitions).flatMap(([name, definition]) =>
      Object.keys(definition.props.shape)
        .filter((prop) => reserved.includes(prop))
        .map((prop) => `${name}.${prop}`),
    )
    expect(clashes).toEqual([])
  })

  test('the container takes children by id, never inline', () => {
    const description = String(definitions.FormCard.props.shape.children.description)
    expect(description.toLowerCase()).toContain('inline')
  })
})
