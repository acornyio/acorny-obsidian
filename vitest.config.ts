import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
  resolve: {
    alias: {
      // fileURLToPath (not URL.pathname) — on Windows .pathname yields "/C:/…" which Vite mis-resolves.
      obsidian: fileURLToPath(new URL('./test/obsidian.mock.ts', import.meta.url)),
    },
  },
})
