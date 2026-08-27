import 'dotenv/config'

/**
 * Environment, settled before anything else is imported.
 *
 * This module exists purely for ORDER. ES modules are evaluated in source
 * order, and CopilotKit's runtime reads its telemetry setting at import time —
 * so a value set after that import is set too late and silently does nothing.
 * `server/index.ts` imports this first for that reason; it is not a stray
 * import to be tidied away.
 */

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
