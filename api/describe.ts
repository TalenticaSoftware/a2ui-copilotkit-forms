import type { ZodType } from 'zod'
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
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  /** A one-line summary, for an agent choosing between operations. */
  summary: string
  /** JSON Schema of the accepted body. */
  body: unknown
}

export type ResourceDescriptor = {
  resource: string
  operations: OperationDescriptor[]
}

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
