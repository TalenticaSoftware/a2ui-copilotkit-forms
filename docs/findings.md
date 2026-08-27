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

Reproduce: run the server with a deliberately invalid key, send any message,
watch the chat pane and then the server log.

Refined once the client was wired up: the information *does* reach the browser.
The console carries
`[CopilotKit] Error (agent_run_error_event) { code: INCOMPLETE_STREAM, message:
"invalid x-api-key" }`. So this is not a missing signal — it is a signal that
arrives and is never rendered. Whatever a person is shown for a failed run is a
choice the host app has to make deliberately.

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

## F5 — The shipped schema helper silently downgrades validation `[hit]`

`@copilotkit/a2ui-renderer` exports `extractSchema(definitions)` and documents it
as "suitable for passing to the runtime's `a2ui.schema` config". It returns the
LEGACY array format, `[{ name, description, props }]`.

The middleware accepts that format and then degrades to structural-only
validation — its own source says the semantic catalog "returns undefined for the
legacy array form or no schema". So the documented path from client catalog to
server schema quietly costs you the check that catches a wrong recipe, and
nothing warns.

Worked around by generating the v0.9 inline catalog on the server directly from
zod (`src/lib/a2ui-catalog.ts`) and letting the client file supply renderers
only.

## F6 — The A2UI renderer needs zod 3; the app is on zod 4 `[hit]`

`createCatalog(definitions, renderers)` type-checks renderers against zod props
schemas, which is exactly the shape contract worth having. It cannot be used
honestly from a zod-4 codebase: `@copilotkit/a2ui-renderer` 1.68.1 peer-depends
on `zod ^3.25.75` and resolves its own 3.25.76, so a zod-4 object is rejected as
missing `_parse`, `_cached`, `UnknownKeysParam` and a dozen other zod-3
internals.

There is no honest fix available to a caller. Installing zod 3 alongside means
two zods and two schemas, which is the drift the design exists to prevent. The
app casts at exactly one boundary and re-parses the props with the real zod-4
schema before drawing, so the library's copy is a label rather than a check.

Still open: whether the library reaches into the schema's zod-3 internals at run
time. Needs a live agent run.

## F7 — Two React copies, reported as a Rules-of-Hooks mistake `[hit]`

Adding `@copilotkit/a2ui-renderer` produced a page full of "Invalid hook call…
You might be breaking the Rules of Hooks", followed by
`Cannot read properties of null (reading 'useState')`. The app renders nothing
useful and the message points at your own code.

It is not your code. Every React symlink on disk resolves to the same
`react@19.2.8`; the duplication is in Vite's dependency pre-bundle, which
produced two optimized copies (visible as two different `?v=` hashes on
`react-dom_client.js`). `resolve.dedupe: ["react", "react-dom"]` plus clearing
`node_modules/.vite` fixes it.

Recorded because of how badly the error misdirects. Two of the three causes
React suggests are wrong here, and the true one is third on the list.

## F8 — Not yet answered: does any of this work end to end? `[reasoned]`

Everything up to the model call is verified. The catalog is generated, the
runtime reports `a2uiEnabled: true`, the client catalog is registered, and the
renderer draws correctly from hand-written recipes. What has NOT been observed is
a real agent producing a real recipe, because that needs an API key.

Recorded rather than assumed. Until a live run happens, "the agent's recipe
renders with our components" is a design claim, not a result — and the whole
point of this file is that the two are not the same thing.

## F9 — `a2uiEnabled: true` with no tool injected, and the agent lies about it `[hit]`

The headline finding so far.

`new CopilotRuntime({ a2ui: { schema } })` reports `"a2uiEnabled": true` from
`/info`, injects the catalog as context, and **injects no render tool**. The
middleware gates that on a separate flag:

```js
this.config.injectA2UITool ? this.injectToolGuidelines(this.injectToolAndFlag(i)) : i
```

`injectA2UITool` has no default. The runtime only fills one in when the CLIENT
advertises a catalog (`injectA2UITool ?? (providerA2UIHasCatalog ? true : void 0)`),
so a server-configured catalog alone leaves it undefined and the tool never
exists. `RunAgentInput.tools` was `[]`.

What a person sees: asking "I need a register form" returns

> "Here is a register form containing the essential fields: email address and
> password. If you need additional fields… please specify exactly what you
> require."

Nothing was rendered. The agent had no way to draw anything, so it described a
form and said "here is" — narrating a thing that does not exist, beside a UI
that shows nothing. This is Second Brain's F24 arriving through a different
door, and it is worse here because every observable signal says the feature is
on: `a2uiEnabled: true`, no error, no warning, HTTP 200.

Reproduce: omit `injectA2UITool`, ask for a form, then read
`RunAgentInput.tools` in the `/run` request body.

Fixed by setting `injectA2UITool: true` explicitly.

## F10 — Our catalog never reached the agent `[hit]`

With A2UI configured server-side, the context injected into the run was the
**basic catalog**:

```
"Available A2UI catalog:
 - https://a2ui.org/specification/v0_9/basic_catalog.json (basic catalog)"
```

`catalogId` was the basic one and `Form` appeared nowhere. The agent was offered
`Text`, `Image`, `Icon`, `Video` — nothing that can express a form.

Two candidate causes, not yet separated:

1. The client's `createA2UIMessageRenderer({ catalog })` does not advertise the
   custom catalog into the run context — the capabilities line lists only the
   basic catalog while claiming to list "custom component definitions the client
   can render".
2. Our server-side `schema` is shaped wrongly and is being ignored (see F11),
   leaving the client's advertisement in place.

## F11 — An A2UI catalog entry is not a plain JSON Schema `[reasoned]`

Probable root cause of F10, and of the empty surface that follows it.

We modelled the catalog as one `Form` component whose props are the whole form
spec, generated with `z.toJSONSchema`. The basic catalog's entries do not look
like that. Each is an envelope:

```
"Text": { "allOf": [ { "$ref": "common_types.json#/$defs/ComponentCommon" },
                     { "properties": { "component": { "const": "Text" }, … },
                       "required": ["component", "text"] } ] }
```

And the middleware only emits components whose items satisfy
`typeof f.component === "string"`. So an A2UI component is a NODE carrying its
own `component` discriminator inside a `ComponentCommon` envelope — not an
arbitrary JSON Schema object.

Consistent with what the agent actually produced once the tool existed:

```json
{"surfaceId":"login-form","components":[{ }],"data":{}}
```

One empty object. It called the tool, had no component vocabulary it could
express, and emitted nothing usable. The middleware then never emits a surface,
so the skeleton says **"Building interface · ~240 tokens"** forever — no error,
no timeout, no failure state. F2's silence, in its most expensive form.

Next step: reshape `buildCatalog()` to emit v0.9 component envelopes rather than
a bare JSON Schema, and re-check whether the context then carries `Form`.

## F12 — A2UI cannot render with OpenAI: the render tool's schema forbids content `[hit]` / `[reasoned]`

The biggest finding so far, and it is not about our catalog.

Run with A2UI's OWN basic catalog — no custom schema, no custom renderer, the
framework entirely as shipped — and ask for a register form. The agent calls
`render_a2ui` and produces:

```json
{"surfaceId":"register-form","components":[{ },{ },{ },{ },{ }],"data":{}}
```

Five empty objects. It plainly worked out that a register form needs five
components and could not describe a single one of them.

`[hit]` — the observation. Raw `TOOL_CALL_ARGS` deltas show the model emitting
`{`, then a run of TAB characters, then `}`, per component:

```
delta='{'  delta='\t'  delta='\t'  …  delta='}'
```

That is a model padding a space it is not allowed to write anything into.

`[hit]` — the cause in the schema. `RENDER_A2UI_TOOL` declares:

```js
components: { type: "array", items: { type: "object" } }
```

`items` has no `properties`. The component vocabulary is delivered separately,
as prose in a context block — it is not in the tool schema at all.

`[reasoned]` — the attribution. `@ai-sdk/openai` passes `strict: strictJsonSchema`
through to OpenAI's tool calling. Under strict structured output, a schema of
`{type:"object"}` with no declared properties admits exactly one value: `{}`.
Not confirmed on the wire; confirming it needs the outbound request body.

Consequences, in order of severity:

1. A2UI as shipped renders nothing through this OpenAI path — not our catalog,
   not the basic one.
2. Nothing reports the failure. The tool call succeeds, the run finishes, and
   the surface never arrives, so the client shows "Building interface" forever.
   No error, no timeout, no failed state.
3. Every earlier finding about our own catalog (F10, F11) is unproven while this
   holds. They may still be true; they are not the reason nothing renders.

The control run was worth doing precisely because it moved the fault from our
code to the framework, which is the opposite of what we expected and the more
important answer.

Untried: whether the same run against Anthropic behaves differently, since its
tool calling does not enforce strict schemas the same way. That single test
would turn the `[reasoned]` half into a `[hit]` and is the next thing to do.

## F13 — It works, via the path neither reference implementation uses `[hit]`

The fix, and the answer to F12.

The middleware paints a surface from TWO sources: the tool it injects, and any
tool whose result content parses as `{ a2ui_operations: [...] }`. Only the first
is broken. So we turned `injectA2UITool` off, declared our own tool whose
`parameters` are the real zod form schema, and returned the operations from its
handler.

Strict mode stops being an obstacle and becomes the point: the model is now held
to the same seven field kinds the renderer can draw.

Asked for a register form, the agent produced:

```json
{"title":"Register","description":"Create a new account…","submitLabel":"Register",
 "fields":[{"name":"email","kind":"email","required":true,…},
           {"name":"username","kind":"text","required":true,…},
           {"name":"password","kind":"password","required":true,…}]}
```

Complete, valid, every `required` stated — and it rendered as our own shadcn
form inside the conversation, password toggle and all. Filled in and submitted,
the values arrived intact.

### Why the reference implementations do not hit this

Neither uses the injected tool. `a2ui-poc` has the model write A2UI JSON into
its message body via `DirectJsonFormat`, and passes its catalog through a
modifier named — with no ambiguity about what it is for —
`remove_strict_validation`. The Second Brain dashboard emits state snapshots and
paints from those. Both route around the exact place we got stuck.

### The five questions the plan set, answered

1. **Does the catalog constrain the agent?** Yes, once the constraint lives in a
   tool schema rather than a prose context block. Every field came back as one
   of our seven kinds.
2. **What does a person see while it thinks?** A skeleton with a live token
   count. It reads as progress — but it is also what a permanently stuck run
   looks like (F12), with nothing to tell the two apart.
3. **Does a rendered form survive streaming?** Yes. The register form kept its
   values while a second form was generated and painted beside it. The module
   store was the right call and the risk did not materialise.
4. **Can the form send anything back?** Into the app, yes — submitted values
   reach our store. Back to the AGENT is still untested; the middleware has a
   `userAction` path (`processUserAction`) that was not exercised.
5. **Catalog or prompt — which wins?** Not yet separated, and less interesting
   now: the tool schema outranks both.

### The acceptance test, met

"I need a login form" produced Email, Password, a Login button, and nothing
else. No phone number, no full name, no address. The absence was always the
criterion, and it held.
