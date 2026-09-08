# Findings

What these libraries actually do, as opposed to what the documentation says.
Every item below was reproduced, most of them the hard way.

The common thread: **almost every failure in this stack is silent.** Nothing
throws. The chat shows a spinner, or prose, or an empty card, and the logs say
everything is fine.

## Silent failures

**A2UI reports itself enabled while injecting nothing.** `injectA2UITool` has no
default. Without it, `/info` returns `a2uiEnabled: true`, and the agent — with
no way to draw — answers in prose claiming it drew a form.

**A quota failure renders as a permanent loading skeleton.** An exhausted API
key produced "Building interface" indefinitely. The error reached the browser
console as `INCOMPLETE_STREAM`; the only surface that stayed silent was the one
a person was looking at.

**A completed render that painted nothing.** The stream ran to `RUN_FINISHED`
with the render tool answering `{"status":"rendered"}` and the conversation
stayed blank. Two separate causes, both below.

Diagnosing these needed the AG-UI event stream itself — tee the run endpoint's
response body in the page. The visible symptom is identical for all three.

## The injected tool validates nothing

Its schema is `items: { type: "object" }`. So:

- A prop name the model does not expect is **dropped in silence**. We declared
  `variant`, copying A2UI's own naming; the agent sent `type` anyway and every
  field rendered as plain text. Renaming to `type` fixed it.
- A **required** prop is a request, not a guarantee.

Where the model's instinct and the library's naming disagree, the model wins.

## `id` is reserved, and a prop by that name is eaten

A2UI reads every node as `{ id, component, ...properties }`. A catalog
declaring a prop called `id` never receives it — the value becomes the
*component's* id, the component registers itself under the wrong name, and its
parent's `children` reference dangles. Draws nothing. Reports success.

Reserve `id` and `component` in any custom catalog.

## The catalog id travels in the run context

The A2UI middleware finds the catalog id in an agent-context entry that
**CopilotKit's core assembles**. Calling `agent.runAgent()` directly bypasses
that: the middleware falls back to a hardcoded basic-catalog id, and since the
renderer holds exactly one catalog matched by exact id, there is nothing to fall
back to. The turn dies with `Catalog not found`.

Use `useCopilotKit().copilotkit.runAgent({ agent })`.

## zod 4 breaks the binder, silently

A2UI's binder decides which props are data bindings by reading
`_def.typeName === 'ZodUnion'` for an option shaped `{ path }`. zod 4 does not
set `_def.typeName`, so every prop classifies as static and every input renders
`[object Object]`. No error anywhere.

A binding must be declared as a union containing `{ path }` — not a bare object.

## The agent composes leaves, not containers

Publishing one rich `Form` component whose props were a whole form spec did not
work. Offered A2UI's primitives alongside it, the agent composed those and
ignored ours; offered ours alone, it refused outright, saying the catalog had no
input fields.

A2UI's tool composes a **tree of small components**. Every working
implementation exposes leaves.

## `createCatalog` drops the ability to write

The convenience wrapper forwards only `{ props, children, dispatch }` to each
renderer, dropping the `context` that carries `dataContext.set` — the only way a
component can write a value back. Build on `createReactComponent` directly.

Related: `action.functionCall` is specified as running "on the renderer", but
`web_core` ships no function registry and its dispatcher only emits payloads
containing `event`. A `functionCall` action goes nowhere.

## It did not work on OpenAI

A2UI injected no tool and rendered nothing on OpenAI models. The same code on
Gemini worked immediately. Diagnosed with a control run before changing anything
else.

## An agent cannot resolve a name to an id

It reads schemas, never rows. Asked to "edit the Website refresh project" it
**invented** an id — `"1"`, `"website-refresh"` — and the client dutifully tried
to load it. Sometimes it admitted defeat instead, so which behaviour you got was
luck.

Give it a lookup tool. Returning only `{ id, label }` keeps listings out of the
model's context.

## Smaller ones

- **Two copies of React.** pnpm gives the A2UI renderer its own resolution;
  two copies in one page throw "Invalid hook call", which reads like a
  Rules-of-Hooks mistake in your own code. Fix with `resolve.dedupe`.
- **`maxSteps` defaults to 1.** A2UI needs the agent to call an injected tool,
  so one step paints nothing.
- **Telemetry ships on**, announced in a startup line that is easy to miss.
- **Surfaces are clipped 1px on the left.** CopilotKit's surface viewport has
  vertical padding only, and `overflow` clips to the padding box — so shadcn's
  `ring-1`, a box-shadow painted outside the border box, is shaved off.
- **`shadcn add table` generated a broken import** and installed an unrelated
  npm package called `cn` to satisfy it. Caught by the dependency boundary check.

## One withdrawn

An early finding claimed A2UI paints partial frames during streaming, and an
architecture was recommended on that basis. Walking ~30 streaming prefixes
disproved it. Recorded as withdrawn rather than deleted, because the argument
had been made.
