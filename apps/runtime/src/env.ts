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

/**
 * The AI SDK's warnings, quietened by default.
 *
 * Two repeat on every single turn and neither is actionable here: one says
 * system messages in `messages` are a prompt-injection risk, which is how
 * CopilotKit builds the request and not something this app chooses; the other
 * reports a replayed Gemini `thoughtSignature` that the SDK then handles itself.
 *
 * They matter because the terminal is ON SCREEN during a demo — `docs/demo.md`
 * has the presenter point at the `[api]` log lines — and paragraphs containing
 * "security risk" and "attacks" scrolling past reads as something being broken
 * when nothing is.
 *
 * Defaulted, not forced: set AI_SDK_LOG_WARNINGS=true in .env to see them again,
 * and do that before believing this app is warning-free.
 */
if (process.env.AI_SDK_LOG_WARNINGS !== 'true') {
  ;(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false
}
