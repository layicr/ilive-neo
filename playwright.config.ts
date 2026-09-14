/**
 * Playwright E2E 配置 · Playwright end-to-end configuration
 *
 * 要点 · Key points
 *  - 串行执行（fullyParallel: false + workers: 1）：与 vitest 单测互斥，避免同批并行抢资源。
 *    Serial execution — never run in parallel with vitest in the same batch.
 *  - webServer 启动命令先执行 seed 脚本，把「E2E 专用测试库」重置为确定性 fixture 数据（见 test/e2e/fixtures/），
 *    再启动 dev server 并通过 NUXT_TURSO_DATABASE_URL 把服务端指向该库；真实库 public/data/data.db 全程只读。
 *    The webServer command seeds a dedicated fixture DB first, then boots the dev server which reads it
 *    via NUXT_TURSO_DATABASE_URL.
 *  - 桌面用例走 chromium-desktop；移动端用例（mobile-responsive.spec.ts）走 chromium-mobile（Pixel 5，真实触摸）。
 */
import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE_URL, E2E_DB_FILE, E2E_DB_URL, E2E_PORT } from './test/e2e/fixtures/e2e-env'

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // dev 模式首次编译 + 客户端 hydration 较慢：整体放宽超时，避免「未水合即点击」导致的假失败
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'test/report/e2e-playwright.json' }],
    ['html', { outputFolder: 'test/report/e2e-html', open: 'never' }],
  ],
  outputDir: 'test/report/e2e-artifacts',
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'zh-CN',
    // 关闭 Chromium 自动播放限制：避免背景音乐 play() 被策略拒绝而刷出 console error 噪声
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    // dev 模式下路由首次编译可能超过 20s（表现为 page.goto 超时），放宽到 45s
    navigationTimeout: 45_000,
  },
  // 桌面 + 移动双 project：移动端 spec 由 Pixel 5（isMobile + hasTouch）独占运行
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /mobile-responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      testMatch: /mobile-responsive\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  // 预启动 dev 服务器（测试前自动起 nuxt dev，端口占用则复用）· spin up dev server before tests
  webServer: {
    // 先重置 fixture 库、再启动 dev server：顺序执行，避免两个进程并发写同一 SQLite 文件
    command: `node test/e2e/fixtures/seed-e2e-db.mjs && npx nuxt dev --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // 测试库隔离：dev server 只读 E2E fixture 库，绝不触碰 public/data/data.db
    env: { E2E_DB_FILE, NUXT_TURSO_DATABASE_URL: E2E_DB_URL },
  },
})
