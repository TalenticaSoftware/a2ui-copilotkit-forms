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
})
