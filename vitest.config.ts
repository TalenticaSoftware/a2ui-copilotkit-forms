import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Tests import from both halves — the contract and the browser's renderer — so
 * they need the same aliases the app uses.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './apps/web/src') },
  },
  test: {
    /**
     * Ours only.
     *
     * One runner for all three apps, so `pnpm test` at the root means what it
     * says. `reference/portal-lite` is a whole other app in this tree with its
     * own runner (node:test); picked up by a bare default glob it fails the
     * build here, which says nothing about either app.
     */
    include: ['apps/*/src/**/*.test.{ts,tsx}', 'boundaries.test.ts'],
    /**
     * The catalog reaches CopilotKit now, and CopilotKit ships a stylesheet.
     * Left external, Node's ESM loader is handed a `.css` file and refuses it;
     * inlined, Vite transforms it the way the browser build already does.
     */
    server: { deps: { inline: [/@copilotkit/] } },
  },
})
