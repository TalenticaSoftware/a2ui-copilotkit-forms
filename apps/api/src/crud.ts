import { Router } from 'express'
import { z } from 'zod'
import {
  errors,
  json,
  type OperationDescriptor,
  type ReferenceDescriptor,
  type ResourceDescriptor,
} from './describe'

/**
 * One schema in, five routes and their descriptions out. Keeping the descriptor
 * derived is the point: a hand-written one drifts from the routes beside it,
 * which is the exact failure this design exists to avoid.
 */

/** What a stored record looks like: the schema's fields, plus an id. */
type Stored = Record<string, unknown> & { id: string }

export type Collection = {
  name: string
  router: Router
  describe: () => ResourceDescriptor
  /** Read access for other resources, so a reference can be checked. */
  all: () => Stored[]
  has: (id: string) => boolean
  /** Register a reason a record may not be removed. Wired from the composition root, which knows both resources. */
  guardDelete: (guard: (record: Stored) => string | null) => void
}

type Config<S extends z.ZodObject<z.ZodRawShape>> = {
  /** Plural, and the path segment: "users" → /api/users. */
  name: string
  /** Singular, for summaries a person or an agent reads. */
  singular: string
  /** The fields this resource accepts. The whole contract. */
  schema: S
  /**
   * Rules the schema cannot express — uniqueness, references to other
   * resources. Returns field-keyed messages, so a conflict reaches the person
   * on the input it is about, exactly like a validation failure.
   */
  validate?: (input: Record<string, unknown>, others: Stored[]) => Record<string, string> | null
  /** Properties that hold another resource's id. Published, so a client can offer real choices. */
  references?: Record<string, ReferenceDescriptor>
  /** Seed records, so a fresh server has something to list. */
  seed?: Array<z.input<S>>
}

/** Field-keyed errors, so the client can put each one back on the input it belongs to. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.')
    if (field && !fields[field]) fields[field] = issue.message
  }
  return fields
}

export function collection<S extends z.ZodObject<z.ZodRawShape>>(config: Config<S>): Collection {
  const { name, singular, schema, validate } = config

  /** What comes back: everything the schema accepts, plus the id we assign. */
  const record = schema.extend({ id: z.string().describe(`The ${singular}'s id.`) })
  /** A change sends only what it changes, so every field is optional. */
  const changes = schema.partial()

  const base = `/api/${name}`
  const one = `${base}/:id`

  /** Stands in for a database. Restarting the server forgets everything. */
  const records: Stored[] = []
  let sequence = 0

  const insert = (input: Record<string, unknown>): Stored => {
    sequence += 1
    const stored = { id: `${singular}_${sequence}`, ...input }
    records.push(stored)
    return stored
  }

  for (const entry of config.seed ?? []) insert(schema.parse(entry) as Record<string, unknown>)

  const operations: OperationDescriptor[] = [
    {
      key: 'list',
      method: 'GET',
      path: base,
      summary: `Every ${singular} there is.`,
      returns: json(z.array(record)),
    },
    {
      key: 'get',
      method: 'GET',
      path: one,
      summary: `One ${singular}, by id. Read this before editing, to fill the form in.`,
      params: json(z.object({ id: z.string().describe(`The ${singular} to read.`) })),
      returns: json(record),
    },
    {
      key: 'create',
      method: 'POST',
      path: base,
      summary: `Add a ${singular}.`,
      body: json(schema),
      returns: json(record),
    },
    {
      key: 'update',
      method: 'PATCH',
      path: one,
      summary: `Change an existing ${singular}. Send only the fields that change.`,
      params: json(z.object({ id: z.string().describe(`The ${singular} to change.`) })),
      body: json(changes),
      returns: json(record),
    },
    {
      key: 'delete',
      method: 'DELETE',
      path: one,
      summary: `Remove a ${singular}. This cannot be undone.`,
      params: json(z.object({ id: z.string().describe(`The ${singular} to remove.`) })),
      returns: json(z.object({ id: z.string() })),
    },
  ]

  const deleteGuards: Array<(record: Stored) => string | null> = []

  const router = Router()

  const missing = (id: string) => ({
    error: { message: `There is no ${singular} with id "${id}".` },
  })

  router.get(base, (_request, response) => response.json({ data: records }))

  router.get(one, (request, response) => {
    const found = records.find((candidate) => candidate.id === request.params.id)
    if (!found) return response.status(404).json(missing(String(request.params.id)))
    return response.json({ data: found })
  })

  router.post(base, (request, response) => {
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return response
        .status(422)
        .json({ error: { message: 'Some fields need attention.', fields: fieldErrors(parsed.error) } })
    }
    const conflicts = validate?.(parsed.data as Record<string, unknown>, records)
    if (conflicts) {
      return response.status(422).json({ error: { message: 'Some fields need attention.', fields: conflicts } })
    }
    return response.status(201).json({ data: insert(parsed.data as Record<string, unknown>) })
  })

  router.patch(one, (request, response) => {
    const index = records.findIndex((candidate) => candidate.id === request.params.id)
    if (index === -1) return response.status(404).json(missing(String(request.params.id)))

    const parsed = changes.safeParse(request.body)
    if (!parsed.success) {
      return response
        .status(422)
        .json({ error: { message: 'Some fields need attention.', fields: fieldErrors(parsed.error) } })
    }

    const updated = { ...records[index]!, ...(parsed.data as Record<string, unknown>) } as Stored
    // Everything except itself: a record keeping its own email is not a conflict.
    const others = records.filter((_, position) => position !== index)
    const conflicts = validate?.(updated, others)
    if (conflicts) {
      return response.status(422).json({ error: { message: 'Some fields need attention.', fields: conflicts } })
    }

    records[index] = updated
    return response.json({ data: updated })
  })

  router.delete(one, (request, response) => {
    const index = records.findIndex((candidate) => candidate.id === request.params.id)
    if (index === -1) return response.status(404).json(missing(String(request.params.id)))

    // Refused, not cascaded: removing records nobody named, from a chat, with no undo.
    for (const guard of deleteGuards) {
      const reason = guard(records[index]!)
      if (reason) return response.status(409).json({ error: { message: reason } })
    }

    const [removed] = records.splice(index, 1)
    return response.json({ data: { id: removed!.id } })
  })

  return {
    name,
    router,
    describe: () => ({ resource: name, operations, references: config.references, errors }),
    all: () => records,
    has: (id: string) => records.some((candidate) => candidate.id === id),
    guardDelete: (guard) => void deleteGuards.push(guard),
  }
}
