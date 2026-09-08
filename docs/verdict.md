# Verdict

**The combination works.** shadcn/ui, CopilotKit, AG-UI and A2UI, end to end: a
sentence becomes a form derived from a live API's schema, and saving really
saves. Full CRUD on two resources, driven from a conversation.

**Getting there was not a matter of following documentation.** Every significant
obstacle in `findings.md` was found by reading uncompiled source in
`node_modules`. Budget for that.

## When to use it

Use it where **the schema outnumbers the screens**: internal tools over dozens
of resources, back-office CRUD nobody will fund bespoke UI for, systems whose
fields change per tenant or per week. The value is that a new resource needs no
client work at all.

Use it where **latency and non-determinism are affordable** — an operator
waiting two seconds for an admin form is fine.

## When not to

- **Customer-facing, high-frequency, or latency-sensitive flows.** Three model
  calls before a form appears.
- **Anything requiring byte-identical rendering** — regulated forms, legal
  consent, payments. The same request can produce different labels.
- **When a schema-driven renderer would do.** If you only need forms derived
  from a schema and not chosen from a sentence, use RJSF or similar: instant,
  deterministic, no tokens. See `comparison.md`.
- **When you cannot own the failure modes.** These libraries fail silently.

## Known weaknesses in this codebase

Honest list, for anyone extending it.

1. **The request body is held together by a prompt.** The POST body is whatever
   the data model contains, and the model's shape depends on JSON pointers the
   agent chose. A sentence in the system prompt is what ties them to the API's
   field names. It should be validated against the published schema before
   posting.
2. **The error envelope is hand-written on both sides.** The descriptor
   describes requests and responses; the failure shape is still agreed in prose
   and parsed with optional chaining, so a change degrades silently.
3. **A form with no `submit` target looks identical to one that saves.** It
   falls back to telling the agent, which may then narrate a save that never
   happened.
4. **A table does not know when something else changed a row.** It re-reads
   after its own delete, but an edit beside it leaves stale values on screen.
5. **Adversarial input is untested.** Record labels reach the agent's context
   through the lookup tool, so a hostile record name is untested injection
   surface. The blast radius is limited by design — the browser performs every
   write and destructive actions need a button press — but this is asserted,
   not demonstrated.

## If this went to production

Not as it stands. In order: authentication and authorisation; real persistence;
the five weaknesses above; rate limiting and cost controls on the model; and
monitoring that treats a silent non-render as an error rather than a slow
response.

## Would we do it again

For an internal tool over a wide, changing schema: yes, and the schema-derived
descriptor is worth keeping even if the agent is dropped.

For anything user-facing on today's library versions: not yet. Revisit when
A2UI reaches 1.0 and the failure modes are loud.
