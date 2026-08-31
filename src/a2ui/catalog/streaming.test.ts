import { describe, expect, test } from 'vitest'
import { extractCompleteItemsWithStatus } from '@ag-ui/a2ui-middleware'
import { parseFormSpec } from '@contract/form-spec'

/**
 * Can a half-built component reach our renderer?
 *
 * This matters because our renderer refuses a spec it cannot parse, and shows a
 * card saying so. If the middleware paints intermediate frames while the model
 * is still typing, that card appears for a form that is merely unfinished — and
 * we spent a while believing exactly that (the original F18).
 *
 * It turns out not to be true, and this file is why we can rely on it. The
 * middleware only emits `updateComponents` once `extractCompleteItemsWithStatus`
 * reports the components array CLOSED, and that function is exported, so the
 * assumption can be tested directly rather than inferred from behaviour.
 *
 * If a future version relaxes that, these tests fail and the renderer needs a
 * way to tell "still arriving" from "wrong" — which today it does not have:
 * `RendererProps` carries `props`, `children` and `dispatch`, and nothing about
 * the surface's state.
 */

/** The tool arguments, as they accumulate token by token. */
const FINAL =
  '{"surfaceId":"f","components":[{"id":"root","component":"Form","title":"Log In",' +
  '"submitLabel":"Log In","fields":[' +
  '{"name":"email","label":"Email","kind":"email","required":true},' +
  '{"name":"password","label":"Password","kind":"password","required":true}' +
  ']}]}'

/** Every prefix that ends where a streamed chunk plausibly would. */
const prefixes = (() => {
  const out: string[] = []
  for (let i = 1; i < FINAL.length; i++) {
    const c = FINAL[i - 1]!
    if (c === '}' || c === ']' || c === '"' || c === ',') out.push(FINAL.slice(0, i))
  }
  return out
})()

describe('the middleware never paints a half-built component', () => {
  test('there are enough intermediate states to be worth checking', () => {
    expect(prefixes.length).toBeGreaterThan(20)
  })

  /**
   * The one that matters. A nested `fields` array closes long before
   * `components` does, and a naive close-detector would mistake its `]` for the
   * end of the outer array — emitting a component whose fields are truncated.
   */
  test('no prefix yields a component our contract would reject', () => {
    for (const prefix of prefixes) {
      const result = extractCompleteItemsWithStatus(prefix, 'components')
      if (!result?.arrayClosed || !result.items?.length) continue

      // If it says the array is closed, every item must be whole enough to
      // render — otherwise the renderer shows a failure card for a form that is
      // merely unfinished.
      const spec = {
        title: 'Log In',
        submitLabel: 'Log In',
        fields: (result.items[0] as Record<string, unknown>).fields,
      }
      expect(parseFormSpec(spec).ok, `emitted a partial component at:\n${prefix}`).toBe(true)
    }
  })

  test('the completed arguments do parse', () => {
    const result = extractCompleteItemsWithStatus(FINAL, 'components')
    expect(result?.arrayClosed).toBe(true)
    const node = result!.items![0] as Record<string, unknown>
    expect(parseFormSpec({ title: node.title, submitLabel: node.submitLabel, fields: node.fields }).ok).toBe(true)
  })
})
