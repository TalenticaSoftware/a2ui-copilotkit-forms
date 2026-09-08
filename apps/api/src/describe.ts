import { z, type ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * The API, described from the schemas it already validates against. Publishing
 * that first declaration is what lets a client stop keeping a second one by
 * hand — two declarations of one fact drift, invisibly, until someone saves.
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
  /** JSON Schema of what comes back under `data`. A client rendering a list needs the row shape. */
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
   * Properties holding another resource's id. A reference cannot be an enum —
   * its valid values are whatever rows exist right now — so the client fills the
   * dropdown from that resource's list.
   */
  references?: Record<string, ReferenceDescriptor>
  /** How this API reports failure — published, rather than agreed in prose and assumed. */
  errors: unknown
}

/** The failure envelope. `fields` is keyed by body property; mapping that to the screen is the client's job. */
export const errorSchema = z.object({
  message: z.string().describe('One line, written for a person to read.'),
  fields: z
    .record(z.string())
    .optional()
    .describe('Per-field messages, keyed by the body property each one is about.'),
})

/**
 * zod to JSON Schema, inlined (`$refStrategy: 'none'`): the reader is a language
 * model, not a validator, and a `$ref` is one more hop to get wrong. This package
 * rather than zod's own, because `z.toJSONSchema` is zod 4 and we are on zod 3 (F25).
 */
export const json = (schema: ZodType) => zodToJsonSchema(schema, { $refStrategy: 'none' })

/** The published error envelope, the same for every resource. */
export const errors = json(errorSchema)
