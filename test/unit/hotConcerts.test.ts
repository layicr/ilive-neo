/**
 * 单元测试：热度榜与城市计数 · Hot-concert badge & city concert counts
 *
 * @description 覆盖 `app/utils/index.ts` 中此前无测试的两条派生逻辑：
 *              · `pickHotConcertIds`——「点赞数前三档」阈值算法（并列同显、不足三档、忽略 0 票）；
 *              · `computeCityConcertCounts`——城市演唱会数的跨语言匹配与去重计数。
 *
 *              Covers the two previously untested derivations in `app/utils/index.ts`:
 *              `pickHotConcertIds` (top-3 like levels, ties included) and
 *              `computeCityConcertCounts` (cross-locale city matching).
 */
import { describe, it, expect } from 'vitest'
import { pickHotConcertIds, computeCityConcertCounts } from '../../app/utils/index'

const t = (zh: string, en: string, hant = zh) => ({ 'zh-CN': zh, en, 'zh-Hant': hant })

describe('pickHotConcertIds — 点赞数前三档阈值', () => {
  it('全为 0 / 空列表 → 空集合（不产生热度标记）', () => {
    expect(pickHotConcertIds([]).size).toBe(0)
    expect(pickHotConcertIds([{ id: 1, likes: 0 }, { id: 2 }]).size).toBe(0)
  })

  it('足够多档位 → 取点赞数最高的 3 个不同数值为阈值，≥ 阈值者全入选', () => {
    const ids = pickHotConcertIds([
      { id: 1, likes: 10 },
      { id: 2, likes: 5 },
      { id: 3, likes: 3 },
      { id: 4, likes: 1 }
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('并列点赞同显（第三档并列时全部入选，不截断为 3 个）', () => {
    const ids = pickHotConcertIds([
      { id: 1, likes: 5 },
      { id: 2, likes: 5 },
      { id: 3, likes: 3 },
      { id: 4, likes: 3 }
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('不足三档（仅 1~2 个不同数值）→ 有几档选几档', () => {
    expect([...pickHotConcertIds([{ id: 1, likes: 7 }, { id: 2, likes: 2 }])].sort((a, b) => a - b)).toEqual([1, 2])
    expect([...pickHotConcertIds([{ id: 1, likes: 4 }])]).toEqual([1])
  })

  it('负数 / 缺失 likes 视为 0，不入选；不影响正常票数', () => {
    const ids = pickHotConcertIds([
      { id: 1, likes: -3 },
      { id: 2 },
      { id: 3, likes: 2 }
    ])
    expect([...ids]).toEqual([3])
  })

  it('不改写入参对象', () => {
    const input = [{ id: 1, likes: 2 }]
    pickHotConcertIds(input)
    expect(input).toEqual([{ id: 1, likes: 2 }])
  })
})

describe('computeCityConcertCounts — 城市演唱会数（跨语言匹配）', () => {
  const cities = [
    { id: 1, name: t('北京', 'Beijing', '北京') },
    { id: 2, name: t('上海', 'Shanghai', '上海') }
  ]

  it('多语言文本命中即计数（zh-CN / en / zh-Hant 任一语言包含城市名）', () => {
    const counts = computeCityConcertCounts(
      [
        { location: t('北京·国家体育场', 'Beijing National Stadium') },
        { location: t('上海·梅赛德斯', 'Shanghai Mercedes-Benz Arena') },
        { location: t('北京·鸟巢', 'Beijing Bird Nest') }
      ],
      cities
    )
    expect(counts).toEqual({ 1: 2, 2: 1 })
  })

  it('仅英文语言命中也可计数（跨语言回退匹配）', () => {
    const counts = computeCityConcertCounts([{ location: { en: 'Shanghai' } }], cities)
    expect(counts).toEqual({ 2: 1 })
  })

  it('同一演唱会只归属首个命中的城市（避免重复计数）', () => {
    const overlapping = [
      { id: 1, name: t('北京', 'Beijing') },
      { id: 2, name: t('京', 'Jing') }
    ]
    const counts = computeCityConcertCounts([{ location: t('北京', 'Beijing') }], overlapping)
    expect(counts).toEqual({ 1: 1 })
  })

  it('缺少 location 的演唱会跳过，不产生 0 计数键', () => {
    const counts = computeCityConcertCounts([{}, { location: undefined }], cities)
    expect(counts).toEqual({})
  })

  it('空输入 → 空对象', () => {
    expect(computeCityConcertCounts([], cities)).toEqual({})
    expect(computeCityConcertCounts([{ location: t('北京', 'Beijing') }], [])).toEqual({})
  })
})
