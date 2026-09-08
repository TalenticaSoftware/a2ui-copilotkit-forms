# Advantages, use cases, and alternatives

## What this approach buys

**One declaration.** Add a field to the API's schema and the form grows one,
with nothing else edited. No DTO, no form component, no validation rules copied
into the client.

**Screens you never had to build.** There is no `/users/new` route. The
conversation covers create, read, update and delete for every resource the API
describes — including ones added after the client shipped.

**A UI that cannot lie.** The agent decides a table belongs and picks its
columns; the browser fetches the rows. Nothing on screen is a record the model
imagined, and a listing of any size costs no tokens.

**Real components.** Every pixel is shadcn/ui that you own and can restyle.

## What it costs

**Latency.** Three model calls before a form appears: list resources, describe
one, render. Seconds, not milliseconds — and on a throttled key, minutes.

**Non-determinism.** The same request can produce different labels, different
column choices, occasionally a different component. Acceptable for internal
tools; not for a checkout.

**Per-request cost.** Every form costs tokens. A hand-built form costs nothing
to render for the millionth time.

**Immature dependencies.** A2UI is v0.9 and `web_core` is 0.0.x. Most of
`findings.md` is undocumented behaviour found by reading source.

**A new failure mode.** Things fail silently, in ways your existing monitoring
will not catch.

## Compared with the alternatives

| Approach | Adding a field | Latency | Predictable | Effort |
| --- | --- | --- | --- | --- |
| Hand-built forms | edit 3–4 places | none | total | high, forever |
| Schema-driven forms (JSON Schema → renderer) | edit 1 place | none | total | moderate, once |
| **This: agent + generative UI** | edit 1 place | seconds | no | moderate, plus a research bill |
| Low-code / admin generators | edit 1 place | none | total | low, until you need something custom |

**Schema-driven form renderers** — RJSF, Formily, or a hand-rolled
descriptor→component mapper — deserve the honest comparison, because they get
most of the benefit. They derive the same forms from the same schema with no
model in the loop: instant, deterministic, cheap.

What they cannot do is decide *which* form you meant from a sentence, choose
sensible labels and columns for a resource nobody has styled, or handle a
resource added yesterday with no client work. That is the whole of the delta,
and whether it is worth it depends on the next section.

**Note:** this project uses the schema-driven approach *underneath* the agent.
That is not an accident. The agent decides what to show; the descriptor decides
what the fields are. If you removed the agent you would still have a working
schema-driven form layer.

## Where it fits

**Good fit**

- Internal admin and back-office tools over many resources
- Long-tail CRUD nobody will fund bespoke screens for
- Systems whose schema changes often, or is defined per tenant
- Exploratory interfaces: "show me the projects Ada owns"

**Poor fit**

- Anything high-frequency or latency-sensitive
- Regulated or high-stakes flows needing byte-identical rendering
- Public, unauthenticated surfaces
- A handful of stable, heavily-designed forms — hand-build them
