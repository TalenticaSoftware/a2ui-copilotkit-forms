import { Catalog, createReactComponent } from '@copilotkit/a2ui-renderer'
import { z } from 'zod'
import { CATALOG_ID, definitions } from './definitions'
import {
  CheckboxFieldRenderer,
  ConfirmCardRenderer,
  FormCardRenderer,
  SelectFieldRenderer,
  SubmitButtonRenderer,
  TableViewRenderer,
  TextFieldRenderer,
  type RenderArgs,
} from './renderers'

/**
 * Definitions plus renderers, assembled by hand. `createCatalog` forwards only
 * `{ props, children, dispatch }` and drops the `context` carrying
 * `dataContext.set` — the only way a component can write a value back.
 *
 * The trade: createCatalog would type-check renderers against their definitions.
 */

type Definition = { description: string; props: z.ZodObject<any> }

/** One component. The binder reads `schema` to classify props, so the definition's shape is what binds. */
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
  ConfirmCard: ConfirmCardRenderer,
  SubmitButton: SubmitButtonRenderer,
} as const

/** Ours are the only components, so the agent cannot quietly compose A2UI's own instead (F22). */
export const catalog = new Catalog(
  CATALOG_ID,
  Object.entries(renderers).map(([name, render]) =>
    component(name, definitions[name as keyof typeof definitions] as never, render as never),
  ),
  [],
)

/** Exported so the two lists can be compared. */
export const COMPONENT_NAMES = Object.keys(renderers)
