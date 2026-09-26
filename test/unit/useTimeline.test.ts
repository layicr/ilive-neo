// @vitest-environment happy-dom
/**
 * useTimeline —— IntersectionObserver 生命周期回归 · Observer lifecycle regression
 *
 * @description 历史问题：observer 是模块级单例且**从不 disconnect**。IntersectionObserver 对被
 *              observe 的目标持有**强引用**，而语言切换（`/` → `/en`）会整体重建页面组件，
 *              于是旧时间轴的 DOM / 图片节点一直被 observer 留住无法回收；同一份 observer 还会在
 *              多次 init 中继续累积早已脱离文档的节点。
 *
 *              修复后：① 每次 init 先 disconnect 再基于当前 DOM 重新 observe；
 *                    ② 宿主卸载时 disconnect 并置空单例（下一个页面实例会新建）。
 *
 *              Coverage: init observes current items; re-init disconnects first; unmount releases the
 *              singleton so the next mount builds a fresh observer; no-IO 环境直接全部显示。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, computed, onScopeDispose, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const { mockData } = vi.hoisted(() => ({
  mockData: {
    api: null as null | {
      useData: () => { localizedConcerts: { value: { id: number }[] } }
      setConcerts: (ids: number[]) => void
    }
  }
}))

vi.mock('../../app/composables/useData', async () => {
  const { ref } = await import('vue')
  const localizedConcerts = ref<{ id: number }[]>([])
  mockData.api = {
    useData: () => ({ localizedConcerts }),
    /** 供测试按用例注入条目 id（隔离各用例的 visibleIds 共享状态）· inject item ids per test */
    setConcerts: (ids: number[]) => {
      localizedConcerts.value = ids.map((id) => ({ id }))
    }
  }
  return mockData.api
})

import { useTimeline } from '../../app/composables/useTimeline'

/** 被 observe 的目标集合（当前观察集中的元素）· currently observed targets */
const liveTargets = new Set<Element>()
/** 所有构造出来的 observer 实例 · every observer instance created */
const instances: FakeObserver[] = []
/** 构造次数（判断是否复用了旧单例）· construction count */
let constructCount = 0

/** 可控 IntersectionObserver 桩 · controllable IntersectionObserver stub */
class FakeObserver {
  /** 该实例被 disconnect 的次数 · how often this instance was disconnected */
  disconnectCount = 0
  /** 该实例 observe 过的目标数 · observed target count for this instance */
  observeCount = 0

  constructor(_cb: (entries: unknown[]) => void, _opts?: unknown) {
    constructCount += 1
    instances.push(this)
  }
  observe(el: Element) {
    liveTargets.add(el)
    this.observeCount += 1
  }
  unobserve(el: Element) {
    liveTargets.delete(el)
  }
  disconnect() {
    liveTargets.clear()
    this.disconnectCount += 1
  }
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  instances.length = 0
  constructCount = 0
  liveTargets.clear()
  // Nuxt 自动导入：本组合式以裸标识符使用 computed / onScopeDispose
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onScopeDispose', onScopeDispose)
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/** 挂载宿主组件（渲染若干 .timeline-item）· mount a host rendering timeline items */
function mountTimeline(ids: number[]) {
  let api!: ReturnType<typeof useTimeline>
  // 注入本用例专属的条目 id：visibleIds 是跨 mount 共享的，用不同 id 保证用例互相隔离
  // Inject test-specific ids: visibleIds is shared across mounts, so distinct ids keep cases isolated.
  mockData.api!.setConcerts(ids)
  const Host = defineComponent({
    setup() {
      api = useTimeline()
      return () =>
        h(
          'div',
          api.sortedConcerts.value.map((c) =>
            h('div', { class: 'timeline-item', 'data-concert-id': String(c.id) })
          )
        )
    }
  })
  // attachTo 让组件挂载到真实 body —— initTimelineReveal 走的是 document.querySelectorAll
  const wrapper = mount(Host, { attachTo: document.body })
  return { api, wrapper }
}

describe('useTimeline — observer 初始化', () => {
  it('观察当前 DOM 中的全部时间轴条目', async () => {
    const { api, wrapper } = mountTimeline([1, 2])
    await nextTick()

    api.initTimelineReveal()

    expect(document.querySelectorAll('.timeline-item')).toHaveLength(2)
    expect(liveTargets.size).toBe(2)
    expect(instances).toHaveLength(1)
    wrapper.unmount()
  })

  it('重复 init 会先 disconnect，避免累积已废弃的目标', async () => {
    const { api, wrapper } = mountTimeline([1, 2])
    await nextTick()

    api.initTimelineReveal()
    const first = instances[0]
    expect(first.disconnectCount).toBe(0)

    api.initTimelineReveal()
    // 第二次 init：先断开旧目标集（此刻观察集被清空后再按当前 DOM 重新 observe）
    expect(first.disconnectCount).toBe(1)
    // 没有新建 observer，仍是单例
    expect(instances).toHaveLength(1)
    expect(liveTargets.size).toBe(2)

    wrapper.unmount()
  })

  it('卸载时释放单例：下一个页面实例会新建 observer（否则会复用持有旧节点的实例）', async () => {
    const n0 = constructCount

    const first = mountTimeline([1, 2])
    await nextTick()
    first.api.initTimelineReveal()
    const observerBefore = instances[0]
    expect(observerBefore.disconnectCount).toBe(0)

    first.wrapper.unmount()
    // 卸载 → disconnect 被调用，观察目标全部释放
    expect(observerBefore.disconnectCount).toBe(1)
    expect(liveTargets.size).toBe(0)

    // 新页面实例（语言切换后）→ 必须新建 observer
    const second = mountTimeline([3, 4])
    await nextTick()
    second.api.initTimelineReveal()

    expect(constructCount).toBe(n0 + 2)
    expect(instances).toHaveLength(2)

    second.wrapper.unmount()
  })

  it('卸载后回调不再残留：DOM 已移除时 init 直接返回，不新建 observer', async () => {
    const { api, wrapper } = mountTimeline([1, 2])
    await nextTick()
    api.initTimelineReveal()
    const countAfterInit = constructCount

    wrapper.unmount()
    expect(document.querySelectorAll('.timeline-item')).toHaveLength(0)

    api.initTimelineReveal()
    expect(constructCount).toBe(countAfterInit)
  })
})

describe('useTimeline — 无 IntersectionObserver 环境', () => {
  it('直接把所有条目标记为可见，不依赖 observe', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { api, wrapper } = mountTimeline([5, 6])
    await nextTick()

    api.initTimelineReveal()

    expect(api.visibleIds.value[5]).toBe(true)
    expect(api.visibleIds.value[6]).toBe(true)
    expect(constructCount).toBe(0)

    wrapper.unmount()
  })
})
