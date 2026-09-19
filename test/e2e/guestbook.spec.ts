/**
 * E2E · 留言板 · Guestbook
 *
 * 覆盖点
 *  - 结构与数据：标题「留言板」、主留言按 fixture 渲染、最新留言排在最前
 *  - 回复折叠：>3 条时默认显示 3 条 + 「更多」，每次点击追加 10 条（3 → 13 → 15），展开完自动消失
 *  - 回复表单：新增邮箱输入与表情选择（点击表情插入到回复内容）
 *  - 校验：邮箱格式非法时显示站内提示并前端拦截（主表单 novalidate，不弹浏览器原生气泡）
 *  - 安全：留言 / 回复中的脚本与事件载荷以纯文本渲染，不执行
 *
 * 依赖 fixture（test/e2e/fixtures/seed-e2e-db.mjs）：
 *  · 主留言 1：15 条回复   · 主留言 2：2 条回复
 *  · 主留言 3：无回复      · 主留言 4：内容与回复含 XSS 载荷
 *
 * 说明：本 spec 只做读断言，不发写请求（非法邮箱用例也由前端拦截），不污染 fixture 库。
 */
import { expect, test, type Page } from '@playwright/test'
import { gotoHome } from './helpers'

/** fixture 主留言 id · fixture message ids */
const MSG_MANY_REPLIES = 1 // 15 条回复
const MSG_TWO_REPLIES = 2 // 2 条回复（不超过 3）
const MSG_NO_REPLY = 3 // 无回复
const MSG_XSS = 4 // 内容 / 回复含脚本载荷

/** 回复折叠步长（与 index.vue 的 REPLY_INITIAL / REPLY_STEP 对应）· reply paging steps */
const REPLY_INITIAL = 3
const REPLY_STEP = 10

/** 定位某条主留言卡片 · locate a message card by fixture id */
function card(page: Page, gid: number) {
  return page.locator(`#guestbookSection .gb-message-card[data-gid="${gid}"]`)
}

test.describe('GB · 留言板结构与数据渲染', () => {
  test('标题与主留言按 fixture 渲染，最新留言排在最前', async ({ page }) => {
    await gotoHome(page, '/')

    const section = page.locator('#guestbookSection')
    await expect(section).toBeVisible()
    await expect(section.locator('.gb-title')).toContainText('留言板')

    await expect(section.locator('.gb-message-card')).toHaveCount(4)
    // 主留言按 created_at DESC → 最新（id=1）排在最前
    await expect(section.locator('.gb-message-card').first()).toHaveAttribute('data-gid', '1')

    const first = section.locator('.gb-message-card').first()
    await expect(first.locator('.gb-message-text')).not.toBeEmpty()
    await expect(first.locator('.gb-message-meta')).toContainText('Alice')
  })
})

test.describe('GB · 回复折叠与「更多」分页', () => {
  test('超过 3 条：默认 3 条 + 「更多」，每次点击追加 10 条，展开完自动消失', async ({ page }) => {
    await gotoHome(page, '/')

    const c = card(page, MSG_MANY_REPLIES)
    const replies = c.locator('.gb-reply-item')
    const more = c.locator('.gb-reply-more')

    await expect(replies).toHaveCount(REPLY_INITIAL)
    await expect(more).toBeVisible()

    // 第一次点击：3 → 13，仍有「更多」
    await more.click()
    await expect(replies).toHaveCount(REPLY_INITIAL + REPLY_STEP)
    await expect(more).toBeVisible()

    // 第二次点击：13 → 15（显示完全部），「更多」消失
    await more.click()
    await expect(replies).toHaveCount(15)
    await expect(more).toHaveCount(0)
  })

  test('不超过 3 条：全部显示且不出现「更多」', async ({ page }) => {
    await gotoHome(page, '/')

    const c = card(page, MSG_TWO_REPLIES)
    await expect(c.locator('.gb-reply-item')).toHaveCount(2)
    await expect(c.locator('.gb-reply-more')).toHaveCount(0)
  })

  test('无回复：不渲染回复区', async ({ page }) => {
    await gotoHome(page, '/')

    const c = card(page, MSG_NO_REPLY)
    await expect(c.locator('.gb-reply-list')).toHaveCount(0)
    await expect(c.locator('.gb-reply-more')).toHaveCount(0)
  })
})

test.describe('GB · 回复表单（邮箱 + 表情）', () => {
  test('展开回复表单：含昵称/邮箱/内容三个输入与表情按钮，表情可插入内容', async ({ page }) => {
    await gotoHome(page, '/')

    const c = card(page, MSG_TWO_REPLIES)
    await c.locator('.gb-reply-toggle').click()
    const form = c.locator('.gb-reply-form')
    await expect(form).toHaveClass(/show/)

    // 新增：邮箱输入框（type=email），三个输入框
    await expect(form.locator('input[type="email"]')).toBeVisible()
    await expect(form.locator('.gb-input-sm')).toHaveCount(3)

    // 表情：面板默认收起 → 点击按钮展开 → 点击某表情插入内容并收起
    const panel = form.locator('.gb-emoji-panel')
    await expect(panel).toBeHidden()
    await form.locator('.gb-emoji-btn').click()
    await expect(panel).toBeVisible()

    const emoji = (await panel.locator('.gb-emoji-item').first().innerText()).trim()
    await panel.locator('.gb-emoji-item').first().click()
    await expect(panel).toBeHidden()
    // 回复内容为第二个 type=text 输入（第一个是昵称）
    await expect(form.locator('input[type="text"]').nth(1)).toHaveValue(emoji)
  })

  test('非法邮箱：显示站内错误提示且不发请求（前端拦截）', async ({ page }) => {
    await gotoHome(page, '/')

    let posts = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/guestbook/reply')) posts += 1
    })

    const c = card(page, MSG_TWO_REPLIES)
    await c.locator('.gb-reply-toggle').click()
    const form = c.locator('.gb-reply-form')

    await form.locator('input[type="text"]').first().fill('Tester')
    await form.locator('input[type="email"]').fill('not-an-email')
    await form.locator('input[type="text"]').nth(1).fill('hello')
    await form.locator('button.gb-btn').click()

    await expect(form.locator('.gb-form-error')).toBeVisible()
    await expect(form.locator('.gb-form-error')).toContainText('邮箱')
    expect(posts, '非法邮箱应在前端被拦截，不应发起请求').toBe(0)
  })
})

test.describe('GB · 主留言表单校验', () => {
  test('表单启用 novalidate，非法邮箱显示站内提示而非浏览器原生气泡', async ({ page }) => {
    await gotoHome(page, '/')

    const form = page.locator('form.gb-submit-card')
    // novalidate：关闭浏览器原生校验 UI（避免系统提示气泡）
    expect(await form.getAttribute('novalidate')).not.toBeNull()

    await form.locator('input[type="text"]').first().fill('Tester')
    await form.locator('input[type="email"]').fill('bad-email')
    await form.locator('.gb-input-content').fill('hello')
    await form.locator('button[type="submit"]').click()

    await expect(form.locator('.gb-form-error')).toBeVisible()
    await expect(form.locator('.gb-form-error')).toContainText('邮箱')
  })
})

test.describe('GB · UGC 文本渲染安全', () => {
  test('留言与回复中的脚本/事件载荷以纯文本渲染，不执行', async ({ page }) => {
    await gotoHome(page, '/')

    const c = card(page, MSG_XSS)
    // 内容以纯文本呈现（字面显示 <script>），且未生成真正的 script / img 元素
    await expect(c.locator('.gb-message-text')).toContainText('<script>')
    await expect(c.locator('.gb-message-text script')).toHaveCount(0)
    await expect(c.locator('.gb-reply-item img')).toHaveCount(0)

    const injected = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      return { gb: w.__xssGb ?? null, reply: w.__xssGbReply ?? null }
    })
    expect(injected.gb, '留言内容中的 <script> 被执行').toBeNull()
    expect(injected.reply, '回复内容中的 onerror 被执行').toBeNull()
  })
})
