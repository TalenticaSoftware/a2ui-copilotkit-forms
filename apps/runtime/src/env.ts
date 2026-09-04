import path from 'node:path'
import dotenv from 'dotenv'

/**
 * Environment, settled before anything else is imported.
 *
 * This module exists purely for ORDER. ES modules are evaluated in source
 * order, and CopilotKit's runtime reads its telemetry setting at import time —
 * so a value set after that import is set too late and silently does nothing.
 * `src/index.ts` imports this first for that reason; it is not a stray import
 * to be tidied away.
 */

/**
 * One .env, at the repository root, and not one per app.
 *
 * dotenv reads the working directory, which under `pnpm --filter` is this
 * package — so the path is stated. Three apps sharing one key file is better
 * than three files where two are nearly empty and the interesting one is
 * whichever you did not edit.
 */
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') })

/**
 * CopilotKit ships anonymous telemetry ON, and says so in a startup line that
 * is easy to scroll past. This is a local research tool poking at a framework's
 * sharp edges; the shape of those experiments is nobody else's business.
 *
 * Defaulted rather than forced — set it explicitly in .env to opt back in.
 */
if (process.env.COPILOTKIT_TELEMETRY_DISABLED === undefined) {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true'
}
