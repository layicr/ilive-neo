// 打印 dev server `/en` 页面的 <head> 片段（SEO 人工核对用）
// Print the <head> slice of the dev server's /en page (for manual SEO inspection)
const r = await fetch('http://localhost:3000/en')
const t = await r.text()
const start = t.indexOf('<head>')
const end = t.indexOf('</head>') + 7
console.log(t.slice(start, end))
