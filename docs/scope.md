# Scope

## The question

Can a web app generate its forms from the API it posts to, so that adding a
field to the backend adds it to the form with nothing else edited?

And can that be driven by a conversation — "I want to add a user" — rather than
by routes and screens built in advance?

## What was built

A chat with no forms in it. You say what you want to do; an agent reads the
API's own schema over HTTP, decides which fields are needed, and renders a form
in shadcn/ui. Submitting posts to the real API and shows field-level errors on
the inputs they belong to.

Both resources — `users` and `projects` — support the full CRUD cycle, driven
either from the conversation or from row actions in a rendered table.

## In scope

- Forms derived from a live API's validation schema, never hand-written
- Full CRUD on two resources, one with a foreign-key reference to the other
- Custom **shadcn/ui** components rendered through A2UI, not A2UI's own widgets
- Three separate apps — browser, agent runtime, backend — meeting only over HTTP
- A written record of what these libraries actually do

## Out of scope

- Authentication and authorisation. There is no principal to authenticate, and
  a login here would be theatre.
- Persistence. Storage is in memory; restarting the backend resets it.
- Production hardening: rate limits, auditing, multi-tenancy, migrations.
- Adversarial input. Not tested — see `verdict.md`.

## How to judge it

The claim is that no part of the system holds a second copy of the field list.
The check is mechanical:

```bash
pnpm boundaries   # no cross-app imports, no undeclared deps, no field names in the agent
```

And visible at runtime: the backend logs `GET /api/schema/users` mid-conversation,
before any form appears.
