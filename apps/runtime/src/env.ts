import path from 'node:path'
import dotenv from 'dotenv'

/**
 * Environment, settled before anything else is imported. This module exists for
 * ORDER: CopilotKit reads its telemetry setting at import time, so a value set
 * afterwards silently does nothing. Not a stray import to be tidied away.
 */

// One .env at the repository root. `pnpm --filter` runs with this package as cwd, so state the path.
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') })

/** CopilotKit ships telemetry on. Defaulted off — set it in .env to opt back in. */
if (process.env.COPILOTKIT_TELEMETRY_DISABLED === undefined) {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true'
}
