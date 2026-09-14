/**
 * 单元测试：server/lib/db-config.ts — 数据库连接配置与 file: 路径解析
 *
 * @description 覆盖 getDbConfig（runtimeConfig 注入 / 缺省回退）与 resolveFileUrl
 *              （libsql 透传、file: 相对路径 → cwd 绝对路径、绝对路径保留、Windows 反斜杠归一）。
 *              已知限制：resolveFileUrl 对非 file: 协议一律透传（含空串），用例记录该行为。
 *
 *              Covers getDbConfig (injected runtimeConfig / defaults) and resolveFileUrl
 *              (libsql passthrough, relative file: → absolute cwd path, backslash normalization).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { isAbsolute, join, resolve } from 'node:path'
import { getDbConfig, resolveFileUrl } from '../../server/lib/db-config'
import { __setRuntimeConfig } from '../stubs/nuxt-app'

describe('getDbConfig — runtimeConfig 读取', () => {
  beforeEach(() => {
    __setRuntimeConfig({ turso: {} })
  })

  it('turso 未配置时使用本地 file: 默认值，token 为空串', () => {
    const cfg = getDbConfig()
    expect(cfg.url).toBe('file:./public/data/data.db')
    expect(cfg.token).toBe('')
  })

  it('读取 runtimeConfig.turso.databaseUrl / authToken（远程 Turso 场景）', () => {
    __setRuntimeConfig({ turso: { databaseUrl: 'libsql://demo.turso.io', authToken: 'secret' } })
    expect(getDbConfig()).toEqual({ url: 'libsql://demo.turso.io', token: 'secret' })
  })

  it('authToken 为空 / undefined 时归一为空串（不返回 undefined）', () => {
    __setRuntimeConfig({ turso: { databaseUrl: 'libsql://demo.turso.io', authToken: undefined } })
    expect(getDbConfig().token).toBe('')
  })

  it('databaseUrl 为空串时回退默认本地库（|| 兜底）', () => {
    __setRuntimeConfig({ turso: { databaseUrl: '', authToken: 't' } })
    expect(getDbConfig().url).toBe('file:./public/data/data.db')
  })
})

describe('resolveFileUrl — 协议与路径解析', () => {
  it('libsql: 远程协议原样透传（不做路径解析）', () => {
    expect(resolveFileUrl('libsql://demo.turso.io')).toBe('libsql://demo.turso.io')
    expect(resolveFileUrl('https://example.com/db')).toBe('https://example.com/db')
  })

  it('file:./ 相对路径 → 基于 process.cwd() 的绝对路径', () => {
    const out = resolveFileUrl('file:./public/data/data.db')
    const expected = resolve(process.cwd(), 'public/data/data.db').replace(/\\/g, '/')
    expect(out).toBe(`file:${expected}`)
    expect(out.startsWith('file:')).toBe(true)
  })

  it('file: 后不带 ./ 的相对路径同样解析', () => {
    const out = resolveFileUrl('file:public/data/data.db')
    expect(out).toBe(`file:${resolve(process.cwd(), 'public/data/data.db').replace(/\\/g, '/')}`)
  })

  it('file: 绝对路径保留（不再叠加 cwd）', () => {
    const abs = join(process.cwd(), 'data', 'x.db')
    expect(isAbsolute(abs)).toBe(true)
    const out = resolveFileUrl(`file:${abs}`)
    expect(out).toBe(`file:${abs.replace(/\\/g, '/')}`)
  })

  it('Windows 下反斜杠统一为正斜杠（libsql 可识别）', () => {
    const out = resolveFileUrl('file:.\\public\\data\\data.db')
    expect(out).not.toContain('\\')
  })

  it('解析结果始终保留 file: 前缀且指向同一物理位置', () => {
    const out = resolveFileUrl('file:./public/data/data.db')
    const pathPart = out.replace(/^file:/, '')
    expect(resolve(pathPart)).toBe(resolve(process.cwd(), 'public/data/data.db'))
  })
})
