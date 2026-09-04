# Prompt to form

Say what you want to do — "I want to add a user" — and the agent reads the API's
own schema, draws a form from it in shadcn, and saves. The app is at the root of
this repository; there is no longer a project folder to `cd` into.

Built on the stack the POC is about: **CopilotKit** for chat, **AG-UI** for
streaming, **A2UI** for turning the agent's answer into components.

```bash
pnpm dev:all     # all three processes, prefixed output
pnpm test        # vitest
pnpm lint        # oxlint
pnpm exec tsc -b # typecheck app, runtime, backend and config
```

## Three processes, three boundaries

```
src/     the browser  :5174   knows how to DRAW   (catalog + renderers)
server/  the runtime  :4100   knows how to TALK   (agent + its tools)
api/     the backend  :4200   knows what is REAL  (zod schemas + routes)
```

They never import each other, and `boundaries.test.ts` fails the build if they
try. In production these are three repositories; here they share a folder for
convenience, and convenience is exactly how a boundary rots.

The test checks **names as well as imports** — a field list pasted into the
system prompt would pass an import check while making the agent's discovery a
fiction.

## The one idea

The API's validation schema **is** the form spec. `api/crud.ts` turns one zod
schema into five routes and the descriptor that describes them, so there is
never a second declaration to drift. Everything else is plumbing that refuses to
make a copy of it.

Read `docs/architecture-review.md` before extending this. It records four known
weaknesses — chiefly that the request body is still held together by a sentence
in the system prompt (A1) — with the order to take them in.

`docs/findings.md` is the deliverable: what these libraries actually do, every
claim tagged `[hit]` or `[reasoned]`, negative results included.

## reference/

Read-only reading material.

- `portal-lite/` — the earlier CopilotKit evaluation. **Ours, and still
  versioned**, unlike the rest of this folder. It has its own `CLAUDE.md`; read
  it before changing anything in there. Retired, not deleted: the findings that
  shaped this app came out of it.
- `a2ui-poc/`, `second-brain-research-dashboard/` — third-party, git-ignored.
  Second Brain is analysed in the findings — chiefly that it fills missing data
  with plausible filler, and that its 576 tests exercise a code path the app no
  longer runs.

`.gitignore` uses `reference/*` with a `!reference/portal-lite/` exception. Git
does not look inside an excluded **directory**, so a bare `reference/` rule
would make that exception silently do nothing.

## Ports

`5174` web · `4100` runtime · `4200` backend
`5173` portal-lite web · `4000` portal-lite api

## Conventions

- Dependencies pinned **exactly**. No `^`, no `~`.
- **zod 3**, deliberately. A2UI's binder classifies props by reading
  `_def.typeName`, which zod 4 does not set — on zod 4 every input renders
  `[object Object]` with no error (F25).
