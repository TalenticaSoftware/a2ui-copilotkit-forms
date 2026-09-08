# Learnings

Not about the libraries — those are in `findings.md` — but about building this
kind of system at all.

## The schema is the only thing worth declaring once

The API already knows every field it accepts, because it validates against a
zod schema before any logic runs. Publishing that first declaration is what lets
everything downstream stop keeping a second copy.

`apps/api/src/crud.ts` turns one schema into five routes **and** the descriptor
that describes them. A hand-written descriptor beside hand-written routes is a
second declaration that drifts, and the drift is invisible until someone saves.

## Decide what the model is for, then keep it there

The agent is good at **judgement**: which resource is meant, which fields matter,
what to call them, whether a confirmation belongs on screen.

It is unreliable at **carrying data**: an identifier, a listing, an exact value.
Every time we asked it to, it eventually failed — inventing ids, dropping
required props, transcribing plausible-but-wrong values.

So: the agent chooses **which** operation; the browser knows **where** it lives
and does the fetching and the writing. Nothing destructive happens without a
button press, and no row on screen can be a record the model imagined.

## Boundaries need enforcing, not documenting

Three apps that "don't import each other" is a sentence. `pnpm boundaries` is a
fact, and it caught things a person would not:

- a stray npm package installed by a code generator
- a dependency arriving without anyone deciding it should

Three separate `package.json` files did more than the check, though: a manifest
listing express and zod and nothing about React is documentation nobody has to
be told to read.

## Silent failure is the expensive kind

The worst hours went on failures that looked like success. A spinner is a
promise that something is still happening; prose claiming a form was drawn reads
as a working feature.

Two habits paid for themselves repeatedly:

1. **Run a control.** Before blaming your own code, prove the library does the
   thing at all in isolation.
2. **Read the source, not the docs.** These are 0.0.x and 1.x packages. Every
   significant finding here came from reading uncompiled source in
   `node_modules`, not from documentation.

And when a guard is added, make it fail once on purpose. A check nobody has seen
fail is a check nobody should trust.

## Write the failures down as they happen

A negative result is only worth something if it is recorded while the detail is
fresh. Half of `findings.md` would have been lost to "we tried that once and it
didn't work."

One finding was later **disproved and withdrawn**. Keeping it visible, rather
than deleting it, is what makes the rest credible.

## The UI conventions that mattered

Small things, each of which was wrong first:

- A rejected form must stay editable. Disabling it on the agent's error message
  meant retyping everything.
- A saved form should stop being a form — a heading above a confirmation reads
  as unfinished work.
- Surfaces from earlier turns should go inert. Acting on a stale table is doing
  the right thing to the wrong version of the world.
- A record that does not exist is ordinary. Muted text, not red.
