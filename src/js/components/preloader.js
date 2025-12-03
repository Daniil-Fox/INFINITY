import { gsap } from "gsap";

(function initPreloader() {
  const preloader = document.querySelector(".preloader");
  if (!preloader) return;

  const logoVisual = preloader.querySelector(".preloader__logo-visual");
  if (!logoVisual) return;

  const videoContainer = preloader.querySelector(".preloader__video");
  if (!videoContainer) return;
  const videoEl = videoContainer.querySelector("video");

  // Блокируем взаимодействие под прелоадером до завершения
  document.documentElement.style.overflow = "hidden";

  const MIN_DELAY_MS = 800; // искусственная минимальная задержка показа прелоадера
  const REQUIRED_VIDEO_LOOPS = 2; // минимум два полных проигрывания видео

  // Функция перехода от видео к визуалу
  const transitionFromVideo = () => {
    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });

    // Одновременно скрываем видео и проявляем визуал
    tl.to(videoContainer, { duration: 0.8, scale: 0.45 });
    tl.to(videoContainer, { duration: 0.8, opacity: 0 });
    tl.to(
      logoVisual,
      {
        duration: 0.8,
        opacity: 1,
        scale: 0.3, // Устанавливаем начальный scale из CSS
      },
      0.5
    );

    // После завершения перехода запускаем основную анимацию
    tl.add(() => {
      reveal();
    });
  };

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
    tl.add(() => {
      // Убеждаемся, что страница наверху после завершения прелоадера
      window.scrollTo(0, 0);
    });
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

  const siteReadyPromise = waitForSiteReady(MIN_DELAY_MS);
  const videoReadyPromise = waitForVideoLoops(videoEl, REQUIRED_VIDEO_LOOPS);

  Promise.all([siteReadyPromise, videoReadyPromise]).then(() => {
    transitionFromVideo();
  });

  function waitForSiteReady(minDelay) {
    return new Promise((resolve) => {
      const finish = () => {
        setTimeout(resolve, minDelay);
      };
      if (document.readyState === "complete") {
        finish();
      } else {
        window.addEventListener("load", finish, { once: true });
      }
    });
  }

  function waitForVideoLoops(video, loopsRequired) {
    return new Promise((resolve) => {
      if (!video || loopsRequired <= 0) {
        resolve();
        return;
      }

      // Управляем воспроизведением вручную, чтобы соблюсти нужное количество циклов
      video.loop = false;
      video.removeAttribute("loop");
      // Ускоряем проигрывание видео в два раза
      video.playbackRate = 2.0;
      try {
        video.currentTime = 0;
      } catch (_e) {
        // Игнорируем невозможность сменить currentTime (например, до загрузки метаданных)
      }

      let completedLoops = 0;
      let resolved = false;

      const finalize = () => {
        if (resolved) return;
        resolved = true;
        video.pause();
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", finalize);
        resolve();
      };

      const handleEnded = () => {
        completedLoops += 1;
        if (completedLoops >= loopsRequired) {
          finalize();
          return;
        }
        try {
          video.currentTime = 0;
        } catch (_e) {
          finalize();
          return;
        }
        const replayPromise = video.play();
        if (replayPromise?.catch) {
          replayPromise.catch(() => finalize());
        }
      };

      video.addEventListener("ended", handleEnded);
      video.addEventListener("error", finalize);

      const startPlayback = () => {
        if (!video.paused) {
          return;
        }
        const playPromise = video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => finalize());
        }
      };

      if (video.readyState >= 2) {
        startPlayback();
      } else {
        video.addEventListener("loadeddata", startPlayback, { once: true });
      }
    });
  }
})();
