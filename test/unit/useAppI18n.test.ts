/**
 * 单元测试：useAppI18n 包装层 · App-level i18n wrapper
 *
 * @description 通过 mock `#app` 精确控制 vue-i18n 行为，覆盖：
 *              · currentLanguage 由 URL locale 驱动，locale 未就绪（undefined）时回退默认语言；
 *              · currentData 深层代理：`a.b.c` 经 t() 解析（SSR 安全），JSON.stringify / 数组迭代不误触发；
 *              · currentStoriesText 使用 tm() + rt() 解析数组型消息（含非字符串 AST 节点）；
 *              · switchLanguage 通过 useSwitchLocalePath + navigateTo 做前缀导航；initLanguage 为兼容空实现。
 *
 *              Mocks `#app` to control vue-i18n. Covers locale fallback, the deep t()-proxy (SSR-safe,
 *              no accidental t() on JSON.stringify/iteration), stories resolution via tm()+rt(), and
 *              locale switching through URL-prefix navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

/**
 * 桩：真实 useI18n.ts 以 Nuxt 自动导入的「裸标识符」使用 useI18n / useSwitchLocalePath /
 * navigateTo，不经 `#app` 模块解析，因此必须用 `vi.stubGlobal` 注入（mock '#app' 无效）。
 * The real composable consumes these as Nuxt auto-import globals (bare identifiers), so they
 * must be injected with vi.stubGlobal instead of mocking `#app`.
 */
const locale = ref<string | undefined>('zh-CN')
const navigations: string[] = []
const tCalls: string[] = []

vi.stubGlobal('useI18n', () => ({
  locale,
  t: (key: string) => {
    tCalls.push(key)
    return key
  },
  tm: (key: string) => ({ text1: [{ type: 0, source: `S1-${key}` }], text3: ['plain', { type: 0, source: 'S3' }] }),
  rt: (value: any) => (typeof value === 'string' ? value : (value?.source ?? ''))
}))
vi.stubGlobal('useSwitchLocalePath', () => (l: string) => (l === 'zh-CN' ? '/' : `/${l}`))
vi.stubGlobal('navigateTo', (path: string) => {
  navigations.push(path)
  return Promise.resolve(path)
})

import { useAppI18n } from '../../app/composables/useI18n'

beforeEach(() => {
  locale.value = 'zh-CN'
  navigations.length = 0
  tCalls.length = 0
})

describe('useAppI18n — 当前语言', () => {
  it('currentLanguage 跟随 locale', () => {
    const { currentLanguage } = useAppI18n()
    expect(currentLanguage.value).toBe('zh-CN')

    locale.value = 'zh-Hant'
    expect(currentLanguage.value).toBe('zh-Hant')
  })

  it('locale 未就绪（undefined）→ 回退默认语言 zh-CN（SSR 安全）', () => {
    locale.value = undefined
    const { currentLanguage } = useAppI18n()
    expect(currentLanguage.value).toBe('zh-CN')
  })
})

describe('useAppI18n — currentData 深层代理', () => {
  it('取值经 t() 解析为当前语言文案（SSR 下 messages 未加载也可用）', () => {
    const { currentData } = useAppI18n()
    expect(String(currentData.value.title)).toBe('title')
    expect(String(currentData.value.footer.copyright)).toBe('footer.copyright')
    expect(tCalls).toContain('footer.copyright')
  })

  it('作为值参与字符串运算 / 模板插值时不抛错', () => {
    const { currentData } = useAppI18n()
    expect(`${currentData.value.a}`).toBe('a')
    expect(currentData.value.a + '').toBe('a')
  })

  it('JSON.stringify 不触发 t()（避免误解析 .toJSON）', () => {
    const { currentData } = useAppI18n()
    expect(JSON.stringify(currentData.value.someKey)).toBeUndefined()
  })

  it('标准对象/字符串方法名不作为 key 解析（防响应式误触发）', () => {
    const { currentData } = useAppI18n()
    tCalls.length = 0
    // toString 被显式提供为函数（模板插值 String(proxy) 需要），且不产生 t('toString') 调用
    // toString is exposed as a function for template interpolation, without a t('toString') call
    expect(typeof currentData.value.toString).toBe('function')
    expect(tCalls).not.toContain('toString')
    expect(currentData.value.replace).toBeUndefined()
  })
})

describe('useAppI18n — stories 数组消息', () => {
  it('currentStoriesText 用 tm() + rt() 解析为纯字符串数组', () => {
    const { currentStoriesText } = useAppI18n()
    expect(currentStoriesText.value.text1).toEqual(['S1-stories'])
    // 数组元素混合「编译后的 AST 节点」与纯字符串，均解析为纯文本 · AST nodes and plain strings both resolve to text
    expect(currentStoriesText.value.text3).toEqual(['plain', 'S3'])
  })
})

describe('useAppI18n — 语言切换', () => {
  it('switchLanguage 走 URL 前缀导航（默认语言无前缀）', () => {
    const { switchLanguage } = useAppI18n()
    switchLanguage('zh-Hant')
    switchLanguage('zh-CN')
    expect(navigations).toEqual(['/zh-Hant', '/'])
  })

  it('initLanguage 保留为空实现（兼容旧调用方）', () => {
    const { initLanguage } = useAppI18n()
    expect(() => initLanguage()).not.toThrow()
  })
})
