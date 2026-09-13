/**
 * Vitest 配置 · Vitest configuration
 * @description 单元测试针对纯函数（utils/config/mappers/localize），node 环境即可，
 *              无需 Nuxt SSR 运行时。Nuxt 4 起 `~`/`@` 指向 srcDir（app/），
 *              故别名需指向 app/，使 app/composables/useData 等引用的
 *              `~/locales`、`~/types` 能被解析。
 *              Unit tests target pure functions (utils/config/mappers/localize) in a plain node
 *              environment (no Nuxt SSR runtime). Since Nuxt 4 maps `~`/`@` to srcDir (app/), the
 *              aliases must point to app/ so that `~/locales` / `~/types` used by useData resolve.
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('app/', import.meta.url)),
      '@': fileURLToPath(new URL('app/', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts']
  }
})
