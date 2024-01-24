import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        // Node 22.18+ 默认 strip types；关掉才能覆盖 leftover .ts 的 ERR_UNKNOWN_FILE_EXTENSION
        execArgv: ['--no-experimental-strip-types'],
      },
    },
    server: {
      deps: {
        // 让 loadConfig 的 import(mpbuild.config.*) 走原生 Node，而不是 vite-node 转 ts
        external: [/mpbuild\.config\.(ts|mts|js|mjs)$/],
      },
    },
  },
})
