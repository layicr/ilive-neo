/**
 * 英文 UI 文案（vue-i18n message） · English UI messages
 * @description 从原 app/locales/en.ts 迁移为 vue-i18n 默认导出；仅含静态 UI 文案。
 */

export default {
  pageTitle: "layicr's Concert Trail",
  bgMusic: 'music/bgm_en.mp3', // 解析到 public/music/ 下（背景音乐源）· resolved under public/music/ (BGM source)
  profileLabel: 'My name is:',
  profileSubtitle: "This is our concert, and it's your story.",

  concertsLabel: 'Concerts',
  artistsLabel: 'Artists',
  citiesLabel: 'Cities',
  footerText: '', // 故意留空：页脚品牌区不显示文字 · intentionally empty (footer brand shows no text)

  siteName: 'layicr',
  modalTitle: 'Tour Cities',
  ticketModalTitle: 'Concert Journey',
  rolesPrefix: '->   ',

  roles: {
    declaration: 'Declaration?',
    concertsLabel: 'Concerts',
    citiesLabel: 'Cities'
  },

  buttons: {
    songlist: 'View Songlist',
    watchVideo: 'Watch Video',
    openVideo: 'Open Video',
    like: 'Like',
    unlike: 'Unlike',
    hot: 'Popular concert (top 3 by likes)'
  },

  tooltips: {
    musicToggle: 'Play/Pause Background Music',
    feedback: 'Report Issue',
    backToTop: 'Back to Top'
  },

  status: {
    loading: 'Loading...'
  },

  songlist: {
    totalSongs: 'Total {count} songs',
    searchPlaceholder: 'Search songs...'
  },

  feedback: {
    urlTitle: '[Bug Report]',
    urlBody: 'Description:\n\nPlease describe the issue you encountered in detail...'
  },

  cityList: {
    concertsPrefix: 'Concerts: ',
    concertsSuffix: ''
  },

  wishWall: {
    title: 'Wish Wall',
    countPrefix: 'Total: ',
    countSuffix: ' wishes',
    emptyMessage: 'No wishes yet, be the first to make one!'
  },

  guestbook: {
    title: 'Guestbook',
    nicknamePlaceholder: 'Nickname',
    emailPlaceholder: 'Email',
    contentPlaceholder: 'Leave your footprints and feelings here; you are also welcome to chat with me under a song',
    publish: 'Post message',
    viewCard: 'Cards',
    viewList: 'List',
    reply: 'Reply',
    replyNicknamePlaceholder: 'Nickname',
    replyEmailPlaceholder: 'Email',
    replyContentPlaceholder: 'Reply content',
    replySubmit: 'Submit reply',
    more: 'More',
    empty: 'No messages yet, be the first to leave one!',
    prev: 'Prev',
    next: 'Next',
    required: 'Nickname, email and content are all required',
    invalidEmail: 'Please enter a valid email address'
  },

  errorMessages: {
    generic: 'Operation failed, please try again later',
    loadFailed: 'Loading failed, please refresh the page',
    rateLimited: 'Too many requests, please try again later'
  },

  // 故事动态文本：text1 = 第一行，text3 = 第二行（高亮填充）· story texts: text1 = line 1, text3 = line 2 (highlight)
  stories: {
    text1: ['To be honest,', 'A touch of blue,', 'Seize the day,'],
    text3: [
      'An elusive kind of candor pushes us to grow.',
      'Footprints on the road will never cease.',
      'Is the world we look up to so hard to reach?'
    ]
  }
}
