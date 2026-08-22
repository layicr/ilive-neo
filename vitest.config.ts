/**
 * Vitest 配置 · Vitest configuration
 * @description 单元测试针对纯函数（utils/config/mappers/localize），node 环境即可，
 *              无需 Nuxt SSR 运行时。配置 `~`/`@` 别名，使 composables/useData 等
 *              引用的 `~/locales`、`~/types` 能被解析。
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts']
  }
})
