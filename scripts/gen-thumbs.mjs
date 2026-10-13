// 生成演唱会海报缩略图 · Generate concert poster thumbnails
// 约定：public/concert/poster/xxx.jpg -> public/concert/poster/xxx_thumb.jpg
// 与现有画廊缩略图（NN_thumb.jpg）同一命名约定，前端 thumbSrc() 可直接复用。
import sharp from 'sharp'
import { readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const POSTER_DIR = join(__dirname, '..', 'public', 'concert', 'poster')
const WIDTH = 600 // 卡片海报显示宽度约 280–400px，600 足够清晰
const QUALITY = 72

async function main() {
  const files = (await readdir(POSTER_DIR)).filter(
    (f) => f.toLowerCase().endsWith('.jpg') && !f.endsWith('_thumb.jpg')
  )
  let generated = 0
  let skipped = 0
  for (const f of files) {
    const src = join(POSTER_DIR, f)
    const out = join(POSTER_DIR, f.replace(/\.jpg$/i, '_thumb.jpg'))
    if (await stat(out).catch(() => null)) {
      skipped++
      continue
    }
    await sharp(src)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(out)
    generated++
    console.log('generated', f, '->', out)
  }
  console.log(`done: ${generated} generated, ${skipped} skipped (already exist)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
