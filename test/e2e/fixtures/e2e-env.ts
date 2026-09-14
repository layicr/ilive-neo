/**
 * E2E 运行环境常量 · E2E runtime environment constants
 *
 * @description 供 `playwright.config.ts` 与 `global-setup.ts` 共用，保证「测试库路径 / 端口 / baseURL」
 *              三处在同一处定义，避免配置漂移。
 *              Shared by playwright.config.ts and global-setup.ts so the test DB path, port and baseURL
 *              stay defined in exactly one place.
 *
 *              测试库（fixture 数据）与真实库 `public/data/data.db` 完全隔离：
 *              测试库生成在会话中间产物目录（不写入仓库，避免污染被 git 跟踪的数据文件）。
 *              The fixture DB is isolated from the real `public/data/data.db` and generated under the
 *              session temp directory (never inside the repo).
 */
import path from 'node:path'
import process from 'node:process'

/**
 * 默认测试库路径：系统临时目录下的独立子目录（跨机器/跨会话可用，不写入仓库）。
 * 与 seed-e2e-db.mjs 的默认值保持一致，避免两处默认漂移。
 */
const DEFAULT_E2E_DB_FILE = path.join(
  process.env.TEMP || process.env.TMPDIR || '.',
  'ilive-e2e',
  'e2e-data.db'
)

/** 测试库文件绝对路径（可用 E2E_DB_FILE 覆盖）· absolute path of the fixture DB */
export const E2E_DB_FILE: string = process.env.E2E_DB_FILE || DEFAULT_E2E_DB_FILE

/** libsql 连接串（Windows 反斜杠统一转正斜杠）· libsql connection URL */
export const E2E_DB_URL: string = 'file:' + E2E_DB_FILE.replace(/\\/g, '/')

/** dev server 端口 · dev server port */
export const E2E_PORT: number = Number(process.env.E2E_PORT || 3000)

/** 被测站点基址 · base URL under test */
export const E2E_BASE_URL: string = `http://localhost:${E2E_PORT}`

/** 报告 / 日志目录 · report dir */
export const E2E_REPORT_DIR = 'test/report'
