import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Tests import from both halves — the contract and the browser's renderer — so
 * they need the same aliases the app uses.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    /**
     * Ours only.
     *
     * `reference/portal-lite` is a whole other app that lives in this tree now,
     * with its own runner (node:test) and its own suite. Picked up by a bare
     * default glob it fails the build here, which says nothing about either app.
     */
    include: ['{src,server,api}/**/*.test.{ts,tsx}', 'boundaries.test.ts'],
  },
})
