import { gsap } from "gsap";

(function initPreloader() {
  const preloader = document.querySelector(".preloader");
  if (!preloader) return;

  const svg = preloader.querySelector(".preloader__svg");
  const logo = preloader.querySelector(".preloader__logo");
  if (!svg || !logo) return;

  // Блокируем взаимодействие под прелоадером до завершения
  document.documentElement.style.overflow = "hidden";

  const MIN_DELAY_MS = 800; // искусственная минимальная задержка показа прелоадера

  const reveal = () => {
    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });

    tl.to(preloader, { duration: 0.5, "--pre-white-opacity": 0 }, 0);

    tl.to(logo, { duration: 1, scale: 20 });
    tl.add(() => {
      // preloader.remove();
      document.documentElement.style.overflow = "";
    });
  };

  const onAllLoaded = () => {
    // Ждём искусственную задержку, затем запускаем анимацию
    setTimeout(reveal, MIN_DELAY_MS);
  };

  if (document.readyState === "complete") {
    onAllLoaded();
  } else {
    window.addEventListener("load", onAllLoaded, { once: true });
  }
})();
