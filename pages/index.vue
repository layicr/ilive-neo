<script setup lang="ts">
/**
 * 首页 · Home page
 * @description 迁移自原 index.html <body> 的完整 DOM 骨架，视觉 100% 保持一致。
 *              交互逻辑由客户端插件 plugins/legacy.client.ts 加载复用原有全局脚本，
 *              数据自 Turso/LibSQL 经 Nitro /api 拉取后重建全局数据对象。
 *              保持原有"Loading..."占位结构，客户端加载后由脚本填充。
 *
 *              Mirrored from the original index.html <body> to keep visuals identical.
 */
</script>

<template>
  <div>
    <!-- 骨架屏 · Skeleton loader -->
    <div id="skeleton-loader" class="skeleton-container">
      <div class="skeleton-content">
        <img src="/img/logo.jpg" alt="logo" class="skeleton-avatar">
        <div class="skeleton-card">
          <div class="scramble-line" data-text="自由摄影 / 纯粹为镜"></div>
          <div class="scramble-line" data-text="Liberated Photography / Purity as the Lens"></div>
          <div class="scramble-line" data-text="行者旅人 / 探索为途"></div>
          <div class="scramble-line" data-text="Nomad on a Journey / Exploration as the Path"></div>
        </div>
      </div>
    </div>

    <div class="language-switcher" role="group" aria-label="语言选择">
      <button class="lang-btn active" data-lang="zh" aria-label="切换到中文">中文</button>
      <button class="lang-btn" data-lang="en" aria-label="切换到英文">EN</button>
    </div>
    <div class="music-player">
      <button class="music-btn" id="musicToggle" aria-label="播放/暂停背景音乐">
        <i class="fas fa-music" id="musicIcon" aria-hidden="true"></i>
      </button>
      <span class="music-wave" id="musicWave" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
    </div>
    <audio id="bgMusic" loop>
      <source id="bgMusicSource" src="/music/bgm_cn.mp3" type="audio/mpeg">
    </audio>

    <div class="background-circles">
      <div class="logo-letter">L</div>
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <section class="hero-section">
      <div class="profile-wrapper">
        <div class="orbit-container">
          <div class="avatar-section">
            <div class="avatar-container">
              <img src="/img/logo.jpg" alt="layicr" class="avatar-image" onerror="this.src='/img/logo.jpg'">
              <div class="status-dot"></div>
            </div>
            <div class="avatar-border"></div>
          </div>
        </div>

        <div class="profile-card">
          <div class="profile-label" id="profile-label">My name is:</div>
          <h1 class="profile-name">layicr</h1>

          <div class="profile-subtitle" id="profile-subtitle">Loading...</div>
          <ul class="roles-list" id="roles-list">
            <li class="role-item">Loading...</li>
            <li class="role-item">Loading...</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Stories · 文字介绍区域 -->
    <section class="section-spacing">
      <div class="max-w-4xl mx-auto px-6 mb-16">
        <p class="text-2xl md:text-3xl text-gray-400 leading-relaxed max-w-3xl">
          <span id="dynamic-text-1"></span><br />
          <span id="dynamic-text-2"></span><br />
          <span id="dynamic-text" class="highlight-fill"></span>
        </p>
      </div>
    </section>

    <!-- Social Media Stats · 统计卡片 -->
    <section class="social-stats" id="influencer">
      <div class="stats-grid">
        <div class="stat-card cities" id="city-card">
          <div class="stat-number" id="total-cities">Loading...</div>
          <div class="stat-label" id="cities-label">城市</div>
        </div>
        <div class="stat-card artists">
          <div class="stat-number" id="total-artists">Loading...</div>
          <div class="stat-label" id="artists-label">艺人</div>
        </div>
        <div class="stat-card total">
          <div class="stat-number" id="total-concerts">Loading...</div>
          <div class="stat-label" id="total-label">场次</div>
        </div>
      </div>
    </section>

    <!-- 3D 专辑展示 · 3D Album showcase -->
    <div class="album-showcase-container">
      <div class="album-stack-container">
        <div class="album-stack" id="albumStack"></div>
      </div>
      <div class="detail-panel">
        <button class="detail-nav detail-prev" id="prevConcert" aria-label="上一场演唱会">
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <button class="detail-nav detail-next" id="nextConcert" aria-label="下一场演唱会">
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
        <div class="detail-header">
          <h2 class="detail-title" id="detailTitle">Loading...</h2>
          <p class="detail-subtitle" id="detailSubtitle">-</p>
          <p class="detail-date" id="detailDate">-</p>
        </div>
        <div class="detail-content">
          <div class="album-intro" id="albumIntro">Loading...</div>
        </div>
      </div>
    </div>

    <!-- 时间轴 · Timeline -->
    <div class="timeline" id="timeline"></div>

    <!-- 加载动画 · Loader -->
    <div class="loader" id="loader">
      <div class="spinner"></div>
      <p id="loading-text">Loading...</p>
    </div>

    <!-- 城市列表模态框 · City modal -->
    <div class="city-modal" id="cityModal">
      <div class="city-modal-content">
        <div class="city-modal-header">
          <button class="city-modal-close" id="closeCityModal">&times;</button>
          <h2 class="city-modal-title" id="city-modal-title">巡演城市</h2>
        </div>
        <div class="city-list" id="cityList"></div>
      </div>
    </div>

    <!-- 图片查看器模态框 · Image viewer modal -->
    <div class="modal" id="imageModal" role="dialog" aria-modal="true" aria-labelledby="modalCaption" aria-label="演唱会图片查看器">
      <button class="close" id="closeModal" aria-label="关闭图片查看器">&times;</button>
      <button class="modal-nav modal-prev" id="prevImage" aria-label="上一张图片">
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button class="modal-nav modal-next" id="nextImage" aria-label="下一张图片">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
      <img class="modal-content" id="modalImage" alt="演唱会图片">
      <div class="modal-caption" id="modalCaption" role="status" aria-live="polite"></div>
    </div>

    <!-- 视频查看器模态框 · Video modal -->
    <div class="video-modal" id="videoModal" role="dialog" aria-modal="true" aria-labelledby="videoModalTitle" aria-label="演唱会视频查看器">
      <div class="video-modal-content">
        <button class="video-close" id="closeVideoModal" aria-label="关闭视频查看器">&times;</button>
        <div class="video-modal-header">
          <h3 id="videoModalTitle">Loading...</h3>
        </div>
        <div class="video-container">
          <iframe id="videoPlayer" src="" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" title="演唱会视频"></iframe>
        </div>
      </div>
    </div>

    <!-- 歌单查看器模态框 · Songlist modal -->
    <div class="songlist-modal" id="songlistModal" role="dialog" aria-modal="true" aria-labelledby="songlistModalTitle" aria-label="演唱会歌单查看器">
      <div class="songlist-modal-content">
        <button class="songlist-close" id="closeSonglistModal" aria-label="关闭歌单查看器">&times;</button>
        <div class="songlist-modal-header">
          <h3 id="songlistModalTitle">Loading...</h3>
          <p class="songlist-modal-subtitle" id="songlistModalSubtitle">-</p>
          <div class="songlist-search-container">
            <input type="text" id="songlistSearchInput" class="songlist-search-input" placeholder="" aria-label="">
            <i class="fas fa-search songlist-search-icon"></i>
          </div>
        </div>
        <div class="songlist-container" id="songlistContainer"></div>
      </div>
    </div>

    <!-- 票根模态框 · Ticket modal -->
    <div class="ticket-modal" id="ticketModal" role="dialog" aria-modal="true" aria-label="演唱会票根展示">
      <div class="ticket-modal-overlay" id="ticketModalOverlay"></div>
      <div class="ticket-modal-content">
        <div class="ticket-modal-header">
          <h2 class="ticket-modal-title" id="ticketModalTitle">演唱会场足迹</h2>
          <button class="ticket-close" id="closeTicketModal" aria-label="关闭票根展示">&times;</button>
        </div>
        <div class="ticket-container" id="ticketContainer"></div>
      </div>
    </div>

    <!-- Wish Wall · 许愿墙 -->
    <section class="wish-section" id="wishSection">
      <div class="wish-header">
        <h2 class="wish-title" id="wishTitle">许愿墙</h2>
        <div class="wish-count" id="wishCount">已有 <span>0</span> 个心愿</div>
      </div>
      <div class="wish-grid" id="wishGrid"></div>
    </section>

    <!-- 页脚 · Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <span class="footer-logo"></span>
          <span class="footer-divider"></span>
          <span class="footer-tagline" id="footer-text"></span>
        </div>
        <div class="footer-social"></div>
        <div class="footer-bottom">
          <span> ©<span id="site-name"></span></span>
          <span class="footer-separator"></span>
          <span></span>
        </div>
      </div>
    </footer>

    <!-- 反馈问题按钮 · Feedback button -->
    <button class="feedback-btn" id="feedbackBtn" aria-label="反馈问题到GitHub">
      <i class="fas fa-lightbulb" aria-hidden="true"></i>
    </button>

    <!-- 返回顶部按钮 · Back to top button -->
    <button class="back-to-top" id="backToTop" aria-label="返回页面顶部">
      <i class="fas fa-arrow-up" aria-hidden="true"></i>
    </button>
  </div>
</template>