/**
 * Playwright E2E 配置 · Playwright end-to-end configuration
 * @description 端到端 UI 验收（见 test/e2e/ui.spec.ts）；测试前自动启动 `nuxt dev` 作为 webServer。
 *              E2E config for UI acceptance; auto-starts `nuxt dev` as the webServer before tests.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 预启动 dev 服务器（测试前自动起 nuxt dev）· spin up dev server before tests
  webServer: {
    command: 'npx nuxt dev --port 3000',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
})
