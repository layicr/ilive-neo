// 测试用例 1：完整且标准的演唱会数据（双语、location 含国家）
// 用于验证正常路径下 4 张表 INSERT 的生成与 location 拆分
var concert = {
  "id": 101,
  "artist": { "zh": "周杰伦", "en": "Jay Chou" },
  "concertName": { "zh": "嘉年华演唱会", "en": "Carnival World Tour" },
  "theme": {
    "zh": "以『嘉年华』为主题，融合中西乐风。",
    "en": "Carnival-themed, blending Eastern and Western music styles."
  },
  "location": {
    "zh": "中国 · 上海 · 上海 · 上海体育场",
    "en": "China · Shanghai · Shanghai · Shanghai Stadium"
  },
  "seat": { "zh": "A 区 5 排", "en": "Section A Row 5" },
  "price": { "zh": "¥680", "en": "¥680" },
  "date": "2019.10.01",
  "time": "19:30",
  "poster": "concert/poster/20191001.jpg",
  "tags": {
    "zh": ["周杰伦", "嘉年华", "钢琴"],
    "en": ["JayChou", "Carnival", "Piano"]
  },
  "description": {
    "zh": "一场关于青春与音乐的狂欢。",
    "en": "A carnival about youth and music."
  },
  "images": [
    { "src": "concert/20191001/01.jpg", "alt": { "zh": "周杰伦演唱会", "en": "Jay Chou Concert" } },
    { "src": "concert/20191001/02.jpg", "alt": { "zh": "周杰伦演唱会", "en": "Jay Chou Concert" } }
  ],
  "songlist": [
    { "zh": "稻香", "en": "Rice Fragrance" },
    { "zh": "七里香", "en": "Common Jasmine Orange" },
    { "zh": "晴天", "en": "Sunny Day" }
  ]
};
