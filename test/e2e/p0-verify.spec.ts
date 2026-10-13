/**
 * E2E · P0 验证 · P0 verification
 *
 * @description 验证 P0-1：3D 专辑封面改为请求缩略图（_thumb.jpg）且成功加载（无破图）。
 *              P0-2（本地化派生共享）已由单元测试覆盖，此处仅做封面行为回归。
 *
 *              Verifies P0-1: the 3D album cover now requests the 600px thumbnail and loads without broken images.
 */
import { expect, test } from '@playwright/test'
import { E2E_BASE_URL } from './fixtures/e2e-env'

test.describe('P0-1 验证：3D 专辑封面使用缩略图', () => {
  test('封面请求 _thumb 且无破图', async ({ page }) => {
    await page.goto(E2E_BASE_URL + '/')
    const cover = page.locator('.album-cover-img').first()
    await expect(cover, '3D 专辑封面应可见').toBeVisible({ timeout: 30_000 })

    const src = await cover.getAttribute('src')
    expect(src, '3D 封面应请求缩略图 _thumb.jpg').toContain('_thumb.jpg')

    // 缩略图（或其 @error 回退原图）为异步加载，加载完成前 naturalWidth 可能为 0；
    // 轮询等待真正加载完成，避免「读取过早」导致的假失败。
    // The thumbnail (or its @error fallback to the raw poster) loads asynchronously —
    // poll until the bitmap is decoded rather than reading naturalWidth too early.
    await expect
      .poll(
        async () => cover.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        { timeout: 15_000, message: '封面缩略图应成功加载（无破图）' }
      )
      .toBeGreaterThan(0)
  })
})
