import { Catalog, createReactComponent } from '@copilotkit/a2ui-renderer'
import { z } from 'zod'
import { CATALOG_ID, definitions } from './definitions'
import {
  CheckboxFieldRenderer,
  FormCardRenderer,
  SelectFieldRenderer,
  SubmitButtonRenderer,
  TableViewRenderer,
  TextFieldRenderer,
  type RenderArgs,
} from './renderers'

/**
 * Definitions plus renderers, assembled by hand.
 *
 * `createCatalog` would be the convenience wrapper for this, and we cannot use
 * it: it wraps each renderer and forwards only `{ props, children, dispatch }`,
 * dropping the `context` that carries `dataContext.set` — the only way a
 * component can write a value back. Building on `createReactComponent` directly
 * costs a few lines and keeps the capability.
 *
 * The trade is real and worth stating: `createCatalog` type-checks renderers
 * against their definitions, and this does not. The reachability test next door
 * is what replaces that guarantee — it asserts every defined component has a
 * renderer and vice versa.
 */

type Definition = { description: string; props: z.ZodObject<any> }

/**
 * One component, as A2UI wants it.
 *
 * `schema` is the zod object from `definitions`, which is what the binder reads
 * to decide which props are DYNAMIC (bind to the data model), which are ACTIONs,
 * and which are children — so the shape of the definition is what makes the
 * binding work, not anything we do here.
 */
function component(name: string, definition: Definition, render: (args: RenderArgs<any>) => any) {
  return createReactComponent(
    {
      name,
      schema: definition.props.describe(definition.description) as never,
    } as never,
    render as never,
  )
}

const renderers = {
  FormCard: FormCardRenderer,
  TextField: TextFieldRenderer,
  SelectField: SelectFieldRenderer,
  CheckboxField: CheckboxFieldRenderer,
  TableView: TableViewRenderer,
  SubmitButton: SubmitButtonRenderer,
} as const

/**
 * `includeBasicCatalog` has no equivalent here, and that is deliberate: ours are
 * the only components, so the agent cannot quietly compose A2UI's own widgets
 * instead (F22). Nothing else is offered, and — unlike the container version it
 * refused (F23) — what is offered is the leaf vocabulary it expects.
 */
export const catalog = new Catalog(
  CATALOG_ID,
  Object.entries(renderers).map(([name, render]) =>
    component(name, definitions[name as keyof typeof definitions] as never, render as never),
  ),
  [],
)

/** Exported for the test that keeps definitions and renderers in step. */
export const COMPONENT_NAMES = Object.keys(renderers)
