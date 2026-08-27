// 测试用例 2：location 缺失国家字段
// 用于验证国家缺失时自动补 "中国 / China"
var concert = {
  "id": 102,
  "artist": { "zh": "陈奕迅", "en": "Eason Chan" },
  "concertName": { "zh": "DUO 演唱会", "en": "DUO Concert" },
  "theme": { "zh": "以双面人生为主题。", "en": "A theme of dual life." },
  "location": {
    "zh": "广东 · 广州 · 广州体育馆",
    "en": "Guangdong · Guangzhou · Guangzhou Gymnasium"
  },
  "seat": { "zh": "内场", "en": "Inner" },
  "price": { "zh": "¥580", "en": "¥580" },
  "date": "2010.05.01",
  "time": "20:00",
  "poster": "concert/poster/20100501.jpg",
  "tags": { "zh": ["陈奕迅", "DUO"], "en": ["Eason", "DUO"] },
  "description": { "zh": "经典现场。", "en": "A classic live show." },
  "images": [
    { "src": "concert/20100501/01.jpg", "alt": { "zh": "陈奕迅演唱会", "en": "Eason Chan Concert" } }
  ],
  "songlist": [
    { "zh": "十年", "en": "Ten Years" },
    { "zh": "浮夸", "en": "Exaggerated" }
  ]
};
