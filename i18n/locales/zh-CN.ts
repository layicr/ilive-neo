/**
 * 中文 UI 文案（vue-i18n message） · Chinese UI messages
 * @description 从原 app/locales/zh.ts 迁移为 vue-i18n 默认导出；仅含静态 UI 文案，演唱会/城市/许愿数据由 API 提供。
 */

export default {
  pageTitle: 'Layicr演唱会足迹',
  bgMusic: 'music/bgm_cn.mp3', // 解析到 public/music/ 下（背景音乐源）· resolved under public/music/
  profileLabel: '我的名字是:',
  profileSubtitle: '这是我们的演唱会，也是你的故事。',

  concertsLabel: '场次',
  artistsLabel: '艺人',
  citiesLabel: '城市',
  footerText: '', // 故意留空：页脚品牌区不显示文字

  siteName: 'Layicr',
  modalTitle: '演唱会城市',
  ticketModalTitle: '演唱会足迹',
  rolesPrefix: '→   ',

  roles: {
    declaration: '宣言？   xuān yán？',
    concertsLabel: '演唱会',
    citiesLabel: '城市'
  },

  buttons: {
    songlist: '查看歌单',
    watchVideo: '观看视频',
    openVideo: '打开视频',
    like: '点赞',
    unlike: '取消点赞',
    hot: '热门演唱会（点赞前三）'
  },

  tooltips: {
    musicToggle: '播放/暂停背景音乐',
    feedback: '反馈问题',
    backToTop: '返回顶部'
  },

  status: {
    loading: '加载中...'
  },

  songlist: {
    totalSongs: '共 {count} 首歌曲',
    searchPlaceholder: '搜索歌曲...'
  },

  feedback: {
    urlTitle: '[问题反馈]',
    urlBody: '问题描述：\n\n请在此处详细描述您遇到的问题...'
  },

  cityList: {
    concertsPrefix: '举办演唱会：',
    concertsSuffix: '场'
  },

  wishWall: {
    title: '许愿墙',
    countPrefix: '已有 ',
    countSuffix: ' 个心愿',
    emptyMessage: '还没有人许愿，来做第一个许愿的人吧！'
  },

  errorMessages: {
    generic: '操作失败，请稍后重试',
    loadFailed: '加载失败，请刷新页面',
    rateLimited: '操作太频繁，请稍后再试'
  },

  // 故事动态文本：text1 = 第一行，text3 = 第二行（高亮填充）· story texts: text1 = line 1, text3 = line 2 (highlight)
  stories: {
    text1: ['说真的，', '一抹蓝，', '争朝夕，'],
    text3: [
      '似有若无的坦荡，强迫我们成长。',
      '路上的脚印，永远不会停歇。',
      '抬头仰望的世界，是不是难以到达？'
    ]
  }
}
