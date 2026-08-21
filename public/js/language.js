/**
 * 多语言支持模块
 *
 * @module language
 * @description 处理语言切换和页面内容更新，管理中英文双语显示
 * @requires config.js（CONFIG配置）
 * @requires utils.js（getLangData、t、safeHtml、formatWishTime函数）
 * @requires datas_zh.js、datas_en.js（concertDataZH、concertDataEN、wishesDataZH、wishesDataEN数据）
 *
 * 主要功能：
 * - updateLanguageButtons：更新语言按钮状态
 * - switchLanguage：切换语言并更新页面内容
 * - updatePageContent：更新页面所有文本内容
 * - renderCityList：渲染城市列表
 * - renderWishWall：渲染许愿墙
 *
 * 状态变量：
 * - currentLanguage：当前语言代码（'zh' 或 'en'）
 * - currentData：当前语言的数据对象
 */

// ==================== 状态变量 ====================
/** 当前语言代码（'zh' 中文 / 'en' 英文） */
let currentLanguage = 'zh';

/** 当前语言对应的数据对象 */
let currentData = concertDataZH;

// ==================== DOM 元素引用（缓存） ====================
/** 语言切换按钮集合 */
const langButtons = document.querySelectorAll('.lang-btn');

/** 城市列表容器（缓存避免重复查询） */
const cityListContainer = document.getElementById('cityList');

/** 许愿墙容器（缓存避免重复查询） */
const wishGridContainer = document.getElementById('wishGrid');
const wishTitleElement = document.getElementById('wishTitle');
const wishCountElement = document.getElementById('wishCount');

/** 角色列表容器（缓存避免重复查询） */
const rolesListContainer = document.getElementById('roles-list');

/** 角色跳转映射（索引 → 目标选择器） */
const roleTargetMap = {
    0: '.section-spacing',    // 第一项：故事区
    1: '#timeline',           // 第二项：时间轴
    2: '.stats-grid'          // 第三项：统计区
};

/**
 * 更新语言按钮状态
 * @description 根据当前语言，为对应按钮添加 active 类
 */
function updateLanguageButtons() {
    langButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === currentLanguage) {
            btn.classList.add('active');
        }
    });
}

/**
 * 更新页面内容
 * @description 切换语言后更新所有页面元素的文本内容
 *              包括：页面标题、个人信息、统计数据、按钮提示、城市列表、许愿墙
 */
function updatePageContent() {
    // 更新页面标题和语言属性
    document.title = currentData.pageTitle;
    document.documentElement.lang = currentLanguage;

    // 更新个人信息区域
    document.getElementById('profile-label').textContent = currentData.profileLabel;
    document.getElementById('profile-subtitle').textContent = currentData.profileSubtitle;

    // 更新角色列表（使用事件委托，避免为每个元素单独绑定）
    if (rolesListContainer) {
        rolesListContainer.innerHTML = '';
        currentData.roles.forEach((role, index) => {
            const li = document.createElement('li');
            li.className = 'role-item';
            li.textContent = role;
            li.dataset.roleIndex = index; // 存储索引用于事件委托
            rolesListContainer.appendChild(li);
        });
    }

    // 更新统计数据
    document.getElementById('total-concerts').textContent = currentData.totalConcerts;
    document.getElementById('total-artists').textContent = currentData.totalArtists;
    document.getElementById('total-cities').textContent = currentData.totalCities;
    document.getElementById('total-label').textContent = currentData.concertsLabel;
    document.getElementById('artists-label').textContent = currentData.artistsLabel;
    document.getElementById('cities-label').textContent = currentData.citiesLabel;

    // 更新页脚信息
    document.getElementById('footer-text').textContent = currentData.footerText;
    document.getElementById('site-name').textContent = currentData.siteName;

    // 更新模态框标题
    document.getElementById('city-modal-title').textContent = currentData.modalTitle;
    
    // 更新票根模态框标题
    const ticketModalTitle = document.getElementById('ticketModalTitle');
    if (ticketModalTitle) {
        ticketModalTitle.textContent = currentData.ticketModalTitle;
    }

    // 更新加载状态文本
    document.getElementById('loading-text').textContent = currentData.status.loading;

    // 更新浮动按钮的工具提示（支持无障碍访问）
    const musicToggle = document.getElementById('musicToggle');
    musicToggle.title = currentData.tooltips.musicToggle;
    musicToggle.setAttribute('aria-label', currentData.tooltips.musicToggleAria);

    const feedbackBtn = document.getElementById('feedbackBtn');
    feedbackBtn.title = currentData.tooltips.feedback;
    feedbackBtn.setAttribute('aria-label', currentData.tooltips.feedbackAria);

    const backToTop = document.getElementById('backToTop');
    backToTop.title = currentData.tooltips.backToTop;
    backToTop.setAttribute('aria-label', currentData.tooltips.backToTopAria);

    // 渲染动态列表
    renderCityList();
    renderWishWall();

    // 更新歌单搜索框placeholder
    if (typeof updateSearchPlaceholder === 'function') {
        updateSearchPlaceholder();
    }

    // 更新页脚友情链接
    if (typeof window.updateFriendLinks === 'function') {
        window.updateFriendLinks();
    }
}

/**
 * 渲染城市列表
 * @description 使用 DocumentFragment 批量插入，减少 DOM 操作次数
 *              使用 DOM 操作安全创建城市卡片，避免 XSS 风险
 * @performance 使用 Fragment 后只触发一次 reflow，而非 N 次
 */
function renderCityList() {
    // 使用缓存的容器引用
    if (!cityListContainer) return;
    
    cityListContainer.innerHTML = '';
    
    // 创建 DocumentFragment 批量操作
    const fragment = document.createDocumentFragment();

    currentData.cities.forEach(city => {
        // 创建城市卡片容器
        const cityItem = document.createElement('div');
        cityItem.className = 'city-item';

        // 城市图标（emoji）
        const iconDiv = document.createElement('div');
        iconDiv.className = 'city-icon';
        iconDiv.textContent = city.icon; // 安全：textContent 自动转义
        cityItem.appendChild(iconDiv);

        // 城市信息容器
        const infoDiv = document.createElement('div');
        infoDiv.className = 'city-info';

        // 城市名称
        const nameDiv = document.createElement('div');
        nameDiv.className = 'city-name';
        nameDiv.textContent = city.name; // 安全：textContent 自动转义
        infoDiv.appendChild(nameDiv);

        // 演唱会场次（使用配置化的前缀和后缀）
        const concertsDiv = document.createElement('div');
        concertsDiv.className = 'city-concerts';
        concertsDiv.textContent = currentData.cityList.concertsPrefix + city.concerts + currentData.cityList.concertsSuffix;
        infoDiv.appendChild(concertsDiv);

        cityItem.appendChild(infoDiv);
        fragment.appendChild(cityItem);
    });

    // 批量插入（只触发一次 reflow）
    cityListContainer.appendChild(fragment);
}

/**
 * 渲染许愿墙
 * @description 使用事件委托处理点赞，减少事件监听器数量
 *              使用 DocumentFragment 批量插入，优化性能
 *              空状态时显示提示信息
 * @performance 事件委托：N个卡片只需1个监听器，而非N个
 */
function renderWishWall() {
    // 根据当前语言选择许愿数据
    const wishes = currentLanguage === 'zh' ? wishesDataZH : wishesDataEN;
    
    // 使用缓存的容器引用
    if (!wishGridContainer || !wishTitleElement || !wishCountElement) return;

    // 更新标题
    wishTitleElement.textContent = currentData.wishWall.title;

    // 更新计数（简化版）
    wishCountElement.textContent = currentData.wishWall.countPrefix + wishes.length + currentData.wishWall.countSuffix;

    // 清空许愿网格
    wishGridContainer.innerHTML = '';

    // 空状态处理：显示提示信息
    if (wishes.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'wish-empty';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'wish-empty-icon';
        iconDiv.textContent = '🌙';
        emptyDiv.appendChild(iconDiv);

        const textDiv = document.createElement('div');
        textDiv.className = 'wish-empty-text';
        textDiv.textContent = currentData.wishWall.emptyMessage;
        emptyDiv.appendChild(textDiv);

        wishGridContainer.appendChild(emptyDiv);
        return;
    }

    // 创建 DocumentFragment 批量操作
    const fragment = document.createDocumentFragment();

    // 渲染许愿卡片
    wishes.forEach((wish, index) => {
        const card = document.createElement('div');
        card.className = 'wish-card';
        card.dataset.index = index; // 存储索引用于事件委托

        // 许愿内容（安全：textContent 自动转义）
        const contentDiv = document.createElement('div');
        contentDiv.className = 'wish-card-content';
        contentDiv.textContent = wish.content;
        card.appendChild(contentDiv);

        // 卡片底部：点赞和时间
        const footerDiv = document.createElement('div');
        footerDiv.className = 'wish-card-footer';

        // 点赞区域
        const likesDiv = document.createElement('div');
        likesDiv.className = 'wish-card-likes' + (wish.liked ? ' liked' : '');
        
        // 心形图标（已点赞：红心，未点赞：白心）
        const heartSpan = document.createElement('span');
        heartSpan.textContent = wish.liked ? '❤️' : '🤍';
        likesDiv.appendChild(heartSpan);

        // 点赞数量
        const countSpan = document.createElement('span');
        countSpan.textContent = wish.likes || 0;
        likesDiv.appendChild(countSpan);

        footerDiv.appendChild(likesDiv);

        // 时间显示（使用相对时间格式化）
        const timeDiv = document.createElement('div');
        timeDiv.className = 'wish-card-time';
        timeDiv.textContent = formatWishTime(wish.time);
        footerDiv.appendChild(timeDiv);

        card.appendChild(footerDiv);
        fragment.appendChild(card);
    });

    // 批量插入
    wishGridContainer.appendChild(fragment);
}

/**
 * 许愿墙点赞点击处理（事件委托）
 * @param {Event} e - 点击事件
 * @description 通过事件委托统一处理所有点赞点击，减少内存占用
 */
function handleWishLikeClick(e) {
    // 查找点赞按钮（可能是 likesDiv 或其子元素）
    const likesDiv = e.target.closest('.wish-card-likes');
    if (!likesDiv) return;

    // 从父卡片获取索引
    const card = likesDiv.closest('.wish-card');
    if (!card) return;

    const index = parseInt(card.dataset.index, 10);
    toggleWishLike(index);
}

/**
 * 切换许愿点赞状态
 * @param {number} index - 许愿卡片索引
 * @description 点击心形图标切换点赞状态，更新点赞数并重新渲染
 */
function toggleWishLike(index) {
    const wishes = currentLanguage === 'zh' ? wishesDataZH : wishesDataEN;
    if (wishes[index]) {
        wishes[index].liked = !wishes[index].liked;
        wishes[index].likes = (wishes[index].likes || 0) + (wishes[index].liked ? 1 : -1);
        renderWishWall();
    }
}

/**
 * 切换语言
 * @param {string} lang - 目标语言代码（'zh' 或 'en'）
 * @description 切换语言并更新所有相关内容：
 *              1. 清除所有定时器
 *              2. 更新状态变量
 *              3. 保存语言偏好到 localStorage
 *              4. 更新页面内容和时间轴
 *              5. 切换背景音乐
 *              6. 重新初始化数据展示和动态文本
 */
function switchLanguage(lang) {
    // 避免重复切换
    if (lang !== currentLanguage) {
        // 清除所有定时器（动态文本、轮播等）
        clearAllTimers();

        // 更新状态变量
        currentLanguage = lang;
        currentData = getLangData(concertDataZH, concertDataEN);

        // 更新 UI 和保存偏好
        updateLanguageButtons();
        localStorage.setItem('concertJourneyLang', currentLanguage);
        updatePageContent();
        renderTimeline();

        // 切换背景音乐源
        if (currentData.bgMusic) {
            switchMusicSrc(currentData.bgMusic);
        }

        // 重新初始化动态组件
        initDataShowcase();
        init3DAlbumShowcase();
        initStoriesText();
        startDynamicTextTimers();
    }
}

// ==================== 事件绑定 ====================
// 注：许愿墙点赞已改为纯静态展示，不再绑定点击事件（无点击效果）。
// 如需恢复可重新绑定：wishGridContainer.addEventListener('click', handleWishLikeClick);

// 角色列表跳转事件委托
rolesListContainer.addEventListener('click', handleRoleClick);

// 语言按钮点击事件
langButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const lang = this.dataset.lang;
        switchLanguage(lang);
    });
});

/**
 * 角色列表点击处理（事件委托）
 * @param {Event} e - 点击事件
 * @description 通过事件委托统一处理角色点击跳转，减少内存占用
 */
function handleRoleClick(e) {
    const roleItem = e.target.closest('.role-item');
    if (!roleItem) return;

    const index = parseInt(roleItem.dataset.roleIndex, 10);
    const targetSelector = roleTargetMap[index] || '#timeline';
    const targetElement = document.querySelector(targetSelector);

    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}