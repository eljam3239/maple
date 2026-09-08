import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Component tests need a DOM; the pure-logic ones are happy either way.
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
      setupFiles: ['./test/setup.ts'],
      coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'] },
    },
  }),
)
