// 生成演唱会缩略图 · Generate concert thumbnails
// 递归遍历 public/concert/ 下所有目录（poster + 各 <date> 画廊目录），
// 对原图（xxx.jpg）生成两种变体：
//   - xxx_thumb.jpg  （600px  / q72）卡片/海报网格用（含 poster）
//   - xxx_medium.jpg （1280px / q80）灯箱/详情大图用（poster 除外，仅 _thumb）
// 已存在的变体跳过（幂等）；新增图片时一条命令全量补齐。
// 约定：前端 thumbSrc() 复用 `xxx.jpg -> xxx_thumb.jpg`；mediumSrc() 复用 `xxx.jpg -> xxx_medium.jpg`。
import sharp from 'sharp'
import { readdir, stat } from 'node:fs/promises'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_DIR = join(__dirname, '..', 'public', 'concert')
const WIDTH = 600 // 卡片海报显示宽度约 280–400px，600 足够清晰
const QUALITY = 72
const WIDTH_MEDIUM = 1280 // 灯箱/详情大图
const QUALITY_MEDIUM = 80

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
      // thumb 变体
      const thumbOut = full.replace(/\.jpg$/i, '_thumb.jpg')
      if (await stat(thumbOut).catch(() => null)) {
        skipped++
      } else {
        await sharp(full)
          .resize({ width: WIDTH, withoutEnlargement: true })
          .jpeg({ quality: QUALITY, mozjpeg: true })
          .toFile(thumbOut)
        generated++
        console.log('generated', relative(BASE_DIR, full), '->', relative(BASE_DIR, thumbOut))
      }
      // medium 变体（poster 仅生成 _thumb，不生成 _medium）
      const isPoster = relative(BASE_DIR, full).split(sep)[0] === 'poster'
      if (!isPoster) {
        const medOut = full.replace(/\.jpg$/i, '_medium.jpg')
        if (await stat(medOut).catch(() => null)) {
          skipped++
        } else {
          await sharp(full)
            .resize({ width: WIDTH_MEDIUM, withoutEnlargement: true })
            .jpeg({ quality: QUALITY_MEDIUM, mozjpeg: true })
            .toFile(medOut)
          generated++
          console.log('generated', relative(BASE_DIR, full), '->', relative(BASE_DIR, medOut))
        }
      }
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
