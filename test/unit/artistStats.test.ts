/**
 * countUniqueArtists —— 艺人总数统计（按 zh-CN 维度，支持「、」多歌手拆分）
 *
 * @description 覆盖 `server/lib/concerts.ts` 的 `countUniqueArtists`：
 *              单场 `artist_i18n` 可能含多个歌手（中文顿号「、」分隔），统计时须拆分、trim、去空后
 *              跨场次去重计数。对应 `server/api/data.get.ts` 的 `stats.totalArtists` 计算。
 */
import { describe, it, expect } from 'vitest'
import { countUniqueArtists } from '../../server/lib/mappers'

/** 构造最小输入（只取统计所需的 artist.zh-CN）· minimal input for the stats */
function rows(artistsZh: (string | null | undefined)[]): { artist: { 'zh-CN'?: string } }[] {
  return artistsZh.map((zh) => ({ artist: { 'zh-CN': zh ?? undefined } }))
}

describe('countUniqueArtists · 单歌手（无拆分）', () => {
  it('每场一个歌手、互不相同 → 等于场次', () => {
    expect(countUniqueArtists(rows(['五月天', '周杰伦', '孙燕姿']))).toBe(3)
  })

  it('空数组 → 0', () => {
    expect(countUniqueArtists(rows([]))).toBe(0)
  })
})

describe('countUniqueArtists · 多歌手（「、」拆分）', () => {
  it('单场内并列两个歌手 → 计 2', () => {
    expect(countUniqueArtists(rows(['五月天、任贤齐']))).toBe(2)
  })

  it('顿号周围带空格 → trim 后正确拆分', () => {
    expect(countUniqueArtists(rows([' 五月天 、 任贤齐 ']))).toBe(2)
  })

  it('三个歌手 + 末尾多余顿号 → 不计入空串', () => {
    expect(countUniqueArtists(rows(['阿信、怪兽、石头、']))).toBe(3)
  })

  it('跨场次多歌手混合 → 全部拆分后去重', () => {
    // 场次1: 五月天、任贤齐(2) | 场次2: 周杰伦(1) | 场次3: 任贤齐、孙燕姿(2, 任贤齐重复)
    // 去重后: 五月天/任贤齐/周杰伦/孙燕姿 = 4
    const res = countUniqueArtists(rows(['五月天、任贤齐', '周杰伦', '任贤齐、孙燕姿']))
    expect(res).toBe(4)
  })
})

describe('countUniqueArtists · 去重与容错', () => {
  it('同歌手跨多场重复 → 只计 1', () => {
    expect(countUniqueArtists(rows(['五月天', '五月天', '五月天']))).toBe(1)
  })

  it('artist 缺失 / 空串 / null / undefined → 跳过不计入', () => {
    expect(countUniqueArtists(rows([null, undefined, '', '   ']))).toBe(0)
  })

  it('有歌手场次与空场次混合 → 只数有效歌手', () => {
    expect(countUniqueArtists(rows(['五月天', null, '周杰伦', '']))).toBe(2)
  })

  it('仅去除首尾空白、不额外归一化（不同写法视为不同歌手）', () => {
    // '五月天 '(尾随空格) 经 trim 归并为「五月天」；'Mayday' 为另一写法 → 计 2
    expect(countUniqueArtists(rows(['五月天', '五月天 ', 'Mayday']))).toBe(2)
  })
})
