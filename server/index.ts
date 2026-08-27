import './env'
import express from 'express'
import cors from 'cors'
import { BuiltInAgent, CopilotRuntime } from '@copilotkit/runtime/v2'
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express'
import { buildCatalog } from '../src/lib/a2ui-catalog'
import { SYSTEM_PROMPT } from './prompt'

/**
 * The server: a CopilotKit runtime with A2UI switched on, and nothing else.
 *
 * Deliberately small. It holds the API key, runs the agent, and publishes the
 * catalog — no database, no accounts, no persistence. A submitted form goes
 * nowhere.
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
const KEY_VARIABLE: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
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
const keyVariable = KEY_VARIABLE[provider ?? '']

if (!keyVariable) {
  console.error(`[config] MODEL="${MODEL}" names an unknown provider "${provider}".`)
  console.error(`[config] Expected one of: ${Object.keys(KEY_VARIABLE).join(', ')} — as "provider/model".`)
  process.exit(1)
}

if (!process.env[keyVariable]) {
  console.error(`[config] MODEL="${MODEL}" needs ${keyVariable}, which is not set.`)
  console.error('[config] Put it in prompt-to-form/.env — see .env.example.')
  process.exit(1)
}

/**
 * `maxSteps` must exceed 1.
 *
 * The default is 1, which is one model call and no more. A2UI works by INJECTING
 * a tool the agent then has to call, so a single step lets the agent request the
 * render and never continue past it. This is the sort of default that produces
 * a chat that answers in prose and never paints anything, with no error to
 * explain why.
 */
const agent = new BuiltInAgent({
  model: MODEL,
  prompt: SYSTEM_PROMPT,
  maxSteps: 6,
})

/**
 * A2UI, switched on in one place.
 *
 * `schema` is the catalog generated from the field vocabulary. The middleware
 * injects a render tool into the agent's tools, feeds it this catalog as
 * context, and validates whatever comes back against it — none of which we
 * write.
 *
 * `recovery.debugExposure: 'verbose'` is a development choice and should not
 * survive to anything public: it opens the retry/error detail in the UI rather
 * than hiding it. The whole point of this app is to find out what happens when
 * the agent gets it wrong, and a collapsed expander is how that goes unnoticed.
 */
const runtime = new CopilotRuntime({
  agents: { default: agent },
  a2ui: {
    schema: buildCatalog(),
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
    catalogId: buildCatalog().catalogId,
    // Named so a mis-wired client shows up as a wrong component list rather
    // than as an empty chat with no explanation.
    components: Object.keys(buildCatalog().components),
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
  console.log(`[server] a2ui catalog: ${buildCatalog().catalogId}`)
})
