'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ASCII-only strings to avoid encoding issues while keeping i18n logic simple.
  const i18n = { lang: 'es', translations: {} };

  async function loadTranslations(lang) {
    try {
      const res = await fetch(`i18n/${lang}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('i18n load failed');
      return await res.json();
    } catch (_) {
      return {};
    }
  }

  const t = (key) => {

    const table = i18n.translations[i18n.lang] || {};
    return table[key] || '';
  };

  const applyTranslations = () => {
    const elements = $$('[data-i18n], [data-i18n-attr]');
    elements.forEach((el) => {
      const key = el.dataset.i18n;
      if (key) {
        const value = t(key);
        if (value) {
          if (el.dataset.i18nHtml === 'true') {
            el.innerHTML = value;
          } else {
            el.textContent = value;
          }
        }
      }

      const attrSpec = el.dataset.i18nAttr;
      if (!attrSpec) return;

      attrSpec.split(',').forEach((pair) => {
        const [attr, attrKey] = pair.split(':').map((part) => part.trim());
        if (!attr) return;
        const keyToUse = attrKey || key;
        if (!keyToUse) return;
        const value = t(keyToUse);
        if (value) el.setAttribute(attr, value);
      });
    });
  };

  const getStoredLanguage = () => {
    try {
      return localStorage.getItem('lang');
    } catch (_) {
      return null;
    }
  };

  const storeLanguage = (lang) => {
    try {
      localStorage.setItem('lang', lang);
    } catch (_) {
      /* no-op */
    }
  };

  const setLanguage = (lang) => {
    const next = lang === 'en' ? 'en' : 'es';
    i18n.lang = next;
    document.documentElement.setAttribute('lang', next);
    applyTranslations();
  };

  /* =========================
     1) Mobile Menu
     ========================= */
  function initMobileMenu() {
    const btn = $('#menuToggle');
    const menu = $('#menu');

    if (!btn || !menu) return;

    const MOBILE_BREAKPOINT = 900;

    const isMobileViewport = () => window.innerWidth < MOBILE_BREAKPOINT;

    const setExpanded = (expanded) => {
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    const openMenu = () => {
      menu.classList.add('is-open');
      setExpanded(true);
    };

    const closeMenu = () => {
      menu.classList.remove('is-open');
      setExpanded(false);
    };

    const toggleMenu = () => {
      const isOpen = menu.classList.contains('is-open');
      if (isOpen) closeMenu();
      else openMenu();
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });

    // Close on click any link inside menu
    menu.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('a')) {
        closeMenu();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
        btn.focus();
      }
    });

    // Close on click outside (mobile only)
    document.addEventListener('click', (e) => {
      if (!isMobileViewport()) return;
      if (!menu.classList.contains('is-open')) return;

      const target = e.target;
      const clickedInsideMenu = target && menu.contains(target);
      const clickedToggle = target && btn.contains(target);

      if (!clickedInsideMenu && !clickedToggle) {
        closeMenu();
      }
    });

    // Avoid "stuck" menu on desktop resize
    window.addEventListener('resize', () => {
      if (!isMobileViewport()) {
        closeMenu();
      }
    });

    // Ensure initial aria state
    setExpanded(menu.classList.contains('is-open'));
  }

  /* =========================
     2) Theme (Light/Dark)
     ========================= */
  function initTheme() {
    const btn = $('#themeToggle');
    if (!btn) return;

    const body = document.body;

    const getSystemPref = () => {
      if (!window.matchMedia) return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const getStoredTheme = () => {
      try {
        return localStorage.getItem('theme');
      } catch (_) {
        return null;
      }
    };

    const storeTheme = (theme) => {
      try {
        localStorage.setItem('theme', theme);
      } catch (_) {
        /* no-op */
      }
    };

    const setButtonState = (isDark) => {
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');

      // Icon swap handled by CSS based on theme class.
    };

    const applyTheme = (theme) => {
      const isDark = theme === 'dark';
      body.classList.toggle('theme-dark', isDark);
      body.classList.toggle('theme-light', !isDark);
      setButtonState(isDark);
    };

    // Initial load
    const stored = getStoredTheme();
    const initialTheme = stored === 'dark' || stored === 'light' ? stored : getSystemPref();
    applyTheme(initialTheme);

    // Toggle
    btn.addEventListener('click', () => {
      const isDark = body.classList.contains('theme-dark');
      const nextTheme = isDark ? 'light' : 'dark';
      applyTheme(nextTheme);
      storeTheme(nextTheme);
    });
  }

  /* =========================
     3) Language (ES/EN)
     ========================= */
  async function initLanguage() {
    const btn = $('#langToggle');
    if (!btn) return;

    const setButtonState = () => {
      btn.setAttribute('aria-pressed', i18n.lang === 'en' ? 'true' : 'false');
      const iconSpan = btn.querySelector('span[aria-hidden="true"]');
      if (iconSpan) iconSpan.textContent = i18n.lang.toUpperCase();
    };

    const stored = getStoredLanguage();
    const initialLang = stored || 'es';
    i18n.translations[initialLang] = await loadTranslations(initialLang);
    setLanguage(initialLang);
    setButtonState();

    btn.addEventListener('click', async () => {
      const next = i18n.lang === 'es' ? 'en' : 'es';
      if (!i18n.translations[next]) {
        i18n.translations[next] = await loadTranslations(next);
      }
      setLanguage(next);
      setButtonState();
      storeLanguage(next);
    });
  }

  /* =========================
     4) Cursor Glow
     ========================= */
  function initCursorGlow() {
    const root = document.documentElement;
    let rafId = 0;
    let targetX = 0.5;
    let targetY = 0.5;
    let currentX = 0.5;
    let currentY = 0.5;

    const update = () => {
      const ease = 0.12;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      root.style.setProperty('--cursor-x', `${(currentX * 100).toFixed(2)}%`);
      root.style.setProperty('--cursor-y', `${(currentY * 100).toFixed(2)}%`);
      rafId = window.requestAnimationFrame(update);
    };

    const handleMove = (e) => {
      targetX = e.clientX / window.innerWidth;
      targetY = e.clientY / window.innerHeight;
      if (!rafId) rafId = window.requestAnimationFrame(update);
    };

    const handleLeave = () => {
      targetX = 0.5;
      targetY = 0.5;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
  }

  /* =========================
     5) Project Filters
     ========================= */
  /* =========================
     5) Project Hover Video
     ========================= */
  function initProjectVideos() {
    const mediaBlocks = $$('.project__media');
    if (!mediaBlocks.length) return;

    mediaBlocks.forEach((block) => {
      const video = block.querySelector('video');
      if (!video) return;
      video.muted = true;
      video.playsInline = true;

      const playVideo = () => {
        video.currentTime = 0;
        if (video.readyState < 2) {
          video.load();
        }
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      const stopVideo = () => {
        video.pause();
        video.currentTime = 0;
      };

      block.addEventListener('mouseenter', playVideo);
      block.addEventListener('mouseleave', stopVideo);
      block.addEventListener('focusin', playVideo);
      block.addEventListener('focusout', stopVideo);
      block.addEventListener('touchend', playVideo, { passive: true });
    });
  }

  /* =========================
     6) Footer Year
     ========================= */
  function initYear() {
    const yearEl = $('#year');
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* =========================
     Boot
     ========================= */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initTheme();
    initLanguage();
    initCursorGlow();
    initProjectVideos();
    initYear();
  });
})();
