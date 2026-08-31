import { createCatalog } from '@copilotkit/a2ui-renderer'
import { CATALOG_ID, FORM_COMPONENT, definitions } from './definitions'
import { FormRenderer } from './renderers'

/**
 * Definitions plus renderers, as one catalog.
 *
 * `createCatalog` type-checks the two against each other, so a renderer whose
 * props disagree with its schema does not compile. That is the shape contract
 * the Second Brain dashboard never had — its halves agree perfectly on component
 * NAMES and pass everything else as an untyped bag, and the scar is still in its
 * source: a prop commented "accepts both 'label' and 'title' from backend".
 */

/**
 * `includeBasicCatalog` is deliberately OFF, and this is the whole experiment.
 *
 * With it on — as CopilotKit's example and skill doc suggest — the agent gets
 * A2UI's own Card, TextField and Button alongside our `Form`, and it chose those
 * every time (F22). What renders looks like a form and is not one: the email box
 * is typed `text`, `required` is false on every field, there is no submit
 * button, and none of our components appear. Nothing reports the substitution,
 * because a plausible form is exactly what a wrong answer looks like here.
 *
 * Off, `Form` is the only thing the agent can name. If that brings back shadcn,
 * validation and the submit path, the lesson is that advertising a catalog is
 * not the same as being used, and exclusivity is what makes it stick. If it does
 * NOT, the finding is larger: the agent will not use a custom catalog even when
 * there is no alternative.
 */
export const catalog = createCatalog(
  definitions,
  { [FORM_COMPONENT]: FormRenderer },
  { catalogId: CATALOG_ID, includeBasicCatalog: false },
)
