import { z, type ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * The API, described.
 *
 * The premise: this server already knows every field it will accept, because it
 * validates against a zod schema before any logic runs. Publishing that first
 * declaration is what lets a client stop keeping a second one by hand — two
 * declarations of one fact drift, and the drift is invisible until someone
 * tries a save.
 *
 * The shape below is copied from Portal-Lite's `core/describe.ts` on purpose.
 * Same field names, same nesting. A descriptor format that differs per backend
 * is not a format.
 */

export type OperationDescriptor = {
  /** Stable name for this operation, e.g. "create". The client asks for it by this. */
  key: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** May contain `:name` segments, described by `params`. */
  path: string
  /** A one-line summary, for an agent choosing between operations. */
  summary: string
  /** JSON Schema of the `:name` segments in `path`. Absent when there are none. */
  params?: unknown
  /** JSON Schema of the accepted body. Absent for operations that take none. */
  body?: unknown
  /**
   * JSON Schema of what comes back on success, under `data`.
   *
   * Added because a client that renders a LIST has to know the shape of what it
   * is listing, and the alternative is assuming — which is the same mistake as
   * hand-copying the request shape, one direction later (A2).
   */
  returns?: unknown
}

export type ReferenceDescriptor = {
  /** The resource whose ids are valid here. */
  resource: string
  /** Which property of that resource to SHOW, where the id is what is stored. */
  label: string
}

export type ResourceDescriptor = {
  resource: string
  operations: OperationDescriptor[]
  /**
   * Properties that point at another resource, keyed by property name.
   *
   * A reference cannot be an enum: the valid values are whatever rows exist
   * right now. Saying so here lets a client fill the dropdown from the other
   * resource's `list` — options discovered at render time, without the data
   * passing through a language model on the way.
   */
  references?: Record<string, ReferenceDescriptor>
  /**
   * How this API reports failure. One shape for every operation.
   *
   * Published rather than agreed in prose. `src/lib/api.ts` used to reach into
   * `payload?.error?.fields` on faith, so a change to the envelope degraded to
   * a bare status code with every per-field message dropped, silently. Now the
   * envelope is part of the contract the client fetches.
   */
  errors: unknown
}

/**
 * The failure envelope, declared once.
 *
 * `fields` is keyed by the BODY PROPERTY the message belongs to — not by a UI
 * path, which the API knows nothing about. Turning a property name into
 * somewhere on screen is the client's job.
 */
export const errorSchema = z.object({
  message: z.string().describe('One line, written for a person to read.'),
  fields: z
    .record(z.string())
    .optional()
    .describe('Per-field messages, keyed by the body property each one is about.'),
})

/**
 * zod to JSON Schema, inlined.
 *
 * `$refStrategy: 'none'` because the reader is a language model composing a
 * form, not a validator: a `$ref` pointing into `definitions` is one more hop
 * for it to get wrong, and these schemas are small enough that inlining costs
 * nothing.
 *
 * We reach for this package rather than zod's own `z.toJSONSchema` because that
 * arrived in zod 4, and this project is pinned to zod 3 — A2UI's binder reads
 * `_def.typeName` to classify props, which zod 4 does not set (F25).
 */
export const json = (schema: ZodType) => zodToJsonSchema(schema, { $refStrategy: 'none' })

/** The published error envelope, the same for every resource. */
export const errors = json(errorSchema)
