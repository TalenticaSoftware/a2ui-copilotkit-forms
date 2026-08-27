# Prompt to form

Type a sentence — "I need a register form" — and get a working form, drawn with
shadcn/ui. No backend, nothing saved.

The plan lives in the artifact "Forms From a Sentence". The short version:

1. **The model picks from a menu.** It never invents a component or a field
   type. It chooses from a fixed list of field kinds that we own.
2. **The answer is checked before anything renders.** Strictly, on our side,
   even though the model is asked for structured output. An unchecked answer is
   how a broken form gets rendered as if it were fine.
3. **Failure is visible.** No filler values for missing data, no half-rendered
   forms, and an unknown field kind gets a card that names it.

## Field kinds

Seven, each mapping to exactly one shadcn/ui component. Adding an eighth is a
deliberate decision, never something the model can do for us.

`text` · `email` · `password` · `textarea` · `number` · `select` · `checkbox`

## Running it

```bash
pnpm install
pnpm dev
```

## Conventions

- Dependencies are pinned **exactly**. No `^`, no `~`.
- Built as its own git repository, separate from `portal-lite/` next door.

## Status

Scaffold only. The screen is a static shadcn render — step 2 of the plan, which
is to get the components working before any model is involved.
