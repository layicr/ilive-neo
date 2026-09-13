// 打印 dev server `/en` 页面开头的 400 个字符（快速查看 HTML 头部）
// Print the first 400 chars of the dev server's /en page (quick HTML head peek)
const r = await fetch('http://localhost:3000/en')
const t = await r.text()
console.log(t.slice(0, 400))
