/**
 * 音乐播放器模块
 *
 * @module music
 * @description 处理背景音乐播放控制，包括播放/暂停、音量调节、音乐源切换
 * @requires config.js（CONFIG配置：音量、自动播放、淡入淡出时长）
 * @requires error.js（ErrorHandler错误处理）
 * @requires language.js（currentData变量）
 *
 * 主要功能：
 * - updateMusicUI：更新音乐播放器UI状态
 * - switchMusicSrc：切换音乐源（中英文版本）
 * - tryAutoPlay：尝试自动播放（首次加载）
 * - initMusic：初始化音乐播放器
 *
 * 状态变量：
 * - isPlaying：是否正在播放
 * - musicInitialized：是否已初始化
 *
 * DOM元素：
 * - bgMusic：音频元素
 * - bgMusicSource：音频源元素
 * - musicToggle：播放按钮
 * - musicIcon：播放图标
 * - musicWave：音波动画元素
 */

// ==================== 状态变量 ====================
let isPlaying = false;
let musicInitialized = false;

// DOM 元素引用
const bgMusic = document.getElementById('bgMusic');
const bgMusicSource = document.getElementById('bgMusicSource');
const musicToggle = document.getElementById('musicToggle');
const musicIcon = document.getElementById('musicIcon');
const musicWave = document.getElementById('musicWave');

// 更新音乐播放器UI状态
function updateMusicUI(playing) {
    musicToggle.classList.toggle('playing', playing);
    musicWave.classList.toggle('active', playing);
    musicIcon.className = playing ? 'fas fa-pause' : 'fas fa-music';
}

// 切换音乐源
function switchMusicSrc(musicSrc) {
    const wasPlaying = isPlaying;
    bgMusicSource.src = musicSrc;
    bgMusic.load();

    if (wasPlaying) {
        bgMusic.play().then(() => {
            bgMusic.currentTime = 0;
        }).catch((error) => {
            ErrorHandler.handle(error, 'MusicSwitch', false);
            updateMusicUI(false);
        });
    }
}

// 尝试自动播放
function tryAutoPlay() {
    bgMusic.volume = CONFIG.MUSIC_VOLUME;
    const playPromise = bgMusic.play();

    if (playPromise !== undefined) {
        playPromise.then(() => updateMusicUI(true)).catch((error) => {
            ErrorHandler.handle(error, 'MusicAutoPlay', false);
            updateMusicUI(false);
        });
    }
}

// 初始化背景音乐
function initBgMusic() {
    if (musicInitialized) return;
    musicInitialized = true;

    bgMusicSource.src = currentData.bgMusic || 'music/bgm_cn.mp3';
    bgMusic.load();

    const onCanPlay = () => {
        bgMusic.removeEventListener('canplay', onCanPlay);
        tryAutoPlay();
    };
    bgMusic.addEventListener('canplay', onCanPlay);
}

// 播放按钮点击事件
musicToggle.addEventListener('click', function() {
    if (!bgMusicSource.src || bgMusicSource.src === '') {
        bgMusicSource.src = currentData.bgMusic || 'music/bgm_cn.mp3';
        bgMusic.load();

        const onCanPlay = () => {
            bgMusic.removeEventListener('canplay', onCanPlay);
            bgMusic.volume = CONFIG.MUSIC_VOLUME;
            bgMusic.play().then(() => {
                isPlaying = true;
                updateMusicUI(true);
            }).catch((error) => {
                ErrorHandler.handle(error, 'MusicInitPlay', false);
                isPlaying = false;
                updateMusicUI(false);
            });
        };
        bgMusic.addEventListener('canplay', onCanPlay);
        return;
    }

    if (isPlaying) {
        bgMusic.pause();
        isPlaying = false;
        updateMusicUI(false);
    } else {
        bgMusic.play().then(() => {
            isPlaying = true;
            updateMusicUI(true);
        }).catch((error) => {
            ErrorHandler.handle(error, 'MusicTogglePlay', false);
            isPlaying = false;
            updateMusicUI(false);
        });
    }
});