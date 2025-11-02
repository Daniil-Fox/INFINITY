import { gsap } from "gsap";

(function initPreloader() {
  const preloader = document.querySelector(".preloader");
  if (!preloader) return;

  const logoVisual = preloader.querySelector(".preloader__logo-visual");
  if (!logoVisual) return;

  // Блокируем взаимодействие под прелоадером до завершения
  document.documentElement.style.overflow = "hidden";

  const MIN_DELAY_MS = 800; // искусственная минимальная задержка показа прелоадера

  const reveal = () => {
    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });

    // Находим целевой элемент логотипа в hero
    const targetLogo = document.querySelector(".logo_symbol");
    if (!targetLogo) {
      // Если логотип не найден, делаем простую анимацию
      tl.to(preloader, { duration: 0.5, "--pre-white-opacity": 0 }, 0);
      tl.to(logoVisual, { duration: 1, scale: 2 });
      tl.to(preloader, { duration: 0.3, opacity: 0 }, "-=0.2");
      tl.add(() => {
        preloader.remove();
        document.documentElement.style.overflow = "";
      });
      return;
    }

    // Получаем позиции и размеры обоих элементов (в viewport координатах)
    const targetRect = targetLogo.getBoundingClientRect();
    const logoVisualRect = logoVisual.getBoundingClientRect();

    // Центры элементов в viewport координатах
    const logoCenterX = logoVisualRect.left + logoVisualRect.width / 2;
    const logoCenterY = logoVisualRect.top + logoVisualRect.height / 2;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Вычисляем смещение в пикселях (относительно текущей позиции)
    const deltaX = targetCenterX - logoCenterX;
    const deltaY = targetCenterY - logoCenterY;

    // Вычисляем целевой масштаб
    // Базовая ширина логотипа (без scale) = 20rem
    const rem =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const baseWidth = 20 * rem; // ширина без учета scale
    const targetWidth = targetRect.width;

    // GSAP заменит текущий transform, поэтому используем абсолютное значение scale
    // Чтобы итоговый размер был targetWidth, нужен scale = targetWidth / baseWidth
    const targetScale = targetWidth / baseWidth;

    // Убираем белый фон
    tl.to(preloader, { duration: 0.5, "--pre-white-opacity": 0 }, 0);

    // Анимируем визуальный белый логотип к целевой позиции
    // Используем xPercent и yPercent для сохранения центрирования
    tl.to(
      logoVisual,
      {
        duration: 2,
        xPercent: -50,
        yPercent: -50,
        x: deltaX,
        y: deltaY,
        scale: targetScale,
        ease: "power2.inOut",
      },
      0.2
    );

    // Плавно скрываем прелоадер
    tl.to(
      preloader,
      { duration: 1.4, opacity: 0, pointerEvents: "none" },
      "-=0.2"
    );
    tl.add(() => {
      preloader.remove();
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
