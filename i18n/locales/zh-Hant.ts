/**
 * 繁体中文 UI 文案（vue-i18n message） · Traditional Chinese UI messages
 * @description 由简体文案转繁体（stories 一并转为繁體）。
 */

export default {
  pageTitle: 'Layicr演唱會足跡',
  bgMusic: 'music/bgm_cn.mp3', // 解析到 public/music/ 下（背景音樂源）· resolved under public/music/ (BGM source)
  profileLabel: '我的名字是:',
  profileSubtitle: '這是我們的演唱會，也是你的故事。',

  concertsLabel: '場次',
  artistsLabel: '藝人',
  citiesLabel: '城市',
  footerText: '', // 故意留空：頁腳品牌區不顯示文字 · intentionally empty (footer brand shows no text)

  siteName: 'Layicr',
  modalTitle: '演唱會城市',
  ticketModalTitle: '演唱會足跡',
  rolesPrefix: '→   ',

  roles: {
    declaration: '宣言？   xuān yán？',
    concertsLabel: '演唱會',
    citiesLabel: '城市'
  },

  buttons: {
    songlist: '查看歌單',
    watchVideo: '觀看影片',
    openVideo: '打開影片',
    like: '點讚',
    unlike: '取消點讚',
    hot: '熱門演唱會（點讚前三）'
  },

  tooltips: {
    musicToggle: '播放/暫停背景音樂',
    feedback: '反饋問題',
    backToTop: '返回頂部'
  },

  status: {
    loading: '載入中...'
  },

  songlist: {
    totalSongs: '共 {count} 首歌曲',
    searchPlaceholder: '搜尋歌曲...'
  },

  feedback: {
    urlTitle: '[問題反饋]',
    urlBody: '問題描述：%0A%0A請在此處詳細描述您遇到的問題...'
  },

  cityList: {
    concertsPrefix: '舉辦演唱會：',
    concertsSuffix: '場'
  },

  wishWall: {
    title: '許願牆',
    countPrefix: '已有 ',
    countSuffix: ' 個心願',
    emptyMessage: '還沒有人許願，來做第一個許願的人吧！'
  },

  errorMessages: {
    generic: '操作失敗，請稍後重試',
    loadFailed: '載入失敗，請重新整理頁面'
  },

  // 故事動態文字：text1 = 第一行，text3 = 第二行（高亮填充）· story texts: text1 = line 1, text3 = line 2 (highlight)
  stories: {
    text1: ['說真的，', '一抹藍，', '爭朝夕，'],
    text3: [
      '似有若無的坦蕩，強迫我們成長。',
      '路上的腳印，永遠不會停歇。',
      '抬頭仰望的世界，是不是難以到達？'
    ]
  }
}
