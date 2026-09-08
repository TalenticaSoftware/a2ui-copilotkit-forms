# a2ui-copilotkit-forms

> Forms derived from the API you post to, drawn by an agent, in shadcn/ui.

Say what you want to do — *"I want to add a user"* — and an agent reads the
API's own schema, draws a form from it in **shadcn/ui**, and saves.

No form is hand-written. Add a field to the backend's zod schema and the form
grows one, with nothing else edited anywhere.

Built on **CopilotKit** (chat + runtime), **AG-UI** (streaming) and **A2UI**
(turning the agent's answer into components).

## Running it

```bash
cp .env.example .env      # then add your key
pnpm install
pnpm dev:all              # web :5174 · runtime :4100 · backend :4200
```

Open http://localhost:5174 and try:

- `I want to add a user`
- `Show me the projects`
- `Edit the Website refresh project`
- `Delete Bo Lindqvist`

Watch the `[api]` lines in the terminal — `GET /api/schema/users` appears
mid-conversation, before any form does. That is the whole claim, visible.

Storage is in memory; restarting the backend resets it.

## Three apps

```
apps/web      the browser  :5174   knows how to DRAW   (catalog + renderers)
apps/runtime  the agent    :4100   knows how to TALK   (agent + its tools)
apps/api      the backend  :4200   knows what is REAL  (zod schemas + routes)
```

They never import each other. In production they are three repositories; here
they share a pnpm workspace, and `pnpm boundaries` stops that convenience
turning into coupling — it checks cross-app imports, undeclared dependencies,
and that the agent's prompt names no field of any resource.

## Commands

| | |
| --- | --- |
| `pnpm dev:all` | All three, prefixed output |
| `pnpm dev:web` / `dev:runtime` / `dev:api` | One at a time |
| `pnpm check` | Typecheck, lint, boundaries |
| `pnpm build` | Production build of the browser app |

## Documentation

Start with **[docs/scope.md](docs/scope.md)** — what this set out to answer.

| | |
| --- | --- |
| [scope.md](docs/scope.md) | The question, and what is in and out of scope |
| [tech-stack.md](docs/tech-stack.md) | The three apps and every library choice |
| [findings.md](docs/findings.md) | What these libraries actually do |
| [learnings.md](docs/learnings.md) | What we would tell the next team |
| [comparison.md](docs/comparison.md) | Advantages, costs, and the alternatives |
| [verdict.md](docs/verdict.md) | When to use this, when not to, what is still weak |

## Conventions

- Dependencies pinned **exactly**. No `^`, no `~`.
- **zod 3**, deliberately — A2UI's binder reads zod 3 internals (see findings).
- Shared versions come from the `catalog:` in `pnpm-workspace.yaml`.
