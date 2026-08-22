import { defineConfig } from 'vitest/config'

/**
 * Vitest 配置 · Vitest configuration
 * @description 单元测试针对纯函数（utils/config），node 环境即可，无需 Nuxt SSR 上下文。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts']
  }
})