# Tools & tech stack

## The three apps

| | Port | Knows |
| --- | --- | --- |
| `apps/web` | 5174 | how to **draw** — the A2UI catalog and its shadcn renderers |
| `apps/runtime` | 4100 | how to **talk** — the agent and its three discovery tools |
| `apps/api` | 4200 | what is **real** — zod schemas and the routes derived from them |

Three `package.json` files. `apps/api` lists express and zod and nothing about
React — documentation nobody has to be told to read. In production these are
three repositories; here they share a pnpm workspace, and `pnpm boundaries`
stops that convenience turning into coupling.

## The stack

| Layer | Choice | Why |
| --- | --- | --- |
| Chat surface | **CopilotKit** 1.68.1 | Provides the chat UI, the runtime, and the A2UI plumbing in one piece |
| Transport | **AG-UI** | The streaming event protocol underneath CopilotKit |
| Generative UI | **A2UI** v0.9 | Lets an agent compose a UI from components the client advertises |
| Components | **shadcn/ui** on Base UI | Ours to own — copied in, not a dependency to fight |
| Schemas | **zod 3** | Pinned deliberately; see Findings |
| Model | **Gemini** `gemini-3.6-flash` | A2UI's tool injection did not work on OpenAI (see Findings) |
| Build | Vite 8, React 19, Tailwind 4, TypeScript, pnpm | — |

## Notable choices

**zod 3, not 4.** A2UI's binder classifies props by reading `_def.typeName`,
which zod 4 does not set. Versions come from a `catalog:` in
`pnpm-workspace.yaml` so three manifests cannot drift.

**No shared package between the apps.** The contract is the API's own
descriptor, fetched over HTTP. A shared npm package would be a fourth thing to
version, and would let the boundary rot invisibly.

**One `.env` at the root.** Only the runtime needs a key.

## Commands

```bash
pnpm dev:all     # all three, prefixed output
pnpm check       # typecheck, lint, boundaries
pnpm typecheck
pnpm lint
pnpm boundaries
```
