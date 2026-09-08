# Prompt to form

A chat that derives its forms from the API it posts to. Read
[docs/scope.md](docs/scope.md) first; [docs/findings.md](docs/findings.md) and
[docs/verdict.md](docs/verdict.md) carry the hard-won detail.

```bash
pnpm dev:all     # all three, prefixed output
pnpm check       # typecheck, lint, boundaries
```

## Three apps

```
apps/web      the browser  :5174   knows how to DRAW   (catalog + renderers)
apps/runtime  the agent    :4100   knows how to TALK   (agent + its tools)
apps/api      the backend  :4200   knows what is REAL  (zod schemas + routes)
```

They never import each other. `pnpm boundaries` enforces three things the
compiler cannot: no cross-app source imports, no dependency an app has not
declared, and no resource field name in the agent's prompt — a pasted field list
would pass the first two while making the agent's discovery a fiction.

## The one idea

The API's validation schema **is** the form spec. `apps/api/src/crud.ts` turns
one zod schema into five routes and the descriptor that describes them, so there
is never a second declaration to drift. Everything else is plumbing that refuses
to make a copy of it.

## Before changing anything

- **zod 3, not 4.** A2UI's binder reads `_def.typeName`; on zod 4 every input
  renders `[object Object]` with no error.
- **Never name a catalog prop `id` or `component`.** A2UI reserves both, and a
  colliding prop is eaten silently.
- **Run the agent via `useCopilotKit().copilotkit.runAgent()`**, not
  `agent.runAgent()` — the latter drops the run context carrying the catalog id.
- Failures in this stack are silent. When something does not render, tee the run
  endpoint's response body in the page and read the AG-UI events.

`docs/verdict.md` lists five known weaknesses. Read them before extending.

## Conventions

- Dependencies pinned exactly. Shared versions via `catalog:` in `pnpm-workspace.yaml`.
- `reference/` is reading material from other projects and is not versioned.
