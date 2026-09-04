# Architecture review

Written at the point the write path first worked end to end (`60971d5`), before
the resources multiplied. Findings are ranked by what they cost, not by how hard
they are to fix.

`findings.md` next door records what the libraries do. This file records what
**we** built, and where it is weaker than it looks.

---

## What holds

The `derive, never duplicate` spine is real. `createUserSchema` is validated
against and published from one declaration, and `api/users.test.ts` asserts the
descriptor matches it field-for-field and required-for-required.

`boundaries.test.ts` checks names as well as imports. That is the right
instinct: a field list pasted into the system prompt would pass an import check
while making the agent's discovery a fiction.

Neither of those is affected by anything below.

---

## A1 — The request body is held together by a sentence in the prompt

**Severity: high. Undermines the central claim.**

`values()` in `SubmitButtonRenderer` posts whatever the data model root happens
to contain, and that shape is decided entirely by JSON pointers the *agent*
chose. The only thing tying them to the API's field names is a line of English
in `server/prompt.ts`:

> Bind each input to a path named after its property — an "email" property binds
> to "/email"

Bind `/user/email` instead and the body is silently wrong-shaped.

The same coupling breaks error display, and there it fails silently:

```
API says:      fields: { email: "..." }
button writes: /_errors/email       ← "/_errors/" + fieldName
input reads:   /_errors + /email    ← "/_errors" + bindingPath
```

Those agree only when `path === "/" + fieldName`. Any nesting and the message
lands in a slot nothing is subscribed to. No error, no log, the input looks fine.

**Direction:** stop trusting the pointer. The button already fetches the
descriptor; map by field name, or validate the assembled body against the
published schema before posting and refuse with a real message. Prompt text is
not a contract.

## A2 — We derived the request shape and hand-wrote the error shape

**Severity: high. Same root cause as A1.**

`{ error: { message, fields } }` is declared in `api/users.ts` and re-parsed in
`src/lib/api.ts` as `payload?.error?.fields ?? {}` — a second hand-maintained
copy of a fact across an HTTP boundary, which is exactly what the descriptor
exists to abolish. The optional chaining means a change to the error shape
degrades to a bare "The API answered 422." with every field message dropped, and
nothing fails.

The descriptor describes request bodies and not responses. That asymmetry is the
gap, and the read direction cannot be built cleanly on top of it: rendering a
list means knowing the shape of what comes back.

**Direction:** the descriptor carries responses too — success and error — and
both clients read them rather than assuming.

## A3 — A form that saves nothing looks identical to one that saves

**Severity: high. Cheap to fix.**

`submit` is optional. Omit it and `fire()` falls through to dispatching
`form_submitted` to the agent, which the prompt has told "you are told what the
API answered" — so it will plausibly narrate a confirmation for a write that
never happened.

This is the failure mode already named as the worst one: it looks finished. It
is back in a subtler form, because the fabricated confirmation is now
indistinguishable from a real one.

**Direction:** if `submit` is absent, say so on the button, or name it in the
dispatched event so the agent cannot narrate a save.

## A4 — The write path has no tests

**Severity: medium. Do it after A1, which changes what there is to test.**

| covered | not covered |
| --- | --- |
| descriptor ↔ schema (5) | `src/lib/api.ts`, every line |
| boundaries (3) | the `POST /users` handler — 422, dedupe, 201 |
| catalog shape (6) | the `_errors` round trip |

`users.test.ts` tests `describeUsers()` and never mounts the router. The newest
and most intricate code is the untested code.

---

## Lower severity, recorded so they are not rediscovered

- **`SubmitButtonRenderer` is a controller in a leaf's clothing** — busy, notice
  and shown state, body assembly, error fan-out, dispatch. Justified: A2UI ships
  no seam for this (see `findings.md`). But two submit buttons in one form would
  be two controllers with no shared state.
- **`_errors` collision** is acknowledged in a comment and unguarded. A field
  genuinely named `_errors` corrupts the body. Cheap to reject at the API.
- **`any` at every A2UI seam** means nothing type-checks `props.submit` against
  its definition. Deliberate — the library's own types are loose — but it is why
  A1 and A3 cannot be caught by the compiler.
- **The browser's descriptor cache** is per page load while the server sends
  `no-store`. An API that restarts with a changed schema mid-session is posted
  to on stale information.
- **No auth, open CORS, in-memory storage.** Deliberate for a POC and stated in
  `api/index.ts`. Named here so nobody reads this as production-shaped.

---

## Order

A1 and A2 are one fix: a contract carried by convention instead of by the
descriptor. Doing them before the read direction means read inherits a real
contract rather than a second set of conventions. Then A3, then A4.
