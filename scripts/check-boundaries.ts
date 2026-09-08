import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * The three apps may only meet over HTTP.
 *
 * In production they are separate repositories; here they share a workspace,
 * and this is what stops that convenience turning into coupling. Run by
 * `pnpm check`.
 */

const root = path.resolve(import.meta.dirname, '..')
const SKIP = new Set(['node_modules', 'dist', '.vite'])

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry)) found.push(full)
  }
  return found
}

/**
 * Read line by line, not with one regex over the file: a bare `from '…'` also
 * matches prose inside a description, and this codebase writes no semicolons,
 * so "up to the next `;`" is the rest of the file.
 */
function importsOf(file: string): string[] {
  const found: string[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!/^\s*(?:import|export|\})/.test(line)) continue
    const viaFrom = line.match(/\sfrom\s*['"]([^'"]+)['"]/)
    if (viaFrom) {
      found.push(viaFrom[1]!)
      continue
    }
    const sideEffect = line.match(/^\s*import\s*['"]([^'"]+)['"]/)
    if (sideEffect) found.push(sideEffect[1]!)
  }
  return found
}

/** "@scope/pkg/deep" → "@scope/pkg". Relative and node: builtins are not packages. */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('@/')) return null
  if (specifier.startsWith('node:')) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

/** What each app may import. A manifest says what is installed; this says what was intended. */
const allowed: Record<string, string[]> = {
  api: ['express', 'cors', 'zod', 'zod-to-json-schema', 'dotenv'],
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

/**
 * A field list pasted into the system prompt would pass both checks above while
 * making the agent's discovery a fiction.
 */
const resourceVocabulary = [
  'fullName',
  'sendInvite',
  'createUserSchema',
  'ownerId',
  'createProjectSchema',
]

const failures: string[] = []

for (const app of Object.keys(allowed)) {
  const files = sourceFiles(path.join(root, 'apps', app))

  for (const file of files) {
    const where = path.relative(root, file)

    for (const specifier of importsOf(file)) {
      if (forbidden[app]!.test(specifier)) {
        failures.push(`${where} reaches into another app: ${specifier}`)
      }
      const name = packageOf(specifier)
      if (name && !allowed[app]!.includes(name)) {
        failures.push(`${where} imports ${name}, which apps/${app} does not declare`)
      }
    }

    if (app === 'runtime') {
      const source = readFileSync(file, 'utf8')
      for (const word of resourceVocabulary) {
        if (source.includes(word)) failures.push(`${where} names a resource field: ${word}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Boundary violations:\n')
  for (const failure of [...new Set(failures)]) console.error(`  ${failure}`)
  process.exit(1)
}

console.log('Boundaries hold: no cross-app imports, no undeclared dependencies, no leaked field names.')
