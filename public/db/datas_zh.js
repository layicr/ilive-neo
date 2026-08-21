const showFirStr = "->   ";

// 从基础数据生成中文数据
// 注意：演唱会/城市数据已改由数据库 API 提供（见 js/api-loader.js），此处仅初始化空数据，
//       由 api-loader 填充。静态 UI 文案仍定义在 concertDataZH 中。
// Note: concert/city data now comes from the DB API (see js/api-loader.js); here we only
//       initialize empty data which api-loader fills. Static UI texts remain in concertDataZH.
function generateZHData() {
    // 演唱会/城市初始为空，等待 api-loader 从 /api 填充
    // concerts/cities start empty, filled later by api-loader from /api
    return { concerts: [], cities: [] };
}

const { concerts: concertsZH, cities: citiesZH } = generateZHData();

const concertDataZH = {
    pageTitle: "Layicr演唱会足迹",
    bgMusic: "music/bgm_cn.mp3", // 中文版本背景音乐
    profileLabel: "我的名字是:",
    profileSubtitle: "这是我们的演唱会，也是你的故事。",

    concertsLabel: "场次",
    artistsLabel: "艺人",
    citiesLabel: "城市",
    footerText: "",
    siteName: "Layicr",
    modalTitle: "演唱会城市",
    ticketModalTitle: "演唱会足迹",

    // 按钮文本
    buttons: {
        songlist: "查看歌单",
        watchVideo: "观看视频",
        openVideo: "打开视频",
        backToTop: "返回顶部",
        feedback: "反馈问题"
    },

    // 工具提示文本
    tooltips: {
        musicToggle: "播放/暂停背景音乐",
        musicToggleAria: "播放/暂停背景音乐",
        feedback: "反馈问题",
        feedbackAria: "反馈问题到GitHub",
        backToTop: "返回顶部",
        backToTopAria: "返回页面顶部"
    },

    // 加载和状态文本
    status: {
        loading: "加载中..."
    },

    // 歌单文本
    songlist: {
        totalSongs: "共 {count} 首歌曲",
        searchPlaceholder: "搜索歌曲..."
    },

    // 反馈URL参数
    feedback: {
        urlTitle: "[问题反馈]",
        urlBody: "问题描述：%0A%0A请在此处详细描述您遇到的问题..."
    },

    // 城市列表文本
    cityList: {
        concertsPrefix: "举办演唱会：",
        concertsSuffix: "场"
    },

    // 许愿墙文本
    wishWall: {
        title: "许愿墙",
        countPrefix: "已有 ",
        countSuffix: " 个心愿",
        emptyMessage: "还没有人许愿，来做第一个许愿的人吧！"
    },

    // 时间格式文本
    timeFormat: {
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前"
    },

    // 错误提示文本
    errorMessages: {
        generic: "操作失败，请稍后重试",
        network: "网络连接失败，请检查网络",
        loadFailed: "加载失败，请刷新页面",
        musicPlay: "音乐播放失败",
        imageLoad: "图片加载失败"
    },

    cities: citiesZH,
    concerts: concertsZH
};


const storiesTextDataZH = {
    text1: [
        "说真的，",
        "一抹蓝，",
        "争朝夕，"
    ],
    text2: [
        "",
        "",
        ""
    ],
    text3: [
        "似有若无的坦荡，强迫我们成长。",
        "路上的脚印，永远不会停歇。",
        "抬头仰望的世界，是不是难以到达？"
    ]
};

const roleTextsZH = {
    declaration: "宣言？   xuān yán？",
    concertsLabel: "演唱会",
    citiesLabel: "城市"
};

// 许愿数据已改由数据库 API 提供（见 js/api-loader.js），此处初始化为空数组，由 api-loader 填充。
// Wish data now comes from the DB API (see js/api-loader.js); starts empty, filled by api-loader.
const wishesDataZH = [];
