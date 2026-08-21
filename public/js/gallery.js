/**
 * 图片画廊功能模块
 *
 * @module gallery
 * @description 处理图片模态框、图片导航和触摸手势，提供图片浏览体验
 * @requires config.js（CONFIG配置：手势参数、图片重试参数）
 * @requires utils.js（safeHtml函数）
 *
 * 主要功能：
 * - openImageModal：打开图片模态框
 * - closeImageModalFunc：关闭图片模态框
 * - navigateImage：图片导航（上一张/下一张）
 * - handleTouchStart/Move/End：触摸手势处理（滑动切换图片）
 * - createResponsiveImage：创建响应式图片元素（支持缩略图、重试机制）
 * - initGallery：初始化图片画廊（为图片绑定点击事件）
 *
 * 状态变量：
 * - currentImageList：当前图片列表
 * - currentImageIndex：当前图片索引
 * - touchStartX/Y：触摸起始位置
 * - touchStartTime：触摸起始时间
 * - isTouching：是否正在触摸
 */

// ==================== 状态变量 ====================
let currentImageList = [];
let currentImageIndex = 0;

// 触摸手势状态
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isTouching = false;

// DOM 元素引用
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeModal = document.getElementById('closeModal');
const prevImageBtn = document.getElementById('prevImage');
const nextImageBtn = document.getElementById('nextImage');

// 打开图片模态框
function openImageModal(src, alt, imageList = null, startIndex = 0) {
    const originalSrc = src.replace('_medium.jpg', '.jpg');
    modalImage.src = src;
    modalImage.srcset = `${src} 800w, ${originalSrc} 1200w`;
    modalImage.sizes = "(max-width: 768px) 90vw, 800px";
    modalImage.alt = alt;
    modalCaption.textContent = alt;

    if (imageList && imageList.length > 0) {
        currentImageList = imageList;
        currentImageIndex = startIndex;
        preloadAdjacentImages(startIndex);
    }

    updateModalNavButtons();
    modal.classList.add('show');

    initTouchGestures();
}

// 关闭图片模态框
function closeImageModal() {
    modal.classList.remove('show');
    currentImageList = [];
    currentImageIndex = 0;

    cleanupTouchGestures();
}

// 图片导航
function navigateImage(direction) {
    if (currentImageList.length === 0) return;

    currentImageIndex += direction;

    if (currentImageIndex < 0) {
        currentImageIndex = currentImageList.length - 1;
    } else if (currentImageIndex >= currentImageList.length) {
        currentImageIndex = 0;
    }

    const currentImage = currentImageList[currentImageIndex];

    modalImage.classList.add('switching');

    setTimeout(() => {
        const originalSrc = currentImage.medium.replace('_medium.jpg', '.jpg');
        modalImage.src = currentImage.medium;
        modalImage.srcset = `${currentImage.medium} 800w, ${originalSrc} 1200w`;
        modalImage.alt = currentImage.alt;
        modalCaption.textContent = currentImage.alt;

        setTimeout(() => {
            modalImage.classList.remove('switching');
        }, 30);
    }, 200);

    updateModalNavButtons();
    preloadAdjacentImages(currentImageIndex);
}

// 更新导航按钮状态
function updateModalNavButtons() {
    if (currentImageList.length <= 1) {
        prevImageBtn.classList.add('disabled');
        nextImageBtn.classList.add('disabled');
    } else {
        prevImageBtn.classList.remove('disabled');
        nextImageBtn.classList.remove('disabled');
    }
}

// 键盘快捷键处理（使用统一键盘管理器）
function handleModalKeydown(e) {
    if (!modal.classList.contains('show')) return false;

    switch (e.key) {
        case 'Escape':
            closeImageModal();
            return true; // 停止传播
        case 'ArrowLeft':
            navigateImage(-1);
            return true; // 停止传播
        case 'ArrowRight':
            navigateImage(1);
            return true; // 停止传播
    }
    return false;
}

// 初始化触摸手势
function initTouchGestures() {
    if (!('ontouchstart' in window)) return;

    modal.addEventListener('touchstart', handleTouchStart, { passive: true });
    modal.addEventListener('touchmove', handleTouchMove, { passive: true });
    modal.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// 清理触摸手势
function cleanupTouchGestures() {
    modal.removeEventListener('touchstart', handleTouchStart);
    modal.removeEventListener('touchmove', handleTouchMove);
    modal.removeEventListener('touchend', handleTouchEnd);
}

// 触摸开始处理
function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isTouching = true;
}

// 触摸移动处理
function handleTouchMove(e) {
    if (!isTouching || currentImageList.length <= 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        const opacity = Math.max(CONFIG.SWIPE_OPACITY_MIN, 1 - Math.abs(deltaX) / 200);
        modalImage.style.opacity = opacity;
    }
}

// 触摸结束处理
function handleTouchEnd(e) {
    if (!isTouching || currentImageList.length <= 1) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    isTouching = false;
    modalImage.style.opacity = 1;

    if (Math.abs(deltaX) > Math.abs(deltaY) &&
        Math.abs(deltaX) > CONFIG.SWIPE_MIN_DISTANCE &&
        deltaTime < CONFIG.SWIPE_MAX_TIME) {
        const direction = deltaX > 0 ? -1 : 1;
        navigateImage(direction);
    }
}

// 预加载相邻图片
function preloadAdjacentImages(currentIndex) {
    if (currentImageList.length <= 1) return;

    const prevIndex = (currentIndex - 1 + currentImageList.length) % currentImageList.length;
    const nextIndex = (currentIndex + 1) % currentImageList.length;

    const imagesToPreload = [
        currentImageList[prevIndex],
        currentImageList[nextIndex]
    ];

    imagesToPreload.forEach(image => {
        const mediumImg = new Image();
        mediumImg.src = image.medium;

        const originalImg = new Image();
        originalImg.src = image.medium.replace('_medium.jpg', '.jpg');
    });
}

// 创建画廊项（防止XSS）
function createGalleryItem(img, imgIndex, concertImages) {
    const div = document.createElement('div');
    div.className = 'gallery-item';

    const imagesWithVariants = concertImages.map(image => ({
        ...image,
        thumb: image.src.replace('.jpg', '_thumb.jpg'),
        medium: image.src.replace('.jpg', '_medium.jpg')
    }));

    div.dataset.images = JSON.stringify(imagesWithVariants);
    div.dataset.index = imgIndex;
    div.addEventListener('click', handleGalleryClick);

    const imgElement = document.createElement('img');

    const thumbSrc = img.src.replace('.jpg', '_thumb.jpg');
    const mediumSrc = img.src.replace('.jpg', '_medium.jpg');

    const isMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;

    imgElement.src = thumbSrc;
    // 移动端：只显示缩略图，点击后再加载原图；桌面端保留 srcset 自适应
    if (!isMobile) {
        imgElement.srcset = `${thumbSrc} 120w, ${mediumSrc} 300w`;
        imgElement.sizes = "120px";
    }

    imgElement.alt = img.alt;
    imgElement.loading = 'lazy';
    imgElement.decoding = 'async';

    // 使用统一的图片错误处理函数
    imgElement.onerror = function() {
        handleImageError(this, img.src);
    };

    div.appendChild(imgElement);
    return div;
}

// 画廊点击事件处理器
function handleGalleryClick(e) {
    const container = e.currentTarget;
    let images = JSON.parse(container.dataset.images);
    const startIndex = parseInt(container.dataset.index, 10);

    const isMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
    if (isMobile) {
        // 移动端：模态框直接显示原图，避免加载 medium
        images = images.map(image => ({ ...image, medium: image.src }));
    }

    const currentImg = images[startIndex];
    openImageModal(currentImg.medium, currentImg.alt, images, startIndex);
}

// 事件绑定
closeModal.addEventListener('click', closeImageModal);
modal.addEventListener('click', e => e.target === modal && closeImageModal());

prevImageBtn.addEventListener('click', () => navigateImage(-1));
nextImageBtn.addEventListener('click', () => navigateImage(1));

// 初始化时注册键盘事件（高优先级）
if (window.KeyboardManager) {
    window.KeyboardManager.register('Escape', handleModalKeydown, 10);
    window.KeyboardManager.register('ArrowLeft', handleModalKeydown, 10);
    window.KeyboardManager.register('ArrowRight', handleModalKeydown, 10);
}