/* NoviceHall - tiny JS helpers
   - Injects a dark-mode toggle button
   - Injects a mobile nav toggle (works without editing HTML)
   - Exposes helpers on window.NoviceHall
*/
(function () {
  'use strict';

  const NH = {
    toggleClass(el, cls) { if (!el) return; el.classList.toggle(cls); },
    setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('nh-theme', theme); } catch (e) {}
    },
    prefersDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; },
    initTheme() {
      try {
        const saved = localStorage.getItem('nh-theme');
        const theme = saved || (NH.prefersDark() ? 'dark' : 'light');
        NH.setTheme(theme);
      } catch (e) { NH.setTheme(NH.prefersDark() ? 'dark' : 'light'); }
    }
  };

  // expose lightweight API
  window.NoviceHall = Object.assign(window.NoviceHall || {}, NH);

  document.addEventListener('DOMContentLoaded', () => {
    NH.initTheme();

    // Dark-mode toggle (injected into header when present)
    const darkBtn = document.createElement('button');
    darkBtn.type = 'button';
    darkBtn.className = 'nh-toggle transition';
    darkBtn.setAttribute('aria-label', 'Toggle dark mode');
    darkBtn.title = 'Toggle dark mode';
    darkBtn.innerHTML = '🌓';
    darkBtn.addEventListener('click', () => {
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      NH.setTheme(next);
    });
    const headerEl = document.querySelector('header');
    if (headerEl) headerEl.appendChild(darkBtn); else document.body.appendChild(darkBtn);

    // Mobile nav toggle
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    if (nav) {
      // ensure id exists so aria-controls points somewhere
      if (!nav.id) nav.id = 'primary-navigation';
      nav.setAttribute('data-open', 'false');
      nav.setAttribute('aria-expanded', 'false');

      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = 'nh-nav-toggle transition';
      navBtn.setAttribute('aria-controls', nav.id);
      navBtn.setAttribute('aria-label', 'Toggle navigation');
      navBtn.title = 'Toggle navigation';
      navBtn.innerHTML = '☰';

      navBtn.addEventListener('click', () => {
        const open = nav.getAttribute('data-open') === 'true';
        const next = !open;
        nav.setAttribute('data-open', String(next));
        nav.setAttribute('aria-expanded', String(next));
        // lock body scroll when overlay is open
        document.body.style.overflow = next ? 'hidden' : '';
      });

      if (headerEl) headerEl.appendChild(navBtn); else document.body.appendChild(navBtn);

      // close nav when clicking outside
      document.addEventListener('click', (e) => {
        if (nav.getAttribute('data-open') !== 'true') return;
        if (nav.contains(e.target) || e.target === navBtn) return;
        nav.setAttribute('data-open', 'false');
        nav.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });

      // keyboard: ESC closes nav
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
          nav.setAttribute('data-open', 'false');
          nav.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      });

      // expose toggle function
      NH.toggleNav = (on) => {
        const next = (typeof on === 'boolean') ? on : nav.getAttribute('data-open') !== 'true';
        nav.setAttribute('data-open', String(next));
        nav.setAttribute('aria-expanded', String(next));
      };

      // small UX: nav floats to top-right when cursor is near top or when hovered
      (function setupNavFloating(){
        let pinned = false;
        let raf = null;
        const setPinned = (v) => {
          if (pinned === v) return;
          pinned = v;
          nav.classList.toggle('nav-floating', !!v);
        };

        document.addEventListener('mousemove', (e) => {
          if (window.innerWidth < 640) return; // skip on small screens
          const should = (e.clientY <= 64) || nav.matches(':hover');
          if (should !== pinned) {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setPinned(should));
          }
        });

        nav.addEventListener('mouseenter', () => setPinned(true));
        nav.addEventListener('mouseleave', () => { if (nav.getAttribute('data-open') !== 'true') setPinned(false); });

        // reflect toggle calls
        const originalToggle = NH.toggleNav;
        NH.toggleNav = (on) => {
          originalToggle(on);
          if (typeof on === 'boolean') nav.classList.toggle('nav-floating', !!on);
          // lock body scroll when nav is opened programmatically
          const open = nav.getAttribute('data-open') === 'true';
          document.body.style.overflow = open ? 'hidden' : '';
        };
      })();
    }

    // collapse header on scroll down, expand on scroll up
    (function setupScrollCollapse(){
      let last = window.scrollY || 0;
      let ticking = false;
      let collapsed = false;
      const headerEl = document.querySelector('header');
      if (!headerEl) return;

      // debounce/lock to prevent rapid toggles
      let lastToggle = 0;
      const TOGGLE_LOCK = 260; // ms
      const MIN_DELTA = 24; // px - ignore tiny scrolls

      function update(){
        const current = window.scrollY || 0;
        const delta = current - last;

        // ignore very small scrolls
        if (Math.abs(delta) < MIN_DELTA) { last = current; ticking = false; return; }

        const now = Date.now();

        // collapse when scrolling down sufficiently past threshold and not already collapsed
        if (current > 120 && delta > 0 && !collapsed && (now - lastToggle) > TOGGLE_LOCK) {
          headerEl.classList.add('header-collapsed');
          collapsed = true;
          lastToggle = now;
        }
        // expand when scrolling up sufficiently or near top, respecting lock
        else if (((current < 80 && delta < 0 && collapsed) || current <= 40) && (now - lastToggle) > TOGGLE_LOCK) {
          headerEl.classList.remove('header-collapsed');
          collapsed = false;
          lastToggle = now;
        }

        last = current;
        ticking = false;
      }

      window.addEventListener('scroll', () => {
        if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
      }, { passive: true });
    })();

    // convenience: reflect theme changes on root as attribute change event
    const obs = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme');
      document.documentElement.style.colorScheme = (t === 'dark') ? 'dark' : 'light';
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  });

})();