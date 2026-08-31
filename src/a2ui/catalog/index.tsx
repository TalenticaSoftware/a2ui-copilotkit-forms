import { createCatalog } from '@copilotkit/a2ui-renderer'
import { CATALOG_ID, FORM_COMPONENT } from '@contract/form-spec'
import { definitions } from './definitions'
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
 * `includeBasicCatalog` merges A2UI's own components — Text, Row, Column,
 * Button — alongside ours rather than replacing them, which is what CopilotKit's
 * own example and skill doc do. It costs nothing here (the agent has one
 * component that already draws a whole form) and it means an agent that wants a
 * heading beside a form is not stuck.
 */
export const catalog = createCatalog(
  definitions,
  { [FORM_COMPONENT]: FormRenderer },
  { catalogId: CATALOG_ID, includeBasicCatalog: true },
)
