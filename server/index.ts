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
 * "provider/model", resolved by CopilotKit's own bundled provider.
 *
 * Deliberately NOT our own provider package. Installing @ai-sdk/anthropic
 * pulled 4.x while CopilotKit 1.68.1 builds against ^3, and the two disagree
 * about the model interface — `BatchLanguageModelV4` is not assignable to
 * `LanguageModelV2`. Passing a string lets the runtime resolve it with the
 * version it actually ships, which is one fewer dependency and one fewer thing
 * to keep in step.
 *
 * The id after the slash is passed straight through, so it is not limited to
 * the handful of models named in CopilotKit's own type.
 */
const MODEL = process.env.MODEL ?? 'openai/gpt-4.1'

/**
 * Which environment variable holds the key, per provider.
 *
 * Derived from the model string rather than hardcoded, so changing provider is
 * an .env edit and not a code change. This is Portal-Lite's provider seam in
 * miniature: one place knows about vendors, and nothing else branches on which
 * one is active.
 */
const KEY_VARIABLE: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  // GEMINI_API_KEY first because that is what a2ui-poc next door uses; the
  // runtime itself reads GOOGLE_API_KEY, so we copy one to the other below.
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
}

/**
 * Config is checked BEFORE anything is built, and the process exits if it is
 * wrong — naming the offending value rather than failing vaguely later.
 *
 * Portal-Lite learned this the painful way: a server that starts happily and
 * fails on the first message turns a config typo into an apparent product
 * defect. Here it would be worse than useless — the chat box would open, accept
 * a message, and die silently (see F2), so the person would see nothing at all.
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
  console.error('[config] Put it in prompt-to-form/.env — see .env.example.')
  process.exit(1)
}

/**
 * The runtime reads the provider's canonical variable, which is not always the
 * one a person has to hand. Copying rather than renaming keeps whatever they
 * already had working.
 */
const canonical = accepted[accepted.length - 1]!
if (!process.env[canonical]) process.env[canonical] = process.env[keyVariable]


/**
 * `maxSteps` must exceed 1.
 *
 * The default is 1: one model call and no more. A2UI works by INJECTING a tool
 * the agent must then call, so a single step lets it request the render and
 * never continue past it — a chat that answers in prose and paints nothing,
 * with no error to explain why.
 */
const agent = new BuiltInAgent({
  model: MODEL,
  prompt: SYSTEM_PROMPT,
  /**
   * Raised from 6 because discovery now costs steps of its own: list the
   * resources, describe one, then render. Three calls before a single component
   * exists, and running out mid-way looks exactly like the failure above — a
   * reply with no form in it.
   */
  maxSteps: 10,
  tools,
})


const runtime = new CopilotRuntime({
  agents: { default: agent },
  a2ui: {
    /**
     * Without this the middleware injects nothing: A2UI reports itself enabled,
     * `/info` says `a2uiEnabled: true`, and the agent — with no way to draw —
     * answers in prose while claiming "here is a register form" (F9). It has no
     * default; the runtime only supplies one when the CLIENT advertises a
     * catalog, so a server-configured setup leaves it undefined.
     */
    injectA2UITool: true,
    /**
     * Verbose recovery detail is a development choice, and should not survive
     * to anything public. The point of this app is to see what happens when the
     * agent gets it wrong, and a collapsed expander is how that goes unnoticed.
     */
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
