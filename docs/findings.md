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

## F14 — F12 is provider-specific, and confirmed. A2UI works as documented on Gemini `[hit]`

Same code, same catalog, same injected tool — only the model changed. `RENDER_MODE=a2ui`
with `google/gemini-3.6-flash` produced a complete surface:

```json
{"surfaceId":"register-form","components":[
  {"component":"Column","id":"root","children":["title","name-field",…],"gap":16},
  {"component":"Title","id":"title","text":"Register"},
  {"component":"TextField","id":"name-field","label":"Full Name","required":true,
   "value":{"path":"/fullName"}},
  …
  {"component":"Button","id":"submit-button","label":"Register",
   "action":{"event":{"name":"register_user","context":{…}}}}
],"data":{"fullName":"","email":"","password":""}}
```

Real components, real props, data bindings, an action event. It rendered — a
working register form drawn entirely by A2UI's own renderer, with **none** of our
`src/lib` involved.

So the `[reasoned]` half of F12 is now settled. The tool schema declaring
`items: { type: "object" }` is only fatal where the provider enforces strict
schemas. OpenAI does; Gemini does not.

Note also that `gemini-2.5-flash` — the newest Gemini in CopilotKit's own model
union — returns 404 "no longer available to new users". The union is stale; the
string passes through, so `google/gemini-3.6-flash` works anyway.

## F15 — The middleware reports "rendered" for components that do not exist `[hit]`

In the same run, Gemini invented three component names: `Title`, `EmailInput`
and `PasswordInput`. None is in A2UI's catalog, whose renderer supports `Text`,
`TextField`, `Button`, `CheckBox`, `Column`, `Row`, `Card` and a dozen others.

The middleware emitted `createSurface`, `updateComponents`, `updateDataModel`
and returned `{"status":"rendered"}`.

The cause is in its own source: `getValidationCatalog()` returns undefined
unless `config.schema` carries an inline catalog, and validation then degrades
to structural-only — it checks `typeof f.component === "string"` and nothing
more. With A2UI's built-in catalog and no explicit schema, ANY component name
passes.

This compounds F5: the shipped helper for producing that schema emits the legacy
array format, which also yields no validation catalog. Both documented routes to
a validated catalog end in no validation, silently.

## F16 — A2UI's own widgets drop constraints the agent expressed `[hit]`

The rendered form, read from the DOM:

| Field | Input type | `required` |
|---|---|---|
| Full Name | `text` | false |
| Email Address | `text` | false |
| Password | `password` | false |

Gemini sent `required: true` on all three, and named the middle one an email
field. What reached the browser was three inputs, one of them masked, none
required and none typed as email.

Not a bug so much as a ceiling: A2UI's catalog is a generic widget set, so a
form drawn from it is a form without validation. That is the real trade against
our own renderer — which enforces `required`, validates email, and refuses a
submit — rather than the aesthetic difference it first appears to be.

## F17 — The catalog goes on the PROVIDER, not the message renderer `[hit]`

The answer to F10, and the reason our catalog never reached the agent.

`createA2UIMessageRenderer({ catalog })` draws a surface. It does not advertise
one. Only `CopilotKitProvider`'s `a2ui={{ catalog }}` mounts
`A2UICatalogContext`, whose own doc comment says it "renders agent context
describing the available A2UI catalog and custom components" — adding two
context entries to every run:

- *"A2UI catalog capabilities: available catalog IDs and custom component
  definitions the client can render"*
- the component schemas, in the v0.9 inline format via
  `extractCatalogComponentSchemas`

That is the `supportedCatalogIds` negotiation the A2UI spec describes. Without
it the agent is told about the basic catalog only, no matter what the browser
can actually draw.

Both props are typed `catalog?: any`, both named `catalog`, and only one does
the thing you need. Neither is documented: CopilotKit's A2UI page shows
`a2ui: {}` on the server and a `theme` on the client, and covers custom catalogs
nowhere — while the A2UI spec calls them the normal case, since "most production
applications will define their own catalog to reflect their specific design
system".

With the prop moved, the agent emitted our component correctly on the first try:

```json
{"components":[{"component":"Form","id":"root","title":"Create an Account",
  "submitLabel":"Register","fields":[
    {"name":"name","kind":"text","label":"Full Name","required":true}, …]}]}
```

and it rendered as our shadcn form — required marks, password toggle and all.
**A2UI's documented path, with our design system.** That is the middle row of the
grid, and it works.

## F18 — WITHDRAWN. A2UI does NOT paint partial frames `[hit]`

**Superseded by F21.** The observation below was real; the explanation was wrong,
and it was wrong in the direction that would have cost us the simpler
architecture. Left in place because a retracted finding is worth more than a
quietly deleted one.

## F18 (original, incorrect) — A2UI paints partial frames `[reasoned, disproven]`

Non-deterministic, which is what makes it dangerous.

The first run of the above showed our failure card:

```
fields.0.name: Invalid input: expected string, received undefined
fields.1.name: …
```

The agent's output was complete and correct — verified on the wire. The
middleware emits `updateComponents` REPEATEDLY as the tool's arguments stream
in, so our renderer is handed the half-built object several times, and one of
those intermediate frames was the last thing it parsed.

The second, identical run rendered perfectly. Same code, same prompt, different
outcome.

Our own tool does not have this problem: `execute` returns the finished spec in
one piece, so no partial frame exists. It is specific to the injected tool's
streamed arguments.

The fix is not to loosen validation — a partial frame is exactly the "half a
form" case worth refusing. It is to distinguish "not finished yet" from
"invalid", which the surface lifecycle already knows and does not pass on.

## The grid, complete

| | OpenAI | Gemini |
|---|---|---|
| A2UI tool + basic catalog | ❌ empty components (F12) | ✅ renders, no validation (F16) |
| A2UI tool + **our** catalog | ❌ (F12 is about the tool) | ✅ **shadcn, our validation** (F17), flaky (F18) |
| **Our tool** + our catalog | ✅ | ✅ |

Only the bottom row works on both providers, and only it is deterministic.

## F19 — An over-strict contract field hangs the run, silently `[hit]`

Our own bug, and the most instructive one yet.

`fieldName` required camelCase: `^[a-z][a-zA-Z0-9]*$`. Asked for a login form,
the model returned `"name": "remember_me"`. The tool's parameter validation
refused the call, `execute` never ran — and the stream ended:

```
RUN_STARTED · TOOL_CALL_START · TOOL_CALL_ARGS · TOOL_CALL_END
```

No `TOOL_CALL_RESULT`. No `RUN_ERROR`. No `RUN_FINISHED`. The spinner never
stops and nothing anywhere says why.

Two lessons, and the second is the bigger one:

A constraint that buys nothing is not free. camelCase versus snake_case makes no
difference to anything downstream — both are fine object keys — and the rule
existed only because it looked tidy. Relaxed to `^[a-z][a-zA-Z0-9_]*$`.

And a rejected tool call is indistinguishable from a hang. The framework has no
event for "the tool refused its arguments", so any schema an agent can fail to
satisfy is a way to stall the run with no diagnosis. Anything strict in a tool
schema needs to be there for a reason you can name.

## F20 — A rate limit is a spinner `[hit]`

Final verification was blocked by Gemini's free-tier quota. The browser console
carried it plainly:

```
[CopilotKit] Error (agent_run_error_event): Failed after 3 attempts.
Last error: You exceeded ... gemini-3.6-flash. Please retry in 47.8s
```

The screen showed a loading dot. No message, no retry affordance, no countdown —
and the information had already reached the client.

This is F2's third distinct trigger: a bad key, a failed generation, and now a
rate limit all present identically to a person. Worth stating as a single
conclusion rather than three findings: **CopilotKit surfaces run failures to the
console and not to the UI, and a host app has to render them itself.**

It also explains earlier "hangs" in this session that we attributed to the
agent. Two identical requests, minutes apart, produced a stall and then a clean
`RUN_FINISHED` — the difference was quota, not code.


## F21 — F18 was wrong: the middleware only paints complete components `[hit]`

Spent an hour on the question "can the renderer tell 'still streaming' from
'broken'?" The answer turned out to be that it does not need to.

**There is no signal.** `RendererProps` carries `props`, `children` and
`dispatch`. `Surface` is typed `any`. `useA2UI()` exposes `version` — a change
counter — and nothing about completeness. A renderer genuinely cannot ask
whether more is coming.

**But the middleware never hands it an incomplete component.**
`updateComponents` is emitted only once `extractCompleteItemsWithStatus` reports
the components array CLOSED. That function is exported, so the assumption is
testable rather than inferred — `streaming.test.ts` walks every plausible
intermediate state of a realistic tool-argument stream and asserts none yields a
component our contract would reject. It passes across ~30 prefixes, including
the interesting one: a nested `fields` array closes long before `components`
does, and its `]` is NOT mistaken for the outer close.

So what caused the failure cards we saw?

Two things, neither of them streaming:

1. **F19** — our own camelCase rule, refusing `remember_me`. Now relaxed.
2. **F10's mis-wiring.** The very first failure showed `name` missing from every
   field while the wire carried it on all of them — a stripped prop, not a
   truncated one. That run had the catalog registered through
   `createA2UIMessageRenderer` instead of the provider. Leading explanation, and
   the only one consistent with all three fields losing the same key.

`[reasoned]` on the second point: confirming it needs a live run, and Gemini's
free-tier quota is exhausted.

### Why this matters more than the finding itself

If partial frames were real, our own tool would be the only way to render
reliably, and the contract would have to be shared across two repos.

They are not real. Which means A2UI's own injected tool is viable on Gemini, the
frontend can own the catalog alone and advertise it at runtime, and the
cross-repo contract problem does not need solving — it disappears.

I argued the opposite an hour ago on the strength of F18. The test is why the
correction is trustworthy and the original claim was not.

## F22 — Pure A2UI: the server ends up knowing nothing about forms `[hit, unverified live]`

Acting on F21. `formTool.ts` deleted, `injectA2UITool: true`, no custom tool, no
`a2uiToolNames`, no mode switch.

`grep -c contract server/*.ts` now returns 0 for every file. The server holds an
API key, a runtime and a generic prompt; the browser owns the component catalog
and advertises it — with its schemas — on every run. That is A2UI's design, and
it means the contract lives in one repository rather than two.

Verified without the model: typecheck clean across three projects, 12 tests
pass, lint clean, the server boots, and `/info` still reports
`"a2uiEnabled": true`.

**NOT verified live.** Gemini's free-tier quota moved from a per-minute limit
("retry in 22s") to the daily cap ("You exceeded your current quota, check your
plan and billing details"), which does not reset for hours. So the claim that
this renders a form is a design claim, not a result — the same distinction F8
was recorded for, and worth keeping honest about after F18 turned out to be
wrong.

To settle it, when quota returns:

```
pnpm dev:server && pnpm dev     # then ask for a login form
```

If it fails, `git revert` restores `formTool.ts` and the mode switch, and the
"own" path was working as of commit ca8dda1.

## F22 (settled) — Pure A2UI renders, and the agent ignored our catalog `[hit]`

It works, and the result is not what we wanted.

`formTool.ts` deleted, `injectA2UITool: true`, our catalog advertised through the
provider, `includeBasicCatalog: true`. Asked for a login form on
`gemini-3.6-flash`. After roughly two minutes a form appeared:

```
Log In
Email
Password
[ Log In ]
```

But it is drawn with A2UI's OWN components, not ours. Read from the DOM:

| | |
|---|---|
| Email input type | `text` — not `email` |
| `required` | `false` on both, though a login form needs both |
| Password show/hide toggle | absent |
| Required marks | absent |
| Submit button | A2UI's blue default, not our shadcn button |

**The agent had our `Form` component available and chose not to use it.**
`includeBasicCatalog: true` offers `Card`, `TextField` and `Button` alongside
ours, and composing three small primitives is evidently an easier path than
filling one component with a nested `fields` array.

So advertising a custom catalog does not mean it gets used. Nothing forces the
choice, nothing reports that it was skipped, and the failure is invisible: what
appears is a plausible form, so only a DOM inspection reveals that the design
system and every constraint were dropped on the way (F16, now reproduced through
our own catalog rather than the basic one).

### What this settles

- **Pure A2UI works.** The architecture is sound: the server knows nothing about
  forms, the browser advertises what it can draw, and a form appears.
- **It does not preserve our components.** Not reliably, and not without a way
  to make the agent prefer them.

Two things left untried, in order of promise: dropping
`includeBasicCatalog` so ours is the only option, and naming the component in
the prompt. Both are cheap; neither is guaranteed, because the choice is the
model's.

The custom tool did not have this problem — `renderForm` was the only tool, so
"use our component" was not a decision the agent could get wrong.
