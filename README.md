# Prompt to form

Say what you want to do — "I want to add a user" — and get a working form,
drawn with shadcn/ui, whose fields come from the API's own schema. Filling it in
and pressing the button writes a real record.

Nobody has described that form anywhere. The agent asks the API what it accepts,
reads the JSON Schema back, and composes the form from it.

Built on the stack the wider POC is actually about: **CopilotKit** for the chat
surface, **AG-UI** for streaming, and **A2UI** for turning the agent's answer
into components. Portal-Lite next door has exercised CopilotKit heavily; A2UI is
the gap this app aims at.

## Running it

Three processes, because there are three parts. One command starts all three,
each line prefixed with which one said it.

```bash
cp .env.example .env      # then add your key
pnpm install
pnpm dev:all              # web :5174 · runtime :4100 · backend :4200
```

Ctrl-C stops the set. To run one on its own — to read its output without the
other two interleaved, or to restart just it — `pnpm dev`, `pnpm dev:server` and
`pnpm dev:api` still do exactly that.

The server refuses to start on bad configuration rather than failing later on
the first message — a missing key or an unknown provider is named at startup.

## The three parts

| | | knows |
|---|---|---|
| `api/` | :4200 | users. Not what a form is. |
| `server/` | :4100 | how to run an agent. Not what a user is. |
| `src/` | :5174 | how to draw. Not where anything lives. |

They meet only over HTTP — never by import, even though they share a folder
here. In production they are three repositories, and `boundaries.test.ts` fails
the build if one reaches into another.

## How a form happens

```
"add a user"
   -> agent: list_resources, describe_resource        (HTTP, to :4200)
   -> agent: A2UI tool, composing OUR catalog         (AG-UI stream)
   -> browser: shadcn components, bound to a data model
   -> press: browser looks the operation up, POSTs    (HTTP, to :4200)
   -> agent: says what came back
```

Two declarations, each used twice and copied nowhere.

`api/users.ts` holds the zod schema that `POST /api/users` validates against
**and** that `GET /api/schema/users` publishes. `src/a2ui/catalog/definitions.ts`
holds the zod schema the renderers are typed against **and** that the browser
advertises to the agent on every run.

The catalog lives in the frontend because that is the only side that can own it:
a renderer is code. The server imports nothing from either —
`grep -c definitions server/*.ts` returns zero.

## What the browser is trusted with

The agent gives the submit button a **resource and an operation**, never a URL.
The browser looks those up in the descriptor it fetched itself. A model that
transcribed an endpoint could transcribe a wrong one, and a form that posts
confidently into nowhere is worse than one that refuses.

## Commands

| | |
|---|---|
| `pnpm dev:all` | All three at once |
| `pnpm dev` | Browser, :5174 |
| `pnpm dev:server` | Agent runtime, :4100 |
| `pnpm dev:api` | Backend, :4200 |
| `pnpm test` | vitest |
| `pnpm lint` | oxlint |
| `pnpm exec tsc -b` | Typecheck app, runtime, backend and config |

## Findings

`docs/findings.md`. That file is the actual deliverable — negative results
included, every claim tagged with how it was established.

`docs/architecture-review.md` is the other half: what the libraries do is one
question, and what we built on top of them is another. It records four known
weaknesses in this code and the order to take them in.

## Conventions

- Dependencies pinned **exactly**. No `^`, no `~`.
- **zod 3**, deliberately — A2UI's binder reads `_def.typeName`, which zod 4 does
  not set, and every input renders `[object Object]` with no error (F25).
- `reference/portal-lite/` is the earlier CopilotKit evaluation, kept for
  reading. Most of the findings here started there.
