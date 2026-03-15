(() => {
  const root = document.documentElement;
  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const themeToggle = document.querySelector(".theme-toggle");
  const topbar = document.querySelector(".topbar");
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelectorAll(".nav a");
  const revealItems = document.querySelectorAll(".reveal");
  const aliveItems = document.querySelectorAll(".card, .hero-band article, .panel, .section-head, .alive-item");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const themeStorageKey = "nh-theme-override";

  const updateToggleLabel = (theme) => {
    if (!themeToggle) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    themeToggle.setAttribute("title", `Switch to ${nextTheme} theme`);
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    updateToggleLabel(theme);
  };

  // Default theme follows browser unless user toggles manually.
  const savedTheme = (() => {
    try {
      const value = localStorage.getItem(themeStorageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  })();
  let hasManualOverride = Boolean(savedTheme);

  applyTheme(savedTheme || (schemeQuery.matches ? "dark" : "light"));
  schemeQuery.addEventListener("change", (e) => {
    if (hasManualOverride) return;
    applyTheme(e.matches ? "dark" : "light");
  });

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(themeStorageKey, next);
        hasManualOverride = true;
      } catch (error) {}
    });
  }

  // Sticky header polish without layout thrash.
  let ticking = false;
  const updateTopbar = () => {
    if (!topbar) return;
    topbar.classList.toggle("is-scrolled", window.scrollY > 16);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    root.style.setProperty("--scroll-progress", Math.max(0, Math.min(100, progress)).toFixed(2));
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateTopbar);
    },
    { passive: true }
  );
  updateTopbar();

  // Mobile menu.
  if (toggle && nav) {
    const closeMenu = () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  // Section reveals for a fluid first-load feel.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach((item) => io.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("in-view"));
  }

  // Staggered motion on content blocks for a livelier scroll feel.
  if (!reduceMotion && "IntersectionObserver" in window) {
    aliveItems.forEach((item, index) => {
      item.classList.add("alive-item");
      item.style.setProperty("--enter-delay", `${(index % 6) * 42}ms`);
    });

    const aliveObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );

    aliveItems.forEach((item) => aliveObserver.observe(item));
  } else {
    aliveItems.forEach((item) => {
      item.classList.add("alive-item", "is-visible");
    });
  }

  // Subtle background drift tied to pointer for premium depth.
  if (!reduceMotion) {
    // Lightweight pointer tilt for premium depth on interactive blocks.
    const tiltTargets = document.querySelectorAll(".card, .hero-band article");
    tiltTargets.forEach((el) => {
      let tiltRaf = null;
      let nextX = 0;
      let nextY = 0;

      el.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType && e.pointerType !== "mouse") return;
          const rect = el.getBoundingClientRect();
          nextX = (e.clientX - rect.left) / rect.width;
          nextY = (e.clientY - rect.top) / rect.height;
          if (tiltRaf) return;

          tiltRaf = requestAnimationFrame(() => {
            const rx = (0.5 - nextY) * 4.2;
            const ry = (nextX - 0.5) * 5.4;
            el.style.setProperty("--tilt-x", `${rx.toFixed(2)}deg`);
            el.style.setProperty("--tilt-y", `${ry.toFixed(2)}deg`);
            tiltRaf = null;
          });
        },
        { passive: true }
      );

      el.addEventListener("pointerleave", () => {
        if (tiltRaf) {
          cancelAnimationFrame(tiltRaf);
          tiltRaf = null;
        }
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
      });
    });

    let rafId = null;
    window.addEventListener(
      "pointermove",
      (e) => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth - 0.5) * 18;
          const y = (e.clientY / window.innerHeight - 0.5) * 16;
          root.style.setProperty("--mx", `${x}px`);
          root.style.setProperty("--my", `${y}px`);
          rafId = null;
        });
      },
      { passive: true }
    );
  }
})();
