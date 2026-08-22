/**
 * 英文 UI 文案 · English UI texts
 *
 * @description 从 public/db/datas_en.js 迁移而来。
 *              仅含静态 UI 文案；演唱会/城市/许愿数据由服务端 API 提供。
 */

export const en = {
  pageTitle: "layicr's Concert Trail",
  bgMusic: 'music/bgm_en.mp3',
  profileLabel: 'My name is:',
  profileSubtitle: "This is our concert, and it's your story。",

  concertsLabel: 'Concerts',
  artistsLabel: 'Artists',
  citiesLabel: 'Cities',
  footerText: '',
  siteName: 'layicr',
  modalTitle: 'Tour Cities',
  ticketModalTitle: 'Concert Journey',
  rolesPrefix: '->   ',

  roles: {
    declaration: 'Declaration?',
    concertsLabel: 'Concerts',
    citiesLabel: 'Cities'
  },

  roleTarget: {
    declaration: '.section-spacing',
    concerts: '#timeline',
    cities: '.stats-grid'
  },

  buttons: {
    songlist: 'View Songlist',
    watchVideo: 'Watch Video',
    openVideo: 'Open Video',
    backToTop: 'Back to Top',
    feedback: 'Report Issue'
  },

  tooltips: {
    musicToggle: 'Play/Pause Background Music',
    musicToggleAria: 'Play/Pause Background Music',
    feedback: 'Report Issue',
    feedbackAria: 'Report Issue to GitHub',
    backToTop: 'Back to Top',
    backToTopAria: 'Back to Page Top'
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
    urlBody: 'Description:%0A%0APlease describe the issue you encountered in detail...'
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

  timeFormat: {
    justNow: 'Just now',
    minutesAgo: ' min ago',
    hoursAgo: ' hours ago',
    daysAgo: ' days ago'
  },

  errorMessages: {
    generic: 'Operation failed, please try again later',
    network: 'Network connection failed, please check your network',
    loadFailed: 'Loading failed, please refresh the page',
    musicPlay: 'Music playback failed',
    imageLoad: 'Image loading failed'
  }
} as const;

/** 故事动态文本 · Stories dynamic texts */
export const storiesTextDataEN = {
  text1: ['To be honest,', 'A touch of blue,', 'Seize the day,'],
  text2: ['', '', ''],
  text3: [
    'An elusive kind of candor pushes us to grow.',
    'Footprints on the road will never cease.',
    'Is the world we look up to so hard to reach?'
  ]
} as const;

/** 角色文本 · Role texts */
export const roleTextsEN = {
  declaration: 'Declaration?',
  concertsLabel: 'Concerts',
  citiesLabel: 'Cities'
} as const;
