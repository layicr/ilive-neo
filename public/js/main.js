/**
 * 主逻辑模块
 *
 * @module main
 * @description 初始化和核心渲染功能，协调各模块工作
 * @requires config.js（CONFIG配置）
 * @requires utils.js（getLangData、applyComputedProperties函数）
 * @requires error.js（ErrorHandler错误处理）
 * @requires language.js（currentLanguage、currentData变量、updatePageContent函数）
 * @requires gallery.js（initGallery函数）
 * @requires music.js（initMusic函数）
 * @requires datas_zh.js、datas_en.js（数据文件）
 * @requires GSAP库（动画库）
 *
 * 主要功能：
 * - initPage：页面初始化入口
 * - renderTimeline：渲染时间轴（演唱会列表）
 * - initDynamicText：初始化动态文本（故事区）
 * - playHighlightAnimation：播放高亮动画
 * - initCarousel：初始化专辑轮播
 * - switchConcert：切换演唱会详情
 * - initScrollAnimations：初始化滚动动画
 * - 性能监控：记录关键渲染时间
 *
 * 状态变量：
 * - textIndices：动态文本索引数组
 * - dynamicTextElements：动态文本元素数组
 * - timers：定时器管理对象
 *
 * DOM元素：
 * - timeline：时间轴容器
 * - loader：加载器容器
 * - loadingText：加载文本
 * - prevConcert/nextConcert：演唱会切换按钮
 */

// ==================== 状态变量 ====================
// 动态文本状态
let textIndices = [0, 0, 0];
const dynamicTextElements = [];

// 票根模态框状态
let currentTicketIndex = 0;
let totalTickets = 0;

// 统一管理定时器
const timers = {
    dynamicTexts: [],
    carousel: null
};

// DOM 元素引用
const timeline = document.getElementById('timeline');
const loader = document.getElementById('loader');
const loadingText = document.getElementById('loading-text');
const prevConcert = document.getElementById('prevConcert');
const nextConcert = document.getElementById('nextConcert');

// ==================== 初始化页面 ====================
function initPage() {
    // 初始化语言
    const savedLang = localStorage.getItem('concertJourneyLang');
    if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
        currentLanguage = savedLang;
    } else {
        currentLanguage = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    // 显示 skeleton-loader 文本
    setTimeout(() => {
        const scrambleLines = document.querySelectorAll('.scramble-line');

        scrambleLines.forEach((line, index) => {
            const text = line.getAttribute('data-text');

            line.style.opacity = '1';
            line.style.visibility = 'visible';
            line.style.color = '#e0e0ff';
            line.style.display = 'flex';

            line.textContent = text;
        });
    }, 100);

    // 应用计算属性
    applyComputedProperties(concertDataZH, showFirStr);
    applyComputedProperties(concertDataEN, '->   ');

    currentData = getLangData(concertDataZH, concertDataEN);

    // 注：Service Worker 由 @vite-pwa/nuxt 模块自动生成并注册（见 nuxt.config.ts pwa 配置），
    // 此处不再手动注册手写 sw.js。
    // Note: Service Worker is auto-generated & registered by @vite-pwa/nuxt (see pwa config in
    // nuxt.config.ts); the manual registration of the old hand-written sw.js is removed.

    updateLanguageButtons();
    updatePageContent();
    renderTimeline();
    initDataShowcase();
    init3DAlbumShowcase();
    initTicketModal();
}

// ==================== 时间轴渲染 ====================
function renderTimeline() {
    if ('performance' in window) {
        performance.mark('timeline-render-start');
    }

    loader.style.display = 'block';
    timeline.innerHTML = '';

    setTimeout(() => {
        const sortedConcerts = [...currentData.concerts].sort((a, b) => {
            return b.id - a.id;
        });

        const fragment = document.createDocumentFragment();

        sortedConcerts.forEach((concert, index) => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.style.animationDelay = `${index * 0.1}s`;

            let galleryContainer = null;
            if (concert.images && concert.images.length > 0) {
                galleryContainer = document.createElement('div');
                galleryContainer.className = 'gallery';

                const galleryFragment = document.createDocumentFragment();
                concert.images.forEach((img, imgIndex) => {
                    const galleryItem = createGalleryItem(img, imgIndex, concert.images);
                    galleryFragment.appendChild(galleryItem);
                });
                galleryContainer.appendChild(galleryFragment);
            }

            const timelineContent = document.createElement('div');
            timelineContent.className = 'timeline-content';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'concert-date';
            dateDiv.textContent = concert.date + (concert.time ? ' ' + concert.time : '');
            timelineContent.appendChild(dateDiv);

            const artistH2 = document.createElement('h2');
            artistH2.className = 'concert-artist';
            artistH2.textContent = concert.artist;
            timelineContent.appendChild(artistH2);

            if (concert.concertName) {
                const nameDiv = document.createElement('div');
                nameDiv.className = 'concert-name';
                nameDiv.textContent = concert.concertName;
                timelineContent.appendChild(nameDiv);
            }

            const locationDiv = document.createElement('div');
            locationDiv.className = 'concert-location';

            // 安全创建图标和文本
            const iconElement = document.createElement('i');
            iconElement.className = 'fas fa-map-marker-alt';
            iconElement.setAttribute('aria-hidden', 'true');
            locationDiv.appendChild(iconElement);

            const locationText = document.createTextNode(' ' + concert.location);
            locationDiv.appendChild(locationText);

            timelineContent.appendChild(locationDiv);

            // 添加座位和价格信息（同一行）
            if (concert.seat || concert.price) {
                const seatPriceDiv = document.createElement('div');
                seatPriceDiv.className = 'concert-seat-price';
                
                // 座位信息
                if (concert.seat) {
                    const seatSpan = document.createElement('span');
                    seatSpan.className = 'seat-info';
                    
                    const seatIcon = document.createElement('i');
                    seatIcon.className = 'fas fa-chair';
                    seatIcon.setAttribute('aria-hidden', 'true');
                    seatSpan.appendChild(seatIcon);
                    
                    const seatText = document.createTextNode(' ' + concert.seat);
                    seatSpan.appendChild(seatText);
                    
                    seatPriceDiv.appendChild(seatSpan);
                }
                
                // 分隔符
                if (concert.seat && concert.price) {
                    const separator = document.createElement('span');
                    separator.className = 'seat-price-separator';
                    separator.textContent = ' | ';
                    seatPriceDiv.appendChild(separator);
                }
                
                // 价格信息
                if (concert.price) {
                    const priceSpan = document.createElement('span');
                    priceSpan.className = 'price-info';
                    
                    const priceIcon = document.createElement('i');
                    priceIcon.className = 'fas fa-ticket-alt';
                    priceIcon.setAttribute('aria-hidden', 'true');
                    priceSpan.appendChild(priceIcon);
                    
                    const priceText = document.createTextNode(' ' + concert.price);
                    priceSpan.appendChild(priceText);
                    
                    seatPriceDiv.appendChild(priceSpan);
                }
                
                timelineContent.appendChild(seatPriceDiv);
            }

            if (concert.tags && concert.tags.length > 0) {
                const tagsDiv = document.createElement('div');
                tagsDiv.className = 'concert-tags';

                const tagsFragment = document.createDocumentFragment();
                concert.tags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';
                    tagSpan.textContent = tag;
                    tagsFragment.appendChild(tagSpan);
                });
                tagsDiv.appendChild(tagsFragment);
                timelineContent.appendChild(tagsDiv);
            }

            const descDiv = document.createElement('div');
            descDiv.className = 'concert-description';
            descDiv.innerHTML = safeHtml(concert.description); // 安全HTML处理
            timelineContent.appendChild(descDiv);

            if (galleryContainer) {
                timelineContent.appendChild(galleryContainer);
            }

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'timeline-buttons';

            if (concert.songlist && concert.songlist.length > 0) {
                const songlistButton = document.createElement('button');
                songlistButton.className = 'songlist-btn';
                songlistButton.innerHTML = '<i class="fas fa-music"></i> ' + currentData.buttons.songlist;
                songlistButton.dataset.songlist = JSON.stringify(concert.songlist);
                songlistButton.dataset.artist = concert.artist;
                songlistButton.dataset.concertName = concert.concertName;
                songlistButton.addEventListener('click', function() {
                    openSonglistModal(JSON.parse(this.dataset.songlist), this.dataset.artist, this.dataset.concertName);
                });
                buttonContainer.appendChild(songlistButton);
            }

            if (concert.video) {
                const videoButton = document.createElement('button');
                videoButton.className = 'video-btn';
                videoButton.innerHTML = '<i class="fas fa-video"></i> ' + currentData.buttons.watchVideo;
                videoButton.dataset.videoId = concert.video;
                videoButton.dataset.videoTitle = concert.artist + ' - ' + concert.concertName;
                videoButton.addEventListener('click', function() {
                    openVideoModal(this.dataset.videoId, this.dataset.videoTitle);
                });
                buttonContainer.appendChild(videoButton);
            }

            if (concert.videoUrl) {
                const videoLinkButton = document.createElement('button');
                videoLinkButton.className = 'video-link-btn';
                videoLinkButton.innerHTML = '<i class="fas fa-external-link-alt"></i> ' + currentData.buttons.openVideo;
                videoLinkButton.dataset.videoUrl = concert.videoUrl;
                videoLinkButton.addEventListener('click', function() {
                    window.open(this.dataset.videoUrl, '_blank');
                });
                buttonContainer.appendChild(videoLinkButton);
            }

            if (buttonContainer.children.length > 0) {
                timelineContent.appendChild(buttonContainer);
            }

            timelineItem.appendChild(timelineContent);
            fragment.appendChild(timelineItem);
        });

        timeline.appendChild(fragment);

        loader.style.display = 'none';

        const skeletonLoader = document.getElementById('skeleton-loader');
        if (skeletonLoader) {
            setTimeout(() => {
                skeletonLoader.classList.add('hide');
                setTimeout(() => {
                    skeletonLoader.style.display = 'none';
                }, CONFIG.ANIMATION_DURATION);
            }, CONFIG.SKELETON_MIN_WAIT);
        }

        observeTimelineItems();

        if ('performance' in window) {
            performance.mark('timeline-render-end');
            performance.measure('timeline-render', 'timeline-render-start', 'timeline-render-end');

            const measure = performance.getEntriesByName('timeline-render')[0];
            if (measure) {
                console.log(`时间轴渲染耗时: ${measure.duration.toFixed(2)}ms`);
            }
        }

        if ('PerformanceObserver' in window) {
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log(`LCP: ${lastEntry.startTime}ms`);
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            const fidObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                for (const entry of entries) {
                    console.log(`FID: ${entry.processingStart - entry.startTime}ms`);
                }
            });
            fidObserver.observe({ entryTypes: ['first-input'] });

            let clsValue = 0;
            const clsObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                }
                console.log(`CLS: ${clsValue}`);
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
        }
    }, CONFIG.TIMELINE_RENDER_DELAY);
}

// 观察时间轴项
function observeTimelineItems() {
    const timelineItems = document.querySelectorAll('.timeline-item');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: CONFIG.INTERSECTION_THRESHOLD });

    timelineItems.forEach(item => {
        observer.observe(item);
    });
}

// ==================== 定时器管理 ====================
function clearAllTimers() {
    timers.dynamicTexts.forEach(clearInterval);
    timers.dynamicTexts = [];
    if (timers.carousel) {
        clearInterval(timers.carousel);
        timers.carousel = null;
    }
}

// ==================== 动态文本功能 ====================
const dynamicText1 = document.getElementById('dynamic-text-1');
const dynamicText2 = document.getElementById('dynamic-text-2');
const dynamicText3 = document.getElementById('dynamic-text');

dynamicTextElements.push(dynamicText1, dynamicText2, dynamicText3);

function playHighlightAnimation() {
    dynamicText3.classList.remove('animate');
    void dynamicText3.offsetWidth;
    dynamicText3.classList.add('animate');
}

function updateDynamicText(textIndex) {
    const storiesTextData = getLangData(storiesTextDataZH, storiesTextDataEN);
    const textArrays = [storiesTextData.text1, storiesTextData.text2, storiesTextData.text3];
    const textArray = textArrays[textIndex];
    const element = dynamicTextElements[textIndex];

    if (!element || textArray.length === 0) return;

    element.style.opacity = '0';
    element.style.transition = 'opacity 0.3s ease';

    setTimeout(() => {
        textIndices[textIndex] = (textIndices[textIndex] + 1) % textArray.length;
        element.textContent = textArray[textIndices[textIndex]];
        element.style.opacity = '1';

        if (textIndex === 2) {
            setTimeout(playHighlightAnimation, 100);
        }
    }, 300);
}

function initStoriesText() {
    const storiesTextData = getLangData(storiesTextDataZH, storiesTextDataEN);
    dynamicTextElements.forEach((el, i) => {
        if (el && storiesTextData[`text${i + 1}`]) {
            el.textContent = storiesTextData[`text${i + 1}`][0];
        }
    });
    setTimeout(playHighlightAnimation, CONFIG.HIGHLIGHT_ANIMATION_DELAY);
}

function startDynamicTextTimers() {
    timers.dynamicTexts.push(
        setInterval(() => updateDynamicText(0), CONFIG.DYNAMIC_TEXT_INTERVAL),
        setInterval(() => updateDynamicText(1), CONFIG.DYNAMIC_TEXT_INTERVAL),
        setInterval(() => updateDynamicText(2), CONFIG.DYNAMIC_TEXT_INTERVAL)
    );
}

// 监听语言切换
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(initStoriesText, 100));
});

// 页面加载初始化
initStoriesText();
startDynamicTextTimers();

// ==================== 数据展示区域 ====================
function initDataShowcase() {
    setTimeout(initLazyLoad, CONFIG.IMAGE_LOAD_DELAY);
}

// 图片懒加载 Observer
function initLazyLoad() {
    const lazyImages = document.querySelectorAll('.lazy-load');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-load');
                    img.classList.add('lazy-loaded');
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: `${CONFIG.LAZY_LOAD_THRESHOLD}px` });

        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
        });
    }
}

// ==================== 3D专辑展示功能 ====================
function init3DAlbumShowcase() {
    const albumStack = document.getElementById('albumStack');
    if (!albumStack) return;

    if (timers.carousel) {
        clearInterval(timers.carousel);
        timers.carousel = null;
    }

    const newAlbumStack = albumStack.cloneNode(true);
    albumStack.parentNode.replaceChild(newAlbumStack, albumStack);

    newAlbumStack.innerHTML = '';

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;

    const ANIMATION_DURATION = isMobile ? 0.7 : 1.0;
    const ANIMATION_EASE = isMobile ? "power2.out" : "power3.inOut";

    const albums = currentData.concerts.map(concert => ({
        id: concert.id,
        title: concert.concertName,
        subtitle: concert.artist,
        date: concert.date,
        intro: concert.theme,
        image: concert.poster
    }));

    let currentAlbumIndex = 0;

    function updateConcertNavButtons() {
        prevConcert.disabled = currentAlbumIndex === 0;
        nextConcert.disabled = currentAlbumIndex === albums.length - 1;

        prevConcert.classList.toggle('disabled', currentAlbumIndex === 0);
        nextConcert.classList.toggle('disabled', currentAlbumIndex === albums.length - 1);
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    albums.forEach((album, index) => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.id = `album-${album.id}`;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="album-cover">
                <img class="album-cover-img"
                     src="${escapeHtml(album.image)}"
                     alt="${escapeHtml(album.title)}">
            </div>
        `;

        newAlbumStack.appendChild(card);

        card.addEventListener('click', () => {
            selectAlbum(index);
        });
    });

    function initAlbumStack() {
        applyCarouselLayout(0);
        if (albums.length > 0) {
            const firstAlbum = albums[0];
            document.getElementById('detailTitle').textContent = firstAlbum.title;
            document.getElementById('detailSubtitle').textContent = firstAlbum.subtitle;
            document.getElementById('detailDate').textContent = `${firstAlbum.date}${firstAlbum.time ? ' ' + firstAlbum.time : ''} `;
            document.getElementById('albumIntro').textContent = firstAlbum.intro;
        }
    }

    const carouselParams = {
        radius: isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_RADIUS : CONFIG.ALBUM_CAROUSEL.DESKTOP_RADIUS,
        selectedX: isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_X : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_X,
        selectedY: isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_Y : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_Y,
        selectedScale: isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_SCALE : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_SCALE
    };

    function applyCarouselLayout(selectedIndex = 0) {
        const cards = document.querySelectorAll('.album-card');
        const { radius, selectedX, selectedY, selectedScale } = carouselParams;

        cards.forEach((card, i) => {
            const isSelected = i === selectedIndex;
            const diff = Math.abs(i - selectedIndex);
            const baseScale = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_BASE_SCALE : CONFIG.ALBUM_CAROUSEL.DESKTOP_BASE_SCALE;
            const scaleDecrement = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.SCALE_DECREMENT_MOBILE : CONFIG.ALBUM_CAROUSEL.SCALE_DECREMENT_DESKTOP;
            const scale = baseScale - diff * scaleDecrement;

            if (isSelected) {
                gsap.to(card, {
                    duration: ANIMATION_DURATION,
                    x: selectedX,
                    y: selectedY,
                    z: radius + 50,
                    rotationY: 0,
                    rotationX: 0,
                    scale: selectedScale,
                    ease: ANIMATION_EASE
                });
                card.style.zIndex = cards.length + 1;
            } else {
                const angle = (i / cards.length) * Math.PI * 2;
                gsap.to(card, {
                    duration: ANIMATION_DURATION,
                    x: Math.sin(angle) * radius,
                    y: 0,
                    z: Math.cos(angle) * radius - radius,
                    rotationY: (angle * 180 / Math.PI) - 90,
                    rotationX: 0,
                    scale: Math.max(scale, CONFIG.ALBUM_CAROUSEL.MIN_SCALE),
                    ease: ANIMATION_EASE
                });
                card.style.zIndex = cards.length - diff;
            }
        });
    }

    function selectAlbum(index) {
        if (index === currentAlbumIndex) return;
        // 空数组或非法索引保护（去掉静态数据后可能无演唱会数据）
        // guard against empty albums or invalid index (no concert data after removing static fallback)
        if (!albums.length || index < 0 || index >= albums.length) return;

        currentAlbumIndex = index;
        const selectedAlbum = albums[index];

        document.getElementById('detailTitle').textContent = selectedAlbum.title;
        document.getElementById('detailSubtitle').textContent = selectedAlbum.subtitle;
        document.getElementById('detailDate').textContent = `${selectedAlbum.date}${selectedAlbum.time ? ' ' + selectedAlbum.time : ''} `;
        document.getElementById('albumIntro').textContent = selectedAlbum.intro;

        applyCarouselLayout(index);

        updateConcertNavButtons();
    }

    newAlbumStack.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    newAlbumStack.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;

        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
            if (diffX > 0 && currentAlbumIndex < albums.length - 1) {
                selectAlbum(currentAlbumIndex + 1);
            } else if (diffX < 0 && currentAlbumIndex > 0) {
                selectAlbum(currentAlbumIndex - 1);
            }
        }
    }, { passive: true });

    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            applyCarouselLayout(currentAlbumIndex);
        }, CONFIG.DEBOUNCE_RESIZE_DELAY);
    });

    setTimeout(() => {
        gsap.from(".album-stack-container", {
            duration: CONFIG.GSAP_ALBUM_DURATION,
            x: isSmallScreen ? 0 : -40,
            opacity: 0,
            delay: CONFIG.GSAP_ALBUM_DELAY,
            ease: "back.out(1.6)"
        });

        gsap.from(".detail-panel", {
            duration: CONFIG.GSAP_ALBUM_DURATION,
            x: isSmallScreen ? 0 : 40,
            opacity: 0,
            delay: CONFIG.GSAP_PANEL_DELAY,
            ease: "back.out(1.6)"
        });
    }, CONFIG.IMAGE_LOAD_DELAY);

    initAlbumStack();

    // 无演唱会数据时禁用自动轮播，避免空数组触发 NaN 与 undefined 访问
    // disable auto-carousel when there is no concert data (avoids NaN / undefined access)
    if (albums.length > 0) {
        timers.carousel = setInterval(() => {
            const nextIndex = (currentAlbumIndex + 1) % albums.length;
            selectAlbum(nextIndex);
        }, CONFIG.CAROUSEL_INTERVAL);
    }

    newAlbumStack.addEventListener('mouseenter', () => {
        if (timers.carousel) {
            clearInterval(timers.carousel);
            timers.carousel = null;
        }
    });

    newAlbumStack.addEventListener('mouseleave', () => {
        // 无数据时不重建轮播（避免空数组报错）
        // do not rebuild the carousel when there is no data
        if (!timers.carousel && albums.length > 0) {
            timers.carousel = setInterval(() => {
                const nextIndex = (currentAlbumIndex + 1) % albums.length;
                selectAlbum(nextIndex);
            }, CONFIG.CAROUSEL_INTERVAL);
        }
    });

    prevConcert.addEventListener('click', () => {
        if (currentAlbumIndex > 0) {
            selectAlbum(currentAlbumIndex - 1);
        }
    });

    nextConcert.addEventListener('click', () => {
        if (currentAlbumIndex < albums.length - 1) {
            selectAlbum(currentAlbumIndex + 1);
        }
    });

    updateConcertNavButtons();
}

// ==================== 票根模态框功能 ====================
/**
 * 初始化票根模态框
 * @description 为场次统计卡片添加点击事件，打开票根展示模态框
 */
function initTicketModal() {
    const totalConcertsElement = document.getElementById('total-concerts');
    const totalConcertsContainer = totalConcertsElement ? totalConcertsElement.parentElement : null;

    if (totalConcertsContainer) {
        totalConcertsContainer.style.cursor = 'pointer';
        totalConcertsContainer.addEventListener('click', openTicketModal);
    }

    // 关闭按钮
    const closeBtn = document.getElementById('closeTicketModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTicketModal);
    }

    // 点击遮罩层关闭
    const overlay = document.getElementById('ticketModalOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeTicketModal);
    }

    // 使用KeyboardManager注册键盘事件（高优先级）
    if (window.KeyboardManager) {
        window.KeyboardManager.register('ArrowLeft', handleTicketKeydown, 5);
        window.KeyboardManager.register('ArrowRight', handleTicketKeydown, 5);
        window.KeyboardManager.register('Home', handleTicketKeydown, 5);
        window.KeyboardManager.register('End', handleTicketKeydown, 5);
    }
}

/**
 * 打开票根模态框
 * @description 渲染所有演唱会票根并显示模态框
 */
function openTicketModal() {
    const modal = document.getElementById('ticketModal');
    const container = document.getElementById('ticketContainer');
    const titleElement = document.getElementById('ticketModalTitle');

    if (!modal || !container) return;

    // 设置标题（使用数据对象中的标题）
    if (titleElement && currentData.ticketModalTitle) {
        titleElement.textContent = currentData.ticketModalTitle;
    }

    // 清空容器
    container.innerHTML = '';

    // 渲染票根
    const sortedConcerts = [...currentData.concerts].sort((a, b) => b.id - a.id);
    totalTickets = sortedConcerts.length;
    currentTicketIndex = 0;
    const fragment = document.createDocumentFragment();

    sortedConcerts.forEach((concert, index) => {
        const ticketCard = createTicketCard(concert, index + 1);
        fragment.appendChild(ticketCard);
    });

    container.appendChild(fragment);

    // 显示模态框
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 渐入动画
    setTimeout(() => {
        const tickets = container.querySelectorAll('.ticket-card');
        tickets.forEach((ticket, i) => {
            setTimeout(() => {
                ticket.style.opacity = '1';
                ticket.style.transform = 'translateY(0)';
            }, i * 50);
        });
    }, 100);
}

/**
 * 关闭票根模态框
 */
function closeTicketModal() {
    const modal = document.getElementById('ticketModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * 处理票根模态框键盘事件
 * @param {KeyboardEvent} e - 键盘事件对象
 * @returns {boolean} 是否停止事件传播
 */
function handleTicketKeydown(e) {
    const modal = document.getElementById('ticketModal');
    if (!modal || !modal.classList.contains('active')) return false;

    switch (e.key) {
        case 'ArrowLeft':
            navigateTicket(-1);
            return true;
        case 'ArrowRight':
            navigateTicket(1);
            return true;
        case 'Home':
            scrollToTicket(0);
            return true;
        case 'End':
            scrollToTicket(totalTickets - 1);
            return true;
    }
    return false;
}

/**
 * 导航到上一张或下一张票根
 * @param {number} direction - 导航方向（-1: 上一张, 1: 下一张）
 */
function navigateTicket(direction) {
    const newIndex = currentTicketIndex + direction;
    if (newIndex >= 0 && newIndex < totalTickets) {
        scrollToTicket(newIndex);
    }
}

/**
 * 滚动到指定票根
 * @param {number} index - 票根索引
 */
function scrollToTicket(index) {
    const container = document.getElementById('ticketContainer');
    if (!container) return;

    const tickets = container.querySelectorAll('.ticket-card');
    if (index < 0 || index >= tickets.length) return;

    currentTicketIndex = index;
    const targetTicket = tickets[index];

    // 平滑滚动到目标票根
    targetTicket.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
    });

    // 添加高亮效果
    tickets.forEach(ticket => ticket.classList.remove('highlight'));
    targetTicket.classList.add('highlight');
    setTimeout(() => targetTicket.classList.remove('highlight'), 1000);
}

/**
 * 创建单张票根卡片
 * @param {Object} concert - 演唱会数据对象
 * @param {number} number - 票根序号
 * @returns {HTMLElement} 票根卡片DOM元素
 */
function createTicketCard(concert, number) {
    const ticketCard = document.createElement('div');
    ticketCard.className = 'ticket-card';
    ticketCard.style.opacity = '0';
    ticketCard.style.transform = 'translateY(20px)';
    ticketCard.style.transition = 'all 0.4s ease';

    const posterUrl = escapeHtml(concert.poster || 'img/logo.jpg');

    ticketCard.innerHTML = `
        <div class="ticket-poster" style="background-image: url('${posterUrl}')"></div>
        <div class="ticket-content">
            <div class="ticket-artist">${escapeHtml(concert.artist || '')}</div>
            <div class="ticket-concert">${escapeHtml(concert.concertName || '')}</div>
            <div class="ticket-divider"></div>
            <div class="ticket-info">
                <div class="ticket-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>${escapeHtml(concert.date || '')}${concert.time ? ' ' + escapeHtml(concert.time) : ''}</span>
                </div>
                <div class="ticket-info-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(concert.location || '')}</span>
                </div>
                ${concert.seat || concert.price ? `
                <div class="ticket-info-item ticket-seat-price">
                    ${concert.seat ? `
                    <span class="ticket-seat">
                        <i class="fas fa-chair"></i>
                        ${escapeHtml(concert.seat)}
                    </span>
                    ` : ''}
                    ${concert.seat && concert.price ? '<span class="ticket-separator">|</span>' : ''}
                    ${concert.price ? `
                    <span class="ticket-price">
                        <i class="fas fa-ticket-alt"></i>
                        ${escapeHtml(concert.price)}
                    </span>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </div>
    `;

    return ticketCard;
}

// ==================== 性能监控 ====================
if ('performance' in window) {
    performance.mark('app-init-start');
}

document.addEventListener('DOMContentLoaded', () => {
    performance.mark('dom-ready');
    initPage();
    performance.mark('app-init-end');
    performance.measure('app-initialization', 'app-init-start', 'app-init-end');
});