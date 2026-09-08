import './env'
import express from 'express'
import cors from 'cors'
import { BuiltInAgent, CopilotRuntime } from '@copilotkit/runtime/v2'
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express'
import { SYSTEM_PROMPT } from './prompt'
import { API_URL, tools } from './tools'

/**
 * The server: a CopilotKit runtime with A2UI switched on, and nothing else.
 *
 * Deliberately small. It holds the API key and runs the agent — no database, no
 * accounts, no persistence. The records live behind the backend on another
 * port, which this reaches over HTTP like any other client, and the components
 * live in the browser, which advertises them itself.
 */

const PORT = Number(process.env.PORT ?? 4100)
/**
 * "provider/model", resolved by CopilotKit's bundled provider rather than our own
 * — installing @ai-sdk/* pulls a major version CopilotKit does not build against.
 */
const MODEL = process.env.MODEL ?? 'openai/gpt-4.1'

/** Which env var holds the key, per provider — so changing provider is an .env edit, not a code change. */
const KEY_VARIABLE: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  // GEMINI_API_KEY first because that is what a2ui-poc next door uses; the
  // runtime itself reads GOOGLE_API_KEY, so we copy one to the other below.
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
}

/**
 * Config checked before anything is built, naming the offending value. A server
 * that starts happily and dies on the first message turns a typo into an
 * apparent product defect — and here it fails silently (F2).
 */
const [provider] = MODEL.split('/')
const accepted = KEY_VARIABLE[provider ?? '']

if (!accepted) {
  console.error(`[config] MODEL="${MODEL}" names an unknown provider "${provider}".`)
  console.error(`[config] Expected one of: ${Object.keys(KEY_VARIABLE).join(', ')} — as "provider/model".`)
  process.exit(1)
}

const keyVariable = accepted.find((name) => process.env[name])

if (!keyVariable) {
  console.error(`[config] MODEL="${MODEL}" needs one of: ${accepted.join(' or ')}.`)
  console.error('[config] Put it in .env at the repository root — see .env.example.')
  process.exit(1)
}

// The runtime reads the provider's canonical variable, which is not always the one to hand.
const canonical = accepted[accepted.length - 1]!
if (!process.env[canonical]) process.env[canonical] = process.env[keyVariable]


/**
 * `maxSteps` must exceed 1. The default is one model call, and A2UI works by
 * injecting a tool the agent must then call — so one step paints nothing.
 */
const agent = new BuiltInAgent({
  model: MODEL,
  prompt: SYSTEM_PROMPT,
  // Discovery costs steps of its own: list, describe, then render.
  maxSteps: 10,
  tools,
})


const runtime = new CopilotRuntime({
  agents: { default: agent },
  a2ui: {
    /**
     * Without this the middleware injects nothing: `/info` still says
     * `a2uiEnabled: true`, and the agent answers in prose claiming it drew a
     * form (F9). It has no default.
     */
    injectA2UITool: true,
    // Verbose while this is a research tool: a collapsed expander hides the interesting failures.
    recovery: { debugExposure: 'verbose', showProgressTokens: true },
  },
})

const app = express()

// The dev server runs on another port, so the browser calls this cross-origin.
app.use(cors())

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    model: MODEL,
    keyVariable,
    // The server knows nothing about forms. The catalog lives in the browser.
    a2ui: 'injected tool; catalog advertised by the client',
    // Named here because a runtime pointed at a backend that is not running
    // fails as a chat that answers vaguely, which is hard to tell from a bad
    // prompt. Curl this before blaming the model.
    api: API_URL,
  })
})

app.use(
  createCopilotExpressHandler({
    runtime,
    basePath: '/api/copilotkit',
  }),
)

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] copilotkit at /api/copilotkit · model ${MODEL}`)
  console.log('[server] a2ui: injected tool; the client advertises the catalog')
  console.log(`[server] api at ${API_URL} — the agent discovers its schemas over HTTP`)
})
