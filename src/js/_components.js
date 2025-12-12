import "./components/preloader.js";
import "./components/different.js";
import "./components/inputs.js";
import "./components/why.js";
import "./components/header-scroll.js";
import "./components/dropdown.js";
import "./components/sliders.js";
import "./components/modal.js";
import "./functions/validate-forms.js";
import "./components/loan.js";
import "./components/tooltips.js";

const runWhenIdle = (cb) => {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout: 1200 });
    return;
  }
  setTimeout(cb, 150);
};

const loadWhenVisible = (selector, loader) => {
  const element = document.querySelector(selector);
  if (!element) return;

  const invoke = () => {
    runWhenIdle(() => {
      loader().catch((error) => {
        console.warn(`Не удалось подгрузить модуль для ${selector}`, error);
      });
    });
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!isVisible) return;
        observer.disconnect();
        invoke();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(element);
  } else {
    invoke();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadWhenVisible("#scene", () =>
    import(
      /* webpackChunkName: "src_js_components_coin_js" */ "./components/coin.js"
    )
  );
  loadWhenVisible("#master-card", () =>
    import(
      /* webpackChunkName: "src_js_components_master-card_js" */ "./components/master-card.js"
    )
  );
});
