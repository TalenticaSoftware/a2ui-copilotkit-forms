import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The three apps must only meet over HTTP.
 *
 * `apps/api` is the backend, `apps/runtime` is the agent, `apps/web` is the
 * browser. In production those are separate repositories. Here they share a
 * workspace for convenience, and convenience is exactly how a boundary rots:
 * one `import` from the runtime into the API's schemas would make the whole
 * demonstration circular — a form "derived from the API" by an agent that was
 * handed the source of truth directly.
 *
 * Each app's package.json now says what it may depend on, which is the first
 * line of defence and the one a person reads. This file is the second: a
 * manifest says what is ALLOWED, and these tests say what is actually there.
 */

const root = import.meta.dirname
const appDir = (app: string) => path.join(root, 'apps', app)

/**
 * OUR files. `node_modules` is skipped explicitly: pnpm links one into every
 * package, so a walker that does not exclude it ends up auditing the
 * dependencies of our dependencies — thousands of files, and every one of them
 * a false positive.
 */
const SKIP = new Set(['node_modules', 'dist', '.vite'])

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) found.push(full)
  }
  return found
}

/**
 * Every module specifier in a file, from static imports and `export … from`.
 *
 * Read line by line rather than by one regex over the source, and that is not
 * fussiness. Matching a bare `from '…'` anywhere also matches PROSE — a
 * component description reading "an enum from " + "the schema" parses as an
 * import of " + " and fails the suite over a sentence. Widening the pattern to
 * a whole statement does not help either: this codebase writes no semicolons,
 * so "up to the next `;`" is "the rest of the file".
 *
 * A line that starts an import, or closes a multi-line one, is unambiguous.
 */
function importsOf(file: string): string[] {
  const found: string[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!/^\s*(?:import|export|\})/.test(line)) continue

    // `import x from 'y'`, `export { x } from 'y'`, or a multi-line `} from 'y'`.
    const viaFrom = line.match(/\sfrom\s*['"]([^'"]+)['"]/)
    if (viaFrom) {
      found.push(viaFrom[1]!)
      continue
    }

    /*
      `import 'y'` — a side effect, no bindings and no `from`. Matched only when
      the line IS the import: `export const json = … 'none'` also starts with a
      keyword, and reading its last string made 'none' look like a package.
    */
    const sideEffect = line.match(/^\s*import\s*['"]([^'"]+)['"]/)
    if (sideEffect) found.push(sideEffect[1]!)
  }
  return found
}

/** Just the package name: "@scope/pkg/deep" → "@scope/pkg", "node:fs" → "node:fs". */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('@/')) return null
  if (specifier.startsWith('node:')) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

/**
 * What each app is allowed to reach for.
 *
 * Kept deliberately explicit rather than read from the manifests. A manifest
 * lists what was INSTALLED; this lists what was intended, and the interesting
 * failure is a dependency that arrived without anyone deciding it should. The
 * lists disagreeing is the signal.
 */
const allowed: Record<string, string[]> = {
  api: ['express', 'cors', 'zod', 'zod-to-json-schema', 'dotenv', 'vitest'],
  runtime: ['@copilotkit/runtime', 'express', 'cors', 'zod', 'dotenv'],
  web: [
    'react',
    'react-dom',
    '@copilotkit/react-core',
    '@copilotkit/a2ui-renderer',
    '@base-ui/react',
    'lucide-react',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'zod',
    'vitest',
    // Build tooling. Only the browser has a bundler, so only it may name one.
    'vite',
    '@vitejs/plugin-react',
    '@tailwindcss/vite',
  ],
}

/** Reaching into another app's source, by any route. */
const forbidden: Record<string, RegExp> = {
  api: /(^|\/)(\.\.\/)*apps\/(runtime|web)\//,
  runtime: /(^|\/)(\.\.\/)*apps\/(api|web)\/|^@\//,
  web: /(^|\/)(\.\.\/)*apps\/(api|runtime)\//,
}

describe('boundaries', () => {
  for (const [app, pattern] of Object.entries(forbidden)) {
    it(`apps/${app} reaches its neighbours only over HTTP`, () => {
      const offenders = sourceFiles(appDir(app)).flatMap((file) =>
        importsOf(file)
          .filter((specifier) => pattern.test(specifier))
          .map((specifier) => `${path.relative(root, file)} imports ${specifier}`),
      )
      expect(offenders).toEqual([])
    })
  }

  /**
   * Dependencies, not just source imports.
   *
   * Splitting into three package.json files made each app's dependency list a
   * statement of what it is. This is what keeps that statement true: React
   * appearing in the backend, or express in the browser, means one of the three
   * has quietly stopped being what it claims.
   */
  for (const [app, permitted] of Object.entries(allowed)) {
    it(`apps/${app} depends only on what its manifest declares`, () => {
      const strays = sourceFiles(appDir(app)).flatMap((file) =>
        importsOf(file)
          .map(packageOf)
          .filter((name): name is string => Boolean(name) && !permitted.includes(name!))
          .map((name) => `${path.relative(root, file)} imports ${name}`),
      )
      expect([...new Set(strays)]).toEqual([])
    })
  }

  /**
   * Names, not just imports.
   *
   * An import is the obvious way to leak the API's shape into the runtime; a
   * copy-pasted field list in the system prompt is the quiet one, and it would
   * pass every check above while making the agent's "discovery" a fiction.
   */
  it('the runtime never names a field of a resource', () => {
    const vocabulary = ['fullName', 'sendInvite', 'createUserSchema', 'ownerId', 'createProjectSchema']
    const leaks = sourceFiles(appDir('runtime')).flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return vocabulary
        .filter((word) => source.includes(word))
        .map((word) => `${path.relative(root, file)} mentions ${word}`)
    })
    expect(leaks).toEqual([])
  })
})
