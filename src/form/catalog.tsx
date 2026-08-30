import { createCatalog } from '@copilotkit/a2ui-renderer'
import type { CatalogDefinitions } from '@copilotkit/a2ui-renderer'
import {
  CATALOG_ID,
  FORM_COMPONENT,
  formSpecObject,
  parseFormSpec,
} from '@contract/form-spec'
import { FormRenderer } from './FormRenderer'
import type { FormValues } from './fields'

/**
 * The browser half of the catalog: the same component names, drawn by OUR
 * components instead of CopilotKit's built-in A2UI widgets.
 *
 * `createCatalog` takes zod definitions and React renderers and type-checks one
 * against the other, so a renderer whose props disagree with its schema does not
 * compile. That is the shape contract the Second Brain dashboard never had —
 * its two halves agree perfectly on component NAMES and pass everything else as
 * an untyped bag.
 *
 * Both halves come from `form-spec.ts`: the server's inline schema is generated
 * from it, and the definition below uses the same zod object.
 */

/**
 * Deliberately NOT built with the shipped `extractSchema` helper.
 *
 * `extractSchema(definitions)` returns the LEGACY array format — `[{ name,
 * description, props }]`. The middleware accepts it, and then quietly drops to
 * structural-only validation, because semantic validation needs the v0.9 inline
 * catalog. Nothing warns. So the server keeps generating the inline form itself
 * (see `a2ui-catalog.ts`) and this file only supplies renderers. Recorded as F5.
 *
 * ---
 *
 * The cast, and why there is one.
 *
 * `@copilotkit/a2ui-renderer` 1.68.1 peer-depends on zod ^3 and resolves its own
 * 3.25.76; this app is on zod 4. The two zods share a name and not a type, so a
 * zod-4 object is rejected as missing `_parse`, `_cached`, `UnknownKeysParam`
 * and a dozen other zod-3 internals. There is no version of this that
 * type-checks honestly — installing zod 3 as well would mean two zods and two
 * schemas, which is the drift this whole design exists to avoid.
 *
 * What makes the cast tolerable: `createCatalog` only forwards this value on as
 * a component's `schema`, and our renderer re-parses the props with the real
 * zod-4 schema before drawing anything. So the library's copy is a label, and
 * the check that matters happens on our side regardless.
 *
 * UNVERIFIED at the time of writing: whether the library reaches into the
 * schema's zod-3 internals at run time. That needs a live agent run. Recorded
 * as F6.
 *
 * `as unknown as` on the whole object rather than on the schema: the cast
 * target has to be the LIBRARY's ZodObject, and naming zod's type here imports
 * ours, which is the very type being rejected.
 */
export const catalogDefinitions = {
  [FORM_COMPONENT]: {
    description:
      'A form for a person to fill in. Choose only the fields the request ' +
      'genuinely calls for.',
    props: formSpecObject,
  },
} as unknown as CatalogDefinitions

export type FormSubmitHandler = (values: FormValues) => void

/**
 * Build the catalog, given what to do with a completed form.
 *
 * A factory rather than a constant because the submit handler belongs to the
 * app, not to the catalog — and because a catalog built at module scope would
 * capture whatever handler existed at import time, which is the frozen-value
 * trap Portal-Lite hit when it derived state inside a render callback (F29).
 */
export function buildClientCatalog(onSubmit: FormSubmitHandler) {
  return createCatalog(
    catalogDefinitions,
    {
      [FORM_COMPONENT]: ({ props }) => {
        /**
         * Checked again, here, even though the middleware already validated.
         *
         * Two reasons. The duplicate-field-name rule is a zod refinement that
         * cannot survive translation to JSON Schema, so the middleware has
         * never seen it. And a surface can reach this renderer from a path that
         * did not validate at all. An unchecked recipe rendered as if it were
         * fine is precisely the failure this app exists to avoid.
         */
        const parsed = parseFormSpec(props)

        if (!parsed.ok) {
          return (
            <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-4">
              <p className="text-destructive text-sm font-medium">
                This form can't be drawn.
              </p>
              <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs">
                {parsed.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                Nothing is rendered from a partly-valid recipe — a form quietly
                missing a field is worse than no form.
              </p>
            </div>
          )
        }

        return <FormRenderer spec={parsed.spec} onSubmit={onSubmit} />
      },
    },
    { catalogId: CATALOG_ID },
  )
}
