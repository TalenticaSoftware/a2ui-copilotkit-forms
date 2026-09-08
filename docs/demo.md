# Demo script

Two to three minutes, three prompts. The point to land is that **nobody wrote
these forms** — they come from the API's own schema, and you can watch it happen.

## Before you start

```bash
pnpm dev:all
```

Arrange two windows side by side:

- **left** — the browser at http://localhost:5174
- **right** — the terminal, so the `[api]` log lines are visible

Send one throwaway prompt first and discard it. The first run of a session is
the slowest, and a cold start is not what you want people watching.

The timings below assume a warm, unthrottled key — each prompt is two or three
model calls, and on this stack that has ranged from ten seconds to several
minutes. Rehearse on the machine and network you will present from.

Seed data is `Ada Okonkwo` and `Bo Lindqvist`, plus one project, `Website
refresh`. Restarting the backend resets it.

---

## 0:00 — Open on the empty chat

> "This is an admin tool for an API with users and projects. There are no
> screens in it. No form components, no routes. Just a chat."

---

## 0:15 — Prompt 1: a form nobody wrote

Type:

```
I want to add a user
```

While it thinks, point at the **terminal**:

> "Watch the log, not the chat."

Two lines appear before anything is drawn:

```
[api] GET /api/schema            → 200
[api] GET /api/schema/users      → 200
```

> "It just asked the API what a user is. It didn't know a moment ago."

Then the form appears.

> "A name, an email, a role, and 'Email them an invitation now'. Four fields —
> exactly what the backend validates. That last one is the tell: nobody asking
> for a user form imagines that field. It came from the schema.
>
> The help text under each input is the schema's own description. The Role
> dropdown is its enum. And every pixel is shadcn/ui — our components, not the
> library's."

---

## 1:00 — Prompt 2: it saves, and it argues back

Fill in the name **and pick a role**, then type a **bad email** —
`not-an-email`. Leaving the role blank works too, but you get two errors instead
of one, and one is a cleaner story.

Press **Add User**.

> "That's the real API rejecting it. The message landed on the email field, not
> in a banner — because the error came back keyed by field."

Fix the email, press the button again.

> "And the form stayed editable while it complained — you correct it in place,
> you don't start again."

> "Saved. The card stops being a form."

---

## 1:45 — Prompt 3: the same trick, read and delete

Type:

```
Show me the projects
```

> "Same idea in the other direction. The agent chose the columns; the browser
> fetched the rows — so a listing of any size costs nothing, and nothing on
> screen can be a record the model invented.
>
> Owner shows a name. It's stored as an id, and the API's descriptor says which
> field to display instead."

Press **Delete** on the row.

> "That posts a normal message — 'Delete Website refresh' — and the agent
> answers with a confirmation. Nothing destructive happens straight from a
> table row, and the agent can only ask. The browser does every write."

Press **Delete project**.

---

## 2:30 — Close

> "Three prompts, no screens. Add a field to the backend's schema and the form
> grows one, with nothing else edited anywhere.
>
> It's a proof of concept — `docs/verdict.md` says where this fits and where it
> doesn't."

---

## If something goes wrong

**Nothing renders and the skeleton stays.** Almost always the model, not the
app. Open the browser console: an `INCOMPLETE_STREAM` error means a quota or
rate limit. Say so and move on — silent failure is itself a finding, and
`docs/findings.md` documents it.

**It is slower than you expect.** Each prompt is two or three model calls. On a
throttled key that is minutes, not seconds. Test on the machine and network you
will present from, the same day.

**It renders something odd.** It is a language model; the same request can
produce different labels. Do not fight it live — note it and carry on.

## If you only have 60 seconds

Prompt 1 alone. The form appearing next to `GET /api/schema/users` in the log is
the entire argument; everything else is elaboration.
