import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The three parts must only meet over HTTP.
 *
 * `api/` is the backend, `server/` is the agent runtime, `src/` is the browser.
 * In production those are separate repositories. Here they share a folder for
 * convenience, and convenience is exactly how a boundary rots: one `import` from
 * the runtime into the API's schemas would make the whole demonstration
 * circular — a form "derived from the API" by an agent that was handed the
 * source of truth directly.
 *
 * TypeScript will not catch it. `tsconfig.api.json` and `tsconfig.server.json`
 * are separate projects, but nothing stops a relative `../api/users` import
 * resolving anyway. So it is asserted here instead.
 */

const root = import.meta.dirname

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(root, dir))) {
    const full = path.join(root, dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(path.join(dir, entry)))
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) {
      found.push(full)
    }
  }
  return found
}

/** Every module specifier in a file, from static imports and `export … from`. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)].map((match) => match[1]!)
}

const forbidden: Record<string, RegExp> = {
  // The backend knows nothing of the agent or the browser.
  api: /(^|\/)(\.\.\/)*(server|src)\//,
  // The runtime knows nothing of the backend's schemas or the browser's catalog.
  server: /(^|\/)(\.\.\/)*(api|src)\/|^@\//,
}

describe('boundaries', () => {
  for (const [dir, pattern] of Object.entries(forbidden)) {
    it(`${dir}/ reaches its neighbours only over HTTP`, () => {
      const offenders = sourceFiles(dir).flatMap((file) =>
        importsOf(file)
          .filter((specifier) => pattern.test(specifier))
          .map((specifier) => `${path.relative(root, file)} imports ${specifier}`),
      )
      expect(offenders).toEqual([])
    })
  }

  /**
   * Names, not just imports.
   *
   * An import is the obvious way to leak the API's shape into the runtime; a
   * copy-pasted field list in the system prompt is the quiet one, and it would
   * pass the check above while making the agent's "discovery" a fiction.
   */
  it('the runtime never names a field of the users resource', () => {
    const vocabulary = ['fullName', 'sendInvite', 'createUserSchema']
    const leaks = sourceFiles('server').flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return vocabulary
        .filter((word) => source.includes(word))
        .map((word) => `${path.relative(root, file)} mentions ${word}`)
    })
    expect(leaks).toEqual([])
  })
})
