(function initPreloader() {
  if (typeof window !== "undefined" && window.__infinityPreloaderInited) return;
  if (typeof window !== "undefined") window.__infinityPreloaderInited = true;

  const preloader = document.querySelector(".preloader");
  if (!preloader) return;

  const logoVisual = preloader.querySelector(".preloader__logo-visual");
  if (!logoVisual) return;

  const videoContainer = preloader.querySelector(".preloader__video");
  if (!videoContainer) return;
  const videoEl = videoContainer.querySelector("video");
  if (videoEl) {
    videoEl.preload = "auto";
    videoEl.playsInline = true;
  }
  preloader.style.opacity = "1";

  // Блокируем взаимодействие под прелоадером до завершения
  document.documentElement.style.overflow = "hidden";

  const MIN_DELAY_MS = 800; // искусственная минимальная задержка показа прелоадера
  const REQUIRED_VIDEO_LOOPS = 2; // минимум два полных проигрывания видео

  const animateEl = (element, keyframes, options) => {
    if (!element?.animate) return Promise.resolve();
    const animation = element.animate(keyframes, options);
    return animation.finished.catch(() => {});
  };

  // Функция перехода от видео к визуалу
  const transitionFromVideo = async () => {
    const baseTransform = "translate(-50%, -50%)";
    const baseScale = 0.3;

    const hideVideo = animateEl(
      videoContainer,
      [
        { transform: `${baseTransform} scale(2)`, opacity: 1, offset: 0 },
        { transform: `${baseTransform} scale(0.45)`, opacity: 1, offset: 0.8 },
        { transform: `${baseTransform} scale(0.45)`, opacity: 0, offset: 1 },
      ],
      {
        duration: 800,
        easing: "linear",
        fill: "forwards",
      }
    );
    const showLogo = animateEl(
      logoVisual,
      [
        {
          opacity: 0,
          transform: `${baseTransform} scale(${baseScale})`,
          offset: 0,
        },
        {
          opacity: 0,
          transform: `${baseTransform} scale(${baseScale})`,
          offset: 0,
        },
        {
          opacity: 1,
          transform: `${baseTransform} scale(${baseScale})`,
          offset: 1,
        },
      ],
      {
        duration: 800,
        delay: 500,
        easing: "linear",
        fill: "forwards",
      }
    );

    await Promise.all([hideVideo, showLogo]);
    // Зафиксируем конечные стили, чтобы не мелькало
    videoContainer.style.opacity = "0";
    videoContainer.style.transform = `${baseTransform} scale(0.45)`;
    videoContainer.style.display = "none";
    logoVisual.style.opacity = "1";
    reveal();
  };

  const reveal = async () => {
    // Находим целевой элемент логотипа в hero
    const targetLogo = document.querySelector(".logo_symbol");
    if (!targetLogo) {
      // Если логотип не найден, делаем простую анимацию
      preloader.style.setProperty("--pre-white-opacity", "0");
      animateEl(
        logoVisual,
        [
          { transform: "translate(-50%, -50%) scale(0.3)" },
          { transform: "translate(-50%, -50%) scale(2)" },
        ],
        { duration: 900, easing: "linear", fill: "forwards" }
      );
      animateEl(preloader, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 500,
        easing: "linear",
        fill: "forwards",
      }).finally(() => {
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

    // Чтобы итоговый размер был targetWidth, нужен scale = targetWidth / baseWidth
    const targetScale = targetWidth / baseWidth;
    const baseTransform = "translate(-50%, -50%)";

    preloader.style.setProperty("--pre-white-opacity", "0");
    logoVisual.style.opacity = "1";

    const moveLogo = animateEl(
      logoVisual,
      [
        { transform: `${baseTransform} scale(0.3)` },
        {
          transform: `${baseTransform} translate(${deltaX}px, ${deltaY}px) scale(${targetScale})`,
        },
      ],
      { duration: 1400, easing: "linear", delay: 200, fill: "forwards" }
    );

    await moveLogo;

    await animateEl(
      preloader,
      [{ opacity: 1 }, { opacity: 0, pointerEvents: "none" }],
      { duration: 800, easing: "linear", fill: "forwards" }
    );

    preloader.remove();
    document.documentElement.style.overflow = "";
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
