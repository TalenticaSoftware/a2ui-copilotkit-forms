import type { CatalogDefinitions } from '@copilotkit/a2ui-renderer'
import { FORM_COMPONENT, formSpecObject } from '@contract/form-spec'

/**
 * What components this client can draw, described for the agent.
 *
 * Platform-agnostic on purpose — zod schemas and prose, no React. The renderers
 * live next door in `renderers.tsx`, and `index.tsx` ties the two together.
 * That split is CopilotKit's own convention (see their `a2ui-pdf-analyst`
 * example, which uses these exact three filenames), and it is a real boundary
 * rather than a filing habit: the definitions are what the AGENT reads, the
 * renderers are what the BROWSER runs.
 *
 * The schema is `formSpecObject` — the same declaration the server's tool takes
 * as its parameters. One description of a form, read by both ends.
 */

/**
 * The cast, and why there is one.
 *
 * `@copilotkit/a2ui-renderer` 1.68.1 peer-depends on zod ^3 and resolves its own
 * 3.25.76; this app is on zod 4. The two share a name and not a type, so a zod-4
 * object is rejected as missing `_parse`, `_cached`, `UnknownKeysParam` and a
 * dozen other zod-3 internals. There is no version of this that type-checks
 * honestly — installing zod 3 alongside would mean two zods and two schemas,
 * which is the drift this design exists to prevent (F6).
 *
 * The cast is on the whole object rather than the schema because the target has
 * to be the LIBRARY's ZodObject, and naming zod's type here imports ours — the
 * very type being rejected.
 */
export const definitions = {
  [FORM_COMPONENT]: {
    description:
      'A form for a person to fill in. Include only the fields the request ' +
      'genuinely needs — a login form is an email, a password and nothing else.',
    props: formSpecObject,
  },
} as unknown as CatalogDefinitions
