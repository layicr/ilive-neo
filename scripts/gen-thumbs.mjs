// 生成演唱会缩略图 · Generate concert thumbnails
// 递归遍历 public/concert/ 下所有目录（poster + 各 <date> 画廊目录），
// 对缺少 _thumb 变体的原图（xxx.jpg）生成 xxx_thumb.jpg（600px / q72）。
// 已存在的变体跳过（幂等）；新增图片时一条命令全量补齐。
// 约定：前端 thumbSrc() 直接复用 `xxx.jpg -> xxx_thumb.jpg`。
import sharp from 'sharp'
import { readdir, stat } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_DIR = join(__dirname, '..', 'public', 'concert')
const WIDTH = 600 // 卡片海报显示宽度约 280–400px，600 足够清晰
const QUALITY = 72

let generated = 0
let skipped = 0

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full)
      continue
    }
    // 仅处理原图：跳过已生成的 _thumb / _medium 变体
    if (
      entry.isFile() &&
      /\.jpg$/i.test(entry.name) &&
      !entry.name.endsWith('_thumb.jpg') &&
      !entry.name.endsWith('_medium.jpg')
    ) {
      const out = full.replace(/\.jpg$/i, '_thumb.jpg')
      if (await stat(out).catch(() => null)) {
        skipped++
        continue
      }
      await sharp(full)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(out)
      generated++
      console.log('generated', relative(BASE_DIR, full), '->', relative(BASE_DIR, out))
    }
  }
}

async function main() {
  await walk(BASE_DIR)
  console.log(`done: ${generated} generated, ${skipped} skipped (already exist)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
