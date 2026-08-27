import { defineTool } from '@copilotkit/runtime/v2'
import { formSpecObject, type FormSpec } from '../src/lib/form-spec'
import { CATALOG_ID, FORM_COMPONENT } from '../src/lib/a2ui-catalog'

/**
 * Our own render tool, replacing the one A2UI injects.
 *
 * The injected `render_a2ui` declares its components as
 * `items: { type: "object" }` — an object with no properties — and delivers the
 * component vocabulary separately, as prose in a context block. Under OpenAI's
 * strict tool calling a schema like that admits exactly one value, `{}`, and
 * the model duly emitted five empty objects for a five-field form (F12).
 *
 * Both reference implementations avoid that path. `a2ui-poc` has the model
 * write A2UI JSON into its message body and passes its catalog through a
 * `remove_strict_validation` modifier; the Second Brain dashboard emits state
 * snapshots and paints from those. Neither calls the injected tool.
 *
 * There is a third way, and it suits this app better than either. The
 * middleware paints a surface from two sources: the tool it injects, and ANY
 * tool whose result content parses as `{ a2ui_operations: [...] }`. So we
 * declare a tool whose parameters are the real form schema — with actual
 * properties, kinds, and constraints — and convert its result ourselves.
 *
 * Strict mode stops being an obstacle and becomes the point: the model is now
 * held to the same seven field kinds the renderer can draw.
 */

/** One A2UI operation, as the middleware expects to find it. */
type A2UIOperation = Record<string, unknown>

/**
 * A form spec, as A2UI operations.
 *
 * Two operations: create the surface against our catalog, then put one `Form`
 * component in it. The component node carries its own `component` name — that
 * discriminator is what the middleware checks for, and what a bare JSON Schema
 * generated from zod could never supply (F11).
 */
export function toA2UIOperations(spec: FormSpec, surfaceId: string): A2UIOperation[] {
  return [
    {
      version: 'v0.9',
      createSurface: { surfaceId, catalogId: CATALOG_ID },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          {
            // The root id is required by A2UI; a surface without one paints
            // nothing and says nothing about why.
            id: 'root',
            component: FORM_COMPONENT,
            ...spec,
          },
        ],
      },
    },
  ]
}

/**
 * `renderForm`, the only tool the agent gets.
 *
 * `parameters` is the same zod object the renderer switches on and the client
 * catalog is defined from, so the model is constrained by the one declaration
 * rather than by a description of it.
 */
export const renderFormTool = defineTool({
  name: 'renderForm',
  description:
    'Draw a form for the person to fill in. Call this whenever someone asks ' +
    'for a form. Include only the fields the request genuinely needs — a login ' +
    'form is an email, a password and nothing else. Do not describe the form ' +
    'in words as well; the form itself is the answer.',
  parameters: formSpecObject,
  execute: async (spec) => {
    /**
     * Returned as `a2ui_operations`, which is the middleware's second painting
     * path. The surface id is derived from the title rather than random so a
     * repeated request replaces its surface instead of stacking a new one.
     */
    const surfaceId = `form-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
    return { a2ui_operations: toA2UIOperations(spec as FormSpec, surfaceId) }
  },
})
