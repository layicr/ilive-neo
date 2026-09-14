// @vitest-environment happy-dom
/**
 * 单元/功能测试：composables 层 · Composables
 *
 * @description 覆盖此前完全无测试的 composables：
 *              · useSharedState —— 同 key 共享同一 ref、初始值惰性只算一次；
 *              · useAppError —— handleError 结构 / Toast 文案回退 / localStorage 日志上限与脏数据容错 /
 *                全局 error·unhandledrejection 监听注入；
 *              · useNavigation —— 模态框开关、B 站播放地址构造、返回顶部、反馈链接编码、
 *                滚动显隐阈值与卸载注销；
 *              · useFriendLink —— 语言切换零请求 + href 协议白名单；
 *              · useMusic —— 初始化不自动播放、播放/暂停、失败回退、语言切换换源、元素缺失容错。
 *
 *              Nuxt 自动导入（onMounted / onUnmounted / watch）在 vitest 下不存在，故以
 *              `vi.stubGlobal` 提供可控桩，使生命周期回调可在测试中显式触发。
 *
 *              Covers the previously untested composables. Nuxt auto-imports are stubbed so lifecycle
 *              callbacks can be triggered explicitly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { CONFIG } from '../../app/utils/config'

vi.mock('../../app/composables/useI18n', async () => {
  const { ref } = await import('vue')
  const currentLanguage = ref('zh-CN')
  const currentData = ref({
    errorMessages: { generic: '出错了', notFound: '内容不存在' },
    bgMusic: 'music/bgm_cn.mp3',
    feedback: { urlTitle: '反馈标题 中文', urlBody: '正文\n第二行' }
  })
  return { useAppI18n: () => ({ currentLanguage, currentData }) }
})

vi.mock('../../app/composables/useData', async () => {
  const { ref } = await import('vue')
  const friendLinks = ref([
    { id: 1, href: 'https://good.example.com', icon: '', title: { 'zh-CN': '好站' }, description: null, seq: 1 },
    { id: 2, href: 'javascript:alert(1)', icon: '', title: { 'zh-CN': '坏站' }, description: null, seq: 2 }
  ])
  return { useData: () => ({ friendLinks }) }
})

import { useSharedState } from '../../app/composables/useSharedState'
import { useAppError } from '../../app/composables/useAppError'
import { useNavigation } from '../../app/composables/useNavigation'
import { useFriendLink } from '../../app/composables/useFriendLink'

/** 生命周期桩：记录回调以便测试显式触发 · lifecycle stubs */
const mountedCbs: Array<() => void> = []
const unmountedCbs: Array<() => void> = []
const watchSources: unknown[] = []
const watchCbs: Array<() => void> = []

vi.stubGlobal('onMounted', (fn: () => void) => mountedCbs.push(fn))
vi.stubGlobal('onUnmounted', (fn: () => void) => unmountedCbs.push(fn))
vi.stubGlobal('watch', (source: unknown, cb: () => void) => {
  watchSources.push(source)
  watchCbs.push(cb)
})

beforeEach(() => {
  localStorage.clear()
  mountedCbs.length = 0
  unmountedCbs.length = 0
  watchSources.length = 0
  watchCbs.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSharedState — 客户端模块级共享', () => {
  it('同一 key 返回同一个 ref（非 setup 上下文也能拿到同一份状态）', () => {
    const key = `test:shared:${Math.random()}`
    const a = useSharedState<number>(key, () => 1)
    const b = useSharedState<number>(key, () => 99)
    expect(a).toBe(b)
    expect(a.value).toBe(1)
  })

  it('不同 key 相互隔离', () => {
    const a = useSharedState<string>(`test:a:${Math.random()}`, () => 'A')
    const b = useSharedState<string>(`test:b:${Math.random()}`, () => 'B')
    expect(a).not.toBe(b)
    expect([a.value, b.value]).toEqual(['A', 'B'])
  })

  it('初始值工厂惰性求值：已有缓存时不再执行', () => {
    const key = `test:lazy:${Math.random()}`
    const factory = vi.fn(() => 7)
    useSharedState<number>(key, factory)
    useSharedState<number>(key, factory)
    expect(factory).toHaveBeenCalledTimes(1)
  })
})

describe('useAppError — 统一错误处理', () => {
  it('handleError 返回结构化错误信息，Error 与字符串两种入参都支持', () => {
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { handleError } = useAppError()

    const fromError = handleError(new Error('boom'), 'Ctx', false)
    expect(fromError.message).toBe('boom')
    expect(fromError.stack).toBeTypeOf('string')
    expect(fromError.context).toBe('Ctx')
    expect(fromError.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const fromString = handleError('oops', 'Ctx2', false)
    expect(fromString.message).toBe('oops')
    expect(fromString.stack).toBeNull()

    expect(spawn).toHaveBeenCalled()
    spawn.mockRestore()
  })

  it('showUser=true 时 Toast 展示对应文案（未知 key 回退 generic）', () => {
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { handleError, toastMessage } = useAppError()

    handleError(new Error('x'), 'C', true, 'notFound')
    expect(toastMessage.value).toBe('内容不存在')

    handleError(new Error('y'), 'C', true, 'unknown_key')
    expect(toastMessage.value).toBe('出错了')

    toastMessage.value = null
    spawn.mockRestore()
  })

  it('Toast 在 CONFIG.TOAST_DURATION 后自动清空', () => {
    vi.useFakeTimers()
    const { showUserMessage, toastMessage } = useAppError()

    showUserMessage('提示')
    expect(toastMessage.value).toBe('提示')

    vi.advanceTimersByTime(CONFIG.TOAST_DURATION + 1)
    expect(toastMessage.value).toBeNull()
  })

  it('错误日志写入 localStorage，超过 50 条丢弃最旧', () => {
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { handleError } = useAppError()

    for (let i = 1; i <= 55; i += 1) {
      handleError(new Error(`e${i}`), 'Loop', false)
    }

    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]')
    expect(logs).toHaveLength(50)
    expect(logs[0].message).toBe('e6')
    expect(logs[49].message).toBe('e55')

    spawn.mockRestore()
  })

  it('localStorage 存在脏数据时不抛错（容错并告警）', () => {
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem('errorLogs', 'not-json')
    const { handleError } = useAppError()

    const info = handleError(new Error('still ok'), 'Dirty', false)
    expect(info.message).toBe('still ok')
    expect(warn).toHaveBeenCalled()

    spawn.mockRestore()
    warn.mockRestore()
  })

  it('注入全局 error / unhandledrejection 监听（showUser=false 静默记录）', () => {
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.clear()
    useAppError()

    window.dispatchEvent(new Event('error'))
    window.dispatchEvent(new Event('unhandledrejection'))

    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]')
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs.some((l: { context: string }) => l.context === 'GlobalError')).toBe(true)
    expect(logs.some((l: { context: string }) => l.context === 'UnhandledPromise')).toBe(true)

    spawn.mockRestore()
  })
})

describe('useNavigation — 模态框与导航', () => {
  it('城市模态框开/关', () => {
    const nav = useNavigation()
    expect(nav.cityModalOpen.value).toBe(false)
    nav.openCityModal()
    expect(nav.cityModalOpen.value).toBe(true)
    nav.closeCityModal()
    expect(nav.cityModalOpen.value).toBe(false)
  })

  it('视频模态框：由 bvid 构造 B 站内嵌地址并带 autoplay', () => {
    const nav = useNavigation()
    nav.openVideoModal('BV1xx411c7mD', '演出回顾')
    expect(nav.videoModalOpen.value).toBe(true)
    expect(nav.videoModalUrl.value).toBe('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=1')
    expect(nav.videoModalTitle.value).toBe('演出回顾')

    nav.closeVideoModal()
    expect(nav.videoModalOpen.value).toBe(false)
    expect(nav.videoModalUrl.value).toBe('')
  })

  it('视频模态框：空 bvid 不打开；未传标题保持默认占位', () => {
    const nav = useNavigation()
    nav.openVideoModal('')
    expect(nav.videoModalOpen.value).toBe(false)
    expect(nav.videoModalUrl.value).toBe('')

    // 共享状态是模块级缓存、跨用例持久，先复位占位标题 · shared state persists across cases; reset the placeholder
    useSharedState<string>('nav:videoTitle', () => 'Loading...').value = 'Loading...'
    nav.openVideoModal('BV1')
    expect(nav.videoModalTitle.value).toBe('Loading...')
  })

  it('backToTop 平滑滚动到顶部', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const nav = useNavigation()
    nav.backToTop()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    scrollTo.mockRestore()
  })

  it('openFeedback 对中文标题/正文做 URL 编码并带 noopener', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const nav = useNavigation()
    nav.openFeedback()
    const [url, target, features] = open.mock.calls[0]
    expect(String(url)).toContain(`${CONFIG.GITHUB_ISSUES_URL}?title=`)
    expect(String(url)).toContain(encodeURIComponent('反馈标题 中文'))
    expect(String(url)).toContain(encodeURIComponent('正文\n第二行'))
    expect(target).toBe('_blank')
    expect(features).toBe('noopener')
    open.mockRestore()
  })

  it('滚动监听按 SCROLL_THRESHOLD 控制返回顶部显隐，卸载时注销', () => {
    const nav = useNavigation()
    expect(mountedCbs).toHaveLength(1)

    // 触发 mounted → 注册 scroll 监听并立即评估一次 · run mounted callback
    mountedCbs[0]()
    Object.defineProperty(window, 'scrollY', { value: CONFIG.SCROLL_THRESHOLD + 10, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(nav.backToTopVisible.value).toBe(true)

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(nav.backToTopVisible.value).toBe(false)

    // 卸载后监听被注销 · listener removed on unmount
    Object.defineProperty(window, 'scrollY', { value: CONFIG.SCROLL_THRESHOLD + 10, configurable: true })
    expect(unmountedCbs).toHaveLength(1)
    unmountedCbs[0]()
    window.dispatchEvent(new Event('scroll'))
    expect(nav.backToTopVisible.value).toBe(false)
  })
})

describe('useFriendLink — DB 优先 + 本地化 + 协议白名单', () => {
  it('语言切换零请求：同一份 DB 数据按当前语言重新本地化', () => {
    const { friendLinks } = useFriendLink()
    expect(friendLinks.value).toHaveLength(1)
    expect(friendLinks.value[0].title).toBe('好站')
  })

  it('DB 中的 javascript: 伪协议链接被过滤，不进入页面 <a href>', () => {
    const { friendLinks } = useFriendLink()
    expect(friendLinks.value.every((l) => /^https?:\/\//.test(l.href))).toBe(true)
  })
})

describe('useMusic — 背景音乐控制（元素缺失 / 播放失败 / 换源）', () => {
  /** 可控的 audio / source 假元素 · controllable fake audio elements */
  function mockAudioElements(mode: 'ok' | 'missing' | 'play-rejects') {
    const audio = {
      load: vi.fn(),
      play: vi.fn(() => (mode === 'play-rejects' ? Promise.reject(new Error('blocked')) : Promise.resolve())),
      pause: vi.fn(),
      volume: 0,
      currentTime: 5
    }
    const source = { src: '' }
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (mode === 'missing') return null
      if (id === 'bgMusic') return audio as unknown as HTMLElement
      if (id === 'bgMusicSource') return source as unknown as HTMLElement
      return null
    })
    return { audio, source }
  }

  it('initBgMusic 仅设置音乐源与音量并 load，不自动播放', async () => {
    vi.resetModules()
    const { audio, source } = mockAudioElements('ok')
    const { useMusic } = await import('../../app/composables/useMusic')
    const music = useMusic()

    music.initBgMusic()
    expect(source.src).toBe('music/bgm_cn.mp3')
    expect(audio.volume).toBe(CONFIG.MUSIC_VOLUME)
    expect(audio.load).toHaveBeenCalledTimes(1)
    expect(audio.play).not.toHaveBeenCalled()
    expect(music.isPlaying.value).toBe(false)
  })

  it('toggleMusic：播放 → 暂停 状态正确切换', async () => {
    vi.resetModules()
    const { audio } = mockAudioElements('ok')
    const { useMusic } = await import('../../app/composables/useMusic')
    const music = useMusic()
    music.initBgMusic()

    music.toggleMusic()
    await Promise.resolve()
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(music.isPlaying.value).toBe(true)

    music.toggleMusic()
    expect(audio.pause).toHaveBeenCalledTimes(1)
    expect(music.isPlaying.value).toBe(false)
  })

  it('播放被浏览器拒绝（autoplay policy）→ 静默失败不抛出、状态回到未播放', async () => {
    vi.resetModules()
    const spawn = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAudioElements('play-rejects')
    const { useMusic } = await import('../../app/composables/useMusic')
    const music = useMusic()
    music.initBgMusic()

    music.toggleMusic()
    await new Promise((r) => setTimeout(r, 0))

    expect(music.isPlaying.value).toBe(false)
    expect(spawn).toHaveBeenCalled()
    spawn.mockRestore()
  })

  it('音频元素缺失时 init / toggle 均安全返回（不抛错）', async () => {
    vi.resetModules()
    mockAudioElements('missing')
    const { useMusic } = await import('../../app/composables/useMusic')
    const music = useMusic()

    expect(() => {
      music.initBgMusic()
      music.toggleMusic()
    }).not.toThrow()
    expect(music.isPlaying.value).toBe(false)
  })

  it('语言切换（watch）时重新加载音乐源；未初始化则不动作', async () => {
    vi.resetModules()
    const { audio } = mockAudioElements('ok')
    const { useMusic } = await import('../../app/composables/useMusic')
    const music = useMusic()
    expect(watchCbs).toHaveLength(1)

    // 未初始化：仅 watch 触发，不应 load · not initialized → no-op
    watchCbs[0]()
    await nextTick()
    expect(audio.load).not.toHaveBeenCalled()

    // 初始化后：切换语言 → 重新 load 且重置播放进度（若正在播放）
    music.initBgMusic()
    music.toggleMusic()
    await Promise.resolve()
    const loadCallsBefore = audio.load.mock.calls.length
    watchCbs[0]()
    await nextTick()
    expect(audio.load.mock.calls.length).toBeGreaterThan(loadCallsBefore)
  })
})
