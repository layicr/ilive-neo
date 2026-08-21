/**
 * 歌单功能模块
 *
 * @module songlist
 * @description 处理歌单模态框显示，展示演唱会歌曲列表
 * @requires language.js（currentData变量）
 *
 * 主要功能：
 * - openSonglistModal：打开歌单模态框
 * - closeSonglistModalFunc：关闭歌单模态框
 *
 * DOM元素：
 * - songlistModal：歌单模态框容器
 * - songlistContainer：歌单列表容器
 * - songlistModalTitle：歌单标题（艺人 - 演唱会名称）
 * - songlistModalSubtitle：歌单副标题（歌曲总数）
 * - closeSonglistModal：关闭按钮
 */

// ==================== DOM 元素引用 ====================
const songlistModal = document.getElementById('songlistModal');
const songlistContainer = document.getElementById('songlistContainer');
const songlistModalTitle = document.getElementById('songlistModalTitle');
const songlistModalSubtitle = document.getElementById('songlistModalSubtitle');
const closeSonglistModal = document.getElementById('closeSonglistModal');
const songlistSearchInput = document.getElementById('songlistSearchInput');

// ==================== 原始数据存储 ====================
let originalSonglistData = null;

// ==================== 更新搜索框placeholder（语言切换时调用） ====================
function updateSearchPlaceholder() {
    if (songlistSearchInput && currentData && currentData.songlist) {
        songlistSearchInput.placeholder = currentData.songlist.searchPlaceholder;
        songlistSearchInput.setAttribute('aria-label', currentData.songlist.searchPlaceholder);
    }
}

// 打开歌单模态框
function openSonglistModal(songlist, artist, concertName) {
    if (!songlist || songlist.length === 0) return;

    // 保存原始数据（深拷贝）
    originalSonglistData = {
        songlist: JSON.parse(JSON.stringify(songlist)),
        artist: artist,
        concertName: concertName
    };

    songlistModalTitle.textContent = artist + ' - ' + concertName;
    songlistModalSubtitle.textContent = currentData.songlist.totalSongs.replace('{count}', songlist.length);

    // 更新搜索框placeholder
    updateSearchPlaceholder();

    // 清空搜索框
    if (songlistSearchInput) songlistSearchInput.value = '';

    renderSonglist(songlist);
    songlistModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// ==================== 渲染歌单列表 ====================
function renderSonglist(songlist) {
    songlistContainer.innerHTML = '';

    if (songlist[0] && typeof songlist[0] === 'object' && songlist[0].section) {
        // 分组歌单处理
        songlist.forEach(section => {
            if (section.songs.length > 0) { // 只渲染有歌曲的分组
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'songlist-section';

                const sectionTitle = document.createElement('h4');
                sectionTitle.className = 'songlist-section-title';
                sectionTitle.textContent = section.section;
                sectionDiv.appendChild(sectionTitle);

                const sectionList = document.createElement('ol');
                sectionList.className = 'songlist-list';
                section.songs.forEach(song => {
                    sectionList.appendChild(createSongItem(song));
                });
                sectionDiv.appendChild(sectionList);

                songlistContainer.appendChild(sectionDiv);
            }
        });
    } else {
        // 普通歌单处理
        const list = document.createElement('ol');
        list.className = 'songlist-list';
        songlist.forEach(song => {
            list.appendChild(createSongItem(song));
        });
        songlistContainer.appendChild(list);
    }
}

// ==================== 过滤歌单（搜索功能） ====================
function filterSonglist(keyword) {
    if (!originalSonglistData) return;

    // 输入验证：净化搜索关键词（防止XSS）
    const sanitizedKeyword = sanitizeInput(keyword, 100);

    const filteredData = JSON.parse(JSON.stringify(originalSonglistData.songlist));
    const lowerKeyword = sanitizedKeyword.toLowerCase().trim();

    if (!lowerKeyword) {
        // 空搜索恢复原始数据
        renderSonglist(filteredData);
        updateSubtitle(filteredData);
        return;
    }

    if (filteredData[0] && typeof filteredData[0] === 'object' && filteredData[0].section) {
        // 分组歌单过滤
        filteredData.forEach(section => {
            section.songs = section.songs.filter(song => {
                const name = typeof song === 'object' ? song.name : song;
                return name.toLowerCase().includes(lowerKeyword);
            });
        });
        // 移除空分组
        const nonEmptySections = filteredData.filter(section => section.songs.length > 0);
        renderSonglist(nonEmptySections);
        updateSubtitle(nonEmptySections);
    } else {
        // 普通歌单过滤
        const filteredSongs = filteredData.filter(song => {
            const name = typeof song === 'object' ? song.name : song;
            return name.toLowerCase().includes(lowerKeyword);
        });
        renderSonglist(filteredSongs);
        updateSubtitle(filteredSongs);
    }
}

// ==================== 更新副标题（显示过滤后的歌曲数） ====================
function updateSubtitle(filteredData) {
    let count = 0;
    if (filteredData[0] && typeof filteredData[0] === 'object' && filteredData[0].section) {
        filteredData.forEach(section => count += section.songs.length);
    } else {
        count = filteredData.length;
    }
    songlistModalSubtitle.textContent = currentData.songlist.totalSongs.replace('{count}', count);
}

// 创建单个歌曲项 li
// song 可为字符串（无链接）或 { name, link } 对象（有链接，显示播放按钮）
function createSongItem(song) {
    const li = document.createElement('li');
    li.className = 'songlist-item';

    const isObj = typeof song === 'object' && song !== null;
    const name = isObj ? song.name : song;
    const link = isObj ? song.link : null;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'songlist-item-name';
    nameSpan.textContent = name;
    li.appendChild(nameSpan);

    if (link) {
        const playBtn = document.createElement('a');
        playBtn.className = 'songlist-play-btn';
        playBtn.href = link;
        playBtn.target = '_blank';
        playBtn.rel = 'noopener noreferrer';
        playBtn.setAttribute('aria-label', '播放: ' + name);
        const icon = document.createElement('i');
        icon.className = 'fas fa-play';
        playBtn.appendChild(icon);
        li.appendChild(playBtn);
        li.classList.add('has-link');
    }

    return li;
}

// 关闭歌单模态框
function closeSonglistModalFunc() {
    songlistModal.classList.remove('show');
    songlistContainer.innerHTML = '';
    document.body.style.overflow = '';
}

// 事件绑定
closeSonglistModal.addEventListener('click', closeSonglistModalFunc);
songlistModal.addEventListener('click', e => {
    if (e.target === songlistModal || e.target.classList.contains('songlist-modal-content')) {
        closeSonglistModalFunc();
    }
});

// ==================== 搜索事件监听 ====================
if (songlistSearchInput) {
    // 使用防抖函数避免频繁触发（300ms延迟）
    songlistSearchInput.addEventListener('input', debounce(function(e) {
        filterSonglist(e.target.value);
    }, 300));
}