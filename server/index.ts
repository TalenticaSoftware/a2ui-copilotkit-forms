import './env'
import express from 'express'
import cors from 'cors'
import { BuiltInAgent, CopilotRuntime } from '@copilotkit/runtime/v2'
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express'
import { SYSTEM_PROMPT } from './prompt'
import { renderFormTool } from './formTool'

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
 * The whole experiment, as one variable.
 *
 * "own" (default) — our `renderForm` tool and our shadcn components. Works with
 * OpenAI, at the cost of a rendering layer we maintain.
 *
 * "a2ui" — A2UI exactly as documented: it injects its own render tool, the
 * agent composes from A2UI's own components, and A2UI's renderer draws them. If
 * this works, most of src/lib is unnecessary.
 *
 * It failed on OpenAI (F12) because the injected tool declares its components
 * as an object with no properties, and strict tool calling then admits only
 * `{}`. Whether a provider that does not enforce strict schemas — Gemini —
 * behaves differently is the open question, and this switch is how it gets
 * asked without editing code.
 *
 * VITE_RENDER_MODE must match on the client.
 */
const RENDER_MODE = process.env.RENDER_MODE === 'a2ui' ? 'a2ui' : 'own'

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
  /**
   * Our tool, not the injected one. See server/formTool.ts for why.
   *
   * Its parameters are the real form schema, so the model fills a shape with
   * actual fields rather than the propertyless object A2UI's own tool declares.
   */
  tools: RENDER_MODE === 'own' ? [renderFormTool] : [],
})


const runtime = new CopilotRuntime({
  agents: { default: agent },
  a2ui: {
    /**
     * Deliberately OFF, and the flag is worth understanding in both positions.
     *
     * Left undefined, the middleware injects nothing: A2UI reports itself
     * enabled, `/info` says `a2uiEnabled: true`, and the agent — with no way to
     * draw — answers in prose while claiming "here is a register form" (F9).
     *
     * Set to true, the injected tool declares its components as
     * `items: { type: "object" }`, which under OpenAI strict calling admits
     * exactly one value: `{}`. The agent emits empty components and the surface
     * never paints (F12).
     *
     * So we supply `renderForm` instead — a tool whose parameters are the real
     * form schema — and return `a2ui_operations` from it, which is the
     * middleware's other painting path.
     */
    injectA2UITool: RENDER_MODE === 'a2ui',
    /** In "own" mode, treat our tool's result as A2UI output. */
    ...(RENDER_MODE === 'own' ? { a2uiToolNames: ['renderForm'] } : {}),
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
    renderMode: RENDER_MODE,
    // Named so a mis-wired client shows up as a wrong tool list rather than as
    // an empty chat with no explanation.
    tool: RENDER_MODE === 'own' ? 'renderForm (ours)' : 'render_a2ui (injected)',
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
  console.log(
    `[server] render mode: ${RENDER_MODE}` +
      (RENDER_MODE === 'own'
        ? ' — our renderForm tool, our components'
        : ' — A2UI as documented: injected tool, A2UI components'),
  )
})
