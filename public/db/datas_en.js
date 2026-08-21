// 从基础数据生成英文数据
// 注意：演唱会/城市数据已改由数据库 API 提供（见 js/api-loader.js），此处仅初始化空数据，
//       由 api-loader 填充。静态 UI 文案仍定义在 concertDataEN 中。
// Note: concert/city data now comes from the DB API (see js/api-loader.js); here we only
//       initialize empty data which api-loader fills. Static UI texts remain in concertDataEN.
function generateENData() {
    // 演唱会/城市初始为空，等待 api-loader 从 /api 填充
    // concerts/cities start empty, filled later by api-loader from /api
    return { concerts: [], cities: [] };
}

const { concerts: concertsEN, cities: citiesEN } = generateENData();

const concertDataEN = {
    pageTitle: "layicr's Concert Trail",
    bgMusic: "music/bgm_en.mp3", // English version background music
    profileLabel: "My name is:",
    profileSubtitle: "This is our concert, and it's your story。",

    concertsLabel: "Concerts",
    artistsLabel: "Artists",
    citiesLabel: "Cities",
    footerText: "",
    siteName: "layicr",
    modalTitle: "Tour Cities",
    ticketModalTitle: "Concert Journey",

    // Button texts
    buttons: {
        songlist: "View Songlist",
        watchVideo: "Watch Video",
        openVideo: "Open Video",
        backToTop: "Back to Top",
        feedback: "Report Issue"
    },

    // Tooltip texts
    tooltips: {
        musicToggle: "Play/Pause Background Music",
        musicToggleAria: "Play/Pause Background Music",
        feedback: "Report Issue",
        feedbackAria: "Report Issue to GitHub",
        backToTop: "Back to Top",
        backToTopAria: "Back to Page Top"
    },

    // Loading and status texts
    status: {
        loading: "Loading..."
    },

    // Songlist texts
    songlist: {
        totalSongs: "Total {count} songs",
        searchPlaceholder: "Search songs..."
    },

    // Feedback URL params
    feedback: {
        urlTitle: "[Bug Report]",
        urlBody: "Description:%0A%0APlease describe the issue you encountered in detail..."
    },

    // City list texts
    cityList: {
        concertsPrefix: "Concerts: ",
        concertsSuffix: ""
    },

    // Wish wall texts
    wishWall: {
        title: "Wish Wall",
        countPrefix: "Total: ",
        countSuffix: " wishes",
        emptyMessage: "No wishes yet, be the first to make one!"
    },

    // Time format texts
    timeFormat: {
        justNow: "Just now",
        minutesAgo: " min ago",
        hoursAgo: " hours ago",
        daysAgo: " days ago"
    },

    // Error messages
    errorMessages: {
        generic: "Operation failed, please try again later",
        network: "Network connection failed, please check your network",
        loadFailed: "Loading failed, please refresh the page",
        musicPlay: "Music playback failed",
        imageLoad: "Image loading failed"
    },

    cities: citiesEN,
    concerts: concertsEN
};

const storiesTextDataEN = {
    text1: [
        "To be honest,",
        "A touch of blue,",
        "Seize the day,"
    ],
    text2: [
        "",
        "",
        ""
    ],
    text3: [
        "An elusive kind of candor pushes us to grow.",
        "Footprints on the road will never cease.",
        "Is the world we look up to so hard to reach?"
    ]
};

const roleTextsEN = {
    declaration: "Declaration?",
    concertsLabel: "Concerts",
    citiesLabel: "Cities"
};

// 许愿数据已改由数据库 API 提供（见 js/api-loader.js），此处初始化为空数组，由 api-loader 填充。
// Wish data now comes from the DB API (see js/api-loader.js); starts empty, filled by api-loader.
const wishesDataEN = [];
