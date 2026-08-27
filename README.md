# Prompt to form

Type a sentence — "I need a register form" — into a chat box and get a working
form, drawn with shadcn/ui. Nothing is saved anywhere.

Built on the stack the wider POC is actually about: **CopilotKit** for the chat
surface, **AG-UI** for streaming, and **A2UI** for turning the agent's answer
into components. Portal-Lite next door has exercised CopilotKit heavily; A2UI is
the gap this app aims at.

## Running it

```bash
cp .env.example .env      # then add your OPENAI_API_KEY
pnpm install
pnpm dev:server           # runtime on :4100
pnpm dev                  # browser on :5174
```

The server refuses to start on bad configuration rather than failing later on
the first message — a missing key or an unknown provider is named at startup.

## How it fits together

```
you type  ->  CopilotKit  ->  agent  ->  render_a2ui  ->  middleware validates
                                                              |
          shadcn/ui form  <-  our catalog  <-  AG-UI streams it
```

`src/lib/form-spec.ts` is the single declaration underneath all of it. The zod
schema there produces the TypeScript types, the JSON Schema catalogue the agent
is constrained by, and the check that runs when its answer arrives.

## Field kinds

Seven, each mapping to exactly one shadcn/ui component. Adding an eighth is a
deliberate decision, never something the agent can do for us — and the compiler
enforces it: a kind with no renderer fails the build.

`text` · `email` · `password` · `textarea` · `number` · `select` · `checkbox`

## Commands

| | |
|---|---|
| `pnpm dev` | Browser, :5174 |
| `pnpm dev:server` | Runtime, :4100 |
| `pnpm test` | vitest |
| `pnpm lint` | oxlint |
| `pnpm exec tsc -b` | Typecheck app, server and config |

## Findings

`docs/findings.md`. That file is the actual deliverable — negative results
included, every claim tagged with how it was established.

## Conventions

- Dependencies pinned **exactly**. No `^`, no `~`.
- Its own git repository, separate from `portal-lite/` next door.
