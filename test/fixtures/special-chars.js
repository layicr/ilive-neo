// 测试用例 3：含单引号等特殊字符（如 Xi'an / 靓声's）
// 用于验证 SQL 字符串单引号转义（' → ''），避免语法错误
var concert = {
  "id": 103,
  "artist": { "zh": "张韶涵", "en": "Angela Zhang" },
  "concertName": { "zh": "旅程演唱会", "en": "Angela's Journey Tour" },
  "theme": { "zh": "以『隐形的翅膀』激励听众。", "en": "Inspiring listeners with 'Invisible Wings'." },
  "location": {
    "zh": "中国 · 陕西 · 西安 · 西安奥林匹克体育中心",
    "en": "China · Shaanxi · Xi'an · Xi'an Olympic Sports Center"
  },
  "seat": { "zh": "看台 3 区", "en": "Stand 3" },
  "price": { "zh": "¥380", "en": "¥380" },
  "date": "2023.07.15",
  "time": "19:00",
  "poster": "concert/poster/20230715.jpg",
  "tags": { "zh": ["张韶涵", "西安"], "en": ["Angela", "Xi'an"] },
  "description": { "zh": "歌迷说：'这是最棒的一夜'。", "en": "Fans said: 'This is the best night'." },
  "images": [
    { "src": "concert/20230715/01.jpg", "alt": { "zh": "西安演唱会", "en": "Xi'an Concert" } }
  ],
  "songlist": [
    { "zh": "隐形的翅膀", "en": "Invisible Wings" }
  ]
};
