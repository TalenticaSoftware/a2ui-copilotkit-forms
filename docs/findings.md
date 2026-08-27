# Findings

What this app is actually for. Every claim is tagged `[hit]` — reproduced here,
with the steps — or `[reasoned]`. Negative results count. Untagged claims do not
belong in this file.

Versions: `@copilotkit/runtime` 1.68.1 · `@copilotkit/react-core` 1.68.1 ·
`@ag-ui/a2ui-middleware` 0.0.10 (transitive).

---

## F1 — CopilotKit's anonymous telemetry is on by default `[hit]`

A runtime built with no telemetry configuration prints one line at startup and
reports `telemetryDisabled: false` from `GET /api/copilotkit/info`. The line is
easy to scroll past in a noisy dev log.

Reproduce: start the server without `COPILOTKIT_TELEMETRY_DISABLED`, then
`curl localhost:4100/api/copilotkit/info`.

Not a bug — it is documented and there is an opt-out. Recorded because the
default is on and the notice is quiet, which together decide what actually
happens in most projects. `server/env.ts` defaults it off here.

## F2 — A failed agent run is silent in the chat `[hit]`

With a deliberately invalid API key, sending "I need a register form" through
`CopilotChat` shows the user's message and then nothing. No error, no retry
affordance, no failed state — the message simply sits there. The server log
carries the real cause (`authentication_error: invalid x-api-key`), so the
information exists and does not reach the screen.

Reproduce: run the server with `ANTHROPIC_API_KEY=not-a-real-key`, send any
message, watch the chat pane and then the server log.

Severity is higher than it looks. A person cannot tell "the agent is thinking"
from "the run died", and the failure mode this app most needs to observe — the
agent producing a bad recipe — may land in the same silent hole. Whether an A2UI
recovery lifecycle (`building` / `retrying` / `failed`) surfaces where a plain
run failure does not is the first thing to check in step 5.

## F3 — The A2UI switch is real, and reports itself `[hit]`

`new CopilotRuntime({ a2ui: { schema } })` is accepted, and
`GET /api/copilotkit/info` then reports `"a2uiEnabled": true` alongside
`"a2ui": { "enabled": true }`. A positive result, and a useful one: the runtime
can be asked whether the feature took, so a mis-wired catalog is diagnosable
without guessing.

## F4 — `@ai-sdk/anthropic` 4.x does not fit CopilotKit 1.68.1 `[hit]`

Installing the current `@ai-sdk/anthropic` (4.0.42) and passing
`anthropic('claude-opus-5')` as the model fails to typecheck:
`BatchLanguageModelV4` is not assignable to `LanguageModelV2`. CopilotKit 1.68.1
depends on `@ai-sdk/anthropic: ^3.0.49`, a major version behind.

The fix is not to pin our own copy but to drop the dependency: `resolveModel`
takes a `"provider/model"` string and resolves it with the version CopilotKit
already ships. The string is passed through, so it is not limited to the model
ids named in CopilotKit's own union — `anthropic/claude-opus-5` resolves despite
that union topping out at `claude-sonnet-4.5`.

This is now how the server names its model for every provider, not a workaround
for one of them. `MODEL="openai/gpt-4.1"` is the default; the provider prefix
also picks which API key variable is required, so changing provider is an .env
edit rather than a code change.
