/**
 * Kore — client-side behavior
 *
 * Lenis smooth scroll + ScrollTrigger, in-page anchors, sticky work cards,
 * GSAP parallax/reveals, team accordion, header logo, navigation drawer.
 * Requires: Lenis (head), GSAP + ScrollTrigger (before this file).
 */

gsap.registerPlugin(ScrollTrigger);

// --- SMOOTH SCROLL (LENIS) ---

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical",
  gestureOrientation: "vertical",
  smoothWheel: true,
  wheelMultiplier: 1,
  syncTouch: false,
  touchMultiplier: 2,
  infinite: false
});
window.lenis = lenis;

// Puente Lenis ↔ GSAP: ScrollTrigger usa el scroll de Lenis; el ticker de GSAP mueve lenis.raf
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

/** Offset applied when scrolling to hash targets (fixed header clearance). */
const ANCHOR_SCROLL_OFFSET_PX = -80;

/** Duration (seconds) for Lenis scrollTo on in-page links. */
const ANCHOR_SCROLL_DURATION_SEC = 1.5;

/** Delay before scrolling when the nav was open, so close animation can start. */
const ANCHOR_SCROLL_AFTER_MENU_MS = 60;

/** Scroll distance (px) below which the hero zone still shows the header logo. */
const HERO_SCROLL_THRESHOLD_PX = 500;

/**
 * Delegated handler: same-document hash links use Lenis instead of native jump.
 * @param {MouseEvent} event
 */
function handleInPageAnchorClick(event) {
  const link = event.target.closest && event.target.closest('a[href^="#"]');
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || href === "#") return;
  if (href.indexOf("#", 1) !== -1) return;

  const targetId = href.slice(1);
  if (!targetId) return;
  if (!document.getElementById(targetId)) return;

  event.preventDefault();
  if (typeof window.lenis.scrollTo !== "function") return;

  const isMobileMenuOpen =
    typeof window.__isMobileMenuOpen === "function" && window.__isMobileMenuOpen();
  if (isMobileMenuOpen && typeof window.__closeMobileMenuForScroll === "function") {
    window.__closeMobileMenuForScroll();
  }

  const scrollToTarget = () =>
    window.lenis.scrollTo(`#${targetId}`, {
      offset: ANCHOR_SCROLL_OFFSET_PX,
      duration: ANCHOR_SCROLL_DURATION_SEC
    });

  if (isMobileMenuOpen) {
    setTimeout(scrollToTarget, ANCHOR_SCROLL_AFTER_MENU_MS);
    return;
  }
  scrollToTarget();
}

document.addEventListener("click", handleInPageAnchorClick);

// --- STICKY CARDS EFFECT ---

let stickyCardsFrameRequestId = null;

/**
 * Updates each work card’s content opacity, brightness, and Y offset from overlap
 * with the next sticky article (driven by scroll position).
 */
function updateStickyWorkCards() {
  const stack = document.getElementById("trabajo-sticky-stack");
  if (!stack) return;

  const stickyArticles = stack.querySelectorAll("article.sticky");
  stickyArticles.forEach((article, index) => {
    const inner = article.querySelector(":scope > .sticky-card-inner");
    if (!inner) return;

    const cardContent = inner.querySelector(".work-card-content");
    if (!cardContent) return;

    const nextArticle = stickyArticles[index + 1];
    if (!nextArticle) {
      cardContent.style.opacity = "1";
      cardContent.style.filter = "brightness(1)";
      cardContent.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const currentRect = article.getBoundingClientRect();
    const nextRect = nextArticle.getBoundingClientRect();
    const overlap = Math.max(0, Math.min(currentRect.height, currentRect.bottom - nextRect.top));
    const progress =
      currentRect.height > 0 ? Math.min(1, Math.max(0, overlap / currentRect.height)) : 0;

    const opacity = 1 - progress * 0.8;
    const brightness = 1 - progress * 0.5;
    const translateY = -progress * 20;

    cardContent.style.opacity = String(Math.max(0, opacity));
    cardContent.style.filter = `brightness(${Math.max(0, brightness)})`;
    cardContent.style.transform = `translate3d(0, ${translateY}px, 0)`;
  });
}

/**
 * Coalesces sticky card updates to one rAF per frame.
 */
function scheduleStickyWorkCardsUpdate() {
  if (stickyCardsFrameRequestId !== null) return;
  stickyCardsFrameRequestId = requestAnimationFrame(() => {
    stickyCardsFrameRequestId = null;
    updateStickyWorkCards();
  });
}

lenis.on("scroll", scheduleStickyWorkCardsUpdate);
window.addEventListener("resize", scheduleStickyWorkCardsUpdate, { passive: true });
scheduleStickyWorkCardsUpdate();

// --- UI INITIALIZATION (DOM READY) — function definitions below, registration at file end ---

/**
 * Single-open accordion for team section (large screens).
 */
function initTeamAccordionDesktop() {
  const accordionRoot = document.getElementById("team-accordion-desktop");
  if (!accordionRoot) return;

  accordionRoot.querySelectorAll(".team-accordion-trigger").forEach((triggerButton) => {
    triggerButton.addEventListener("click", () => {
      const clickedItem = triggerButton.closest(".team-accordion-item");
      if (!clickedItem) return;

      const wasOpen = clickedItem.classList.contains("is-open");

      accordionRoot.querySelectorAll(".team-accordion-item").forEach((item) => {
        item.classList.remove("is-open");
        item.setAttribute("data-state", "closed");
        const itemTrigger = item.querySelector(".team-accordion-trigger");
        if (itemTrigger) itemTrigger.setAttribute("aria-expanded", "false");
      });

      if (!wasOpen) {
        clickedItem.classList.add("is-open");
        clickedItem.setAttribute("data-state", "open");
        triggerButton.setAttribute("aria-expanded", "true");
      }
    });
  });
}

/**
 * Shows header logo in the hero zone; hides when scrolling down past it, shows when scrolling up.
 */
function initHeaderLogoVisibility() {
  const headerLogoImage = document.querySelector("header img");
  const headerLogoLink = headerLogoImage ? headerLogoImage.closest("a") : null;

  if (!headerLogoImage || !headerLogoLink || !window.lenis || typeof window.lenis.on !== "function") {
    return;
  }

  /**
   * @param {boolean} visible
   */
  function setHeaderLogoVisible(visible) {
    headerLogoImage.style.opacity = visible ? "1" : "0";
    if (visible) {
      headerLogoLink.classList.remove("pointer-events-none");
    } else {
      headerLogoLink.classList.add("pointer-events-none");
    }
  }

  function getScrollY() {
    if (typeof window.lenis.scroll === "number" && !Number.isNaN(window.lenis.scroll)) {
      return window.lenis.scroll;
    }
    return window.scrollY;
  }

  function syncLogoWhenInHeroZone() {
    if (getScrollY() < HERO_SCROLL_THRESHOLD_PX) {
      setHeaderLogoVisible(true);
    }
  }

  window.lenis.on("scroll", (lenisInstance) => {
    if (!lenisInstance) return;

    const scrollY =
      typeof lenisInstance.scroll === "number" ? lenisInstance.scroll : getScrollY();

    if (scrollY < HERO_SCROLL_THRESHOLD_PX) {
      setHeaderLogoVisible(true);
      return;
    }

    const direction = lenisInstance.direction;
    if (direction === -1) {
      setHeaderLogoVisible(true);
    } else if (direction === 1) {
      setHeaderLogoVisible(false);
    }
  });

  syncLogoWhenInHeroZone();
  if (getScrollY() >= HERO_SCROLL_THRESHOLD_PX) {
    setHeaderLogoVisible(false);
  }

  window.addEventListener("resize", syncLogoWhenInHeroZone, { passive: true });
}

/**
 * Off-canvas / overlay navigation: open, close, Lenis stop/start, anchor links.
 */
function initMobileNavigationDrawer() {
  const navigationPanel = document.getElementById("mobile-menu");
  const mobileMenuOpenButton = document.getElementById("mobile-menu-open");
  const mobileMenuCloseButton = document.getElementById("mobile-menu-close");
  const menuContentWrapper = document.getElementById("menu-content-wrapper");
  const mobileMenuLinksContainer = document.getElementById("mobile-menu-links");

  if (!navigationPanel || !mobileMenuOpenButton || !mobileMenuCloseButton || !menuContentWrapper) {
    return;
  }

  let menuLinksFadeTimerId = null;
  let menuCloseAnimationTimerId = null;

  function openMobileMenu() {
    if (menuCloseAnimationTimerId !== null) {
      clearTimeout(menuCloseAnimationTimerId);
      menuCloseAnimationTimerId = null;
    }
    if (window.lenis && typeof window.lenis.stop === "function") {
      window.lenis.stop();
    }
    document.body.style.overflow = "hidden";
    navigationPanel.setAttribute("aria-hidden", "false");
    mobileMenuOpenButton.setAttribute("aria-expanded", "true");
    navigationPanel.classList.remove("translate-x-full");
    navigationPanel.classList.add("translate-x-0", "pointer-events-auto");
    navigationPanel.classList.remove("pointer-events-none");
    navigationPanel.classList.remove("md:opacity-0");
    navigationPanel.classList.add("md:opacity-100");
    navigationPanel.classList.remove("md:pointer-events-none");
    navigationPanel.classList.add("md:pointer-events-auto");
    menuContentWrapper.classList.remove("md:translate-x-[150%]");
    menuContentWrapper.classList.add("md:translate-x-0");
    menuContentWrapper.classList.remove("lg:translate-x-full");
    menuContentWrapper.classList.add("lg:translate-x-0");
    if (mobileMenuLinksContainer) {
      const navLinks = mobileMenuLinksContainer.querySelectorAll("a");
      navLinks.forEach((linkElement) => linkElement.classList.remove("opacity-100"));
      if (menuLinksFadeTimerId !== null) clearTimeout(menuLinksFadeTimerId);
      menuLinksFadeTimerId = setTimeout(() => {
        navLinks.forEach((linkElement) => linkElement.classList.add("opacity-100"));
      }, 150);
    } else if (menuLinksFadeTimerId !== null) {
      clearTimeout(menuLinksFadeTimerId);
    }
  }

  function closeMobileMenu() {
    if (menuLinksFadeTimerId !== null) clearTimeout(menuLinksFadeTimerId);
    if (menuCloseAnimationTimerId !== null) {
      clearTimeout(menuCloseAnimationTimerId);
    }
    if (mobileMenuLinksContainer) {
      mobileMenuLinksContainer.querySelectorAll("a").forEach((linkElement) => {
        linkElement.classList.remove("opacity-100");
      });
    }
    navigationPanel.classList.remove("md:opacity-100");
    navigationPanel.classList.add("md:opacity-0");
    navigationPanel.classList.remove("md:pointer-events-auto");
    navigationPanel.classList.add("md:pointer-events-none");
    menuContentWrapper.classList.remove("md:translate-x-0");
    menuContentWrapper.classList.add("md:translate-x-[150%]");
    menuContentWrapper.classList.remove("lg:translate-x-0");
    menuContentWrapper.classList.add("lg:translate-x-full");
    navigationPanel.classList.remove("translate-x-0", "pointer-events-auto");
    navigationPanel.classList.add("translate-x-full", "pointer-events-none");
    menuCloseAnimationTimerId = setTimeout(() => {
      menuCloseAnimationTimerId = null;
      navigationPanel.setAttribute("aria-hidden", "true");
      mobileMenuOpenButton.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (window.lenis && typeof window.lenis.start === "function") {
        window.lenis.start();
      }
    }, 500);
  }

  /** @returns {boolean} */
  window.__isMobileMenuOpen = function __isMobileMenuOpen() {
    return navigationPanel.getAttribute("aria-hidden") === "false";
  };

  /** Closes the menu and restarts Lenis; used before programmatic scroll from anchors. */
  window.__closeMobileMenuForScroll = function __closeMobileMenuForScroll() {
    document.body.style.overflow = "";
    if (window.lenis && typeof window.lenis.start === "function") {
      window.lenis.start();
    }
    closeMobileMenu();
  };

  mobileMenuOpenButton.addEventListener("click", openMobileMenu);
  mobileMenuCloseButton.addEventListener("click", closeMobileMenu);
  navigationPanel.querySelectorAll('a[href^="#"]').forEach((anchorLink) => {
    anchorLink.addEventListener("click", () => {
      const href = anchorLink.getAttribute("href");
      if (!href || href === "#") return;
      document.body.style.overflow = "";
      closeMobileMenu();
    });
  });
}

// --- GSAP / SCROLLTRIGGER (parallax y revelados) ---

/**
 * Parallax y revelados con GSAP + ScrollTrigger (hero, métricas, Quiénes somos,
 * tarjetas de métricas, cabecera Nuestro trabajo). Las sticky work cards usan solo el rAF (updateStickyWorkCards).
 * Depende del puente Lenis ya registrado arriba.
 */
function initAdvancedAnimations() {
  // ──────────────────────────────────────────────────────────────────────────
  // PARALLAX 1 — Hero: la imagen sube más lenta que el scroll
  // Efecto: mientras bajas, la imagen sube solo un porcentaje de lo que bajas
  // ──────────────────────────────────────────────────────────────────────────
  const heroImage = document.querySelector("#hero img");
  if (heroImage) {
    gsap.set(heroImage, { scale: 1.15 });

    gsap.to(heroImage, {
      yPercent: 15,
      ease: "none",
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARALLAX 2 — Company Details: misma técnica en la sección de métricas
  // ──────────────────────────────────────────────────────────────────────────
  const companyDetailsImage = document.querySelector("#company-details img");
  if (companyDetailsImage) {
    gsap.set(companyDetailsImage, { scale: 1.2 });

    gsap.to(companyDetailsImage, {
      yPercent: 20,
      ease: "none",
      scrollTrigger: {
        trigger: "#company-details",
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARALLAX 3 — Quiénes somos: título y párrafo con velocidades distintas
  // ──────────────────────────────────────────────────────────────────────────
  const quienesTitulo = document.querySelector("#quienes-somos h2");
  const quienesParrafo = document.querySelector("#quienes-somos p");

  if (quienesTitulo) {
    gsap.fromTo(
      quienesTitulo,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "#quienes-somos",
          start: "top 80%",
          toggleActions: "play none none none"
        }
      }
    );
  }

  if (quienesParrafo) {
    gsap.fromTo(
      quienesParrafo,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.15,
        scrollTrigger: {
          trigger: "#quienes-somos",
          start: "top 80%",
          toggleActions: "play none none none"
        }
      }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARALLAX 4 — Tarjetas de métricas: entrada escalonada desde abajo
  // ──────────────────────────────────────────────────────────────────────────
  const metricCards = document.querySelectorAll("#company-details .flex.flex-nowrap > div");
  if (metricCards.length) {
    gsap.fromTo(
      metricCards,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: "#company-details",
          start: "top 70%",
          toggleActions: "play none none none"
        }
      }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Nuestro trabajo — etiqueta + H2: revelado al entrar en sección
  // ──────────────────────────────────────────────────────────────────────────
  const nuestroTrabajoReveals = document.querySelectorAll("#nuestro-trabajo .reveal");
  if (nuestroTrabajoReveals.length) {
    gsap.fromTo(
      nuestroTrabajoReveals,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: "#nuestro-trabajo",
          start: "top 80%",
          toggleActions: "play none none none"
        }
      }
    );
  }

  ScrollTrigger.refresh();
}

/**
 * Arranca UI y animaciones avanzadas cuando el DOM está listo.
 */
function initPageUi() {
  initTeamAccordionDesktop();
  initHeaderLogoVisibility();
  initMobileNavigationDrawer();
  initAdvancedAnimations();
}

document.addEventListener("DOMContentLoaded", initPageUi);
