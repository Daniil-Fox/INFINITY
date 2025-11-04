// Скрытие/показ header при скролле на мобилке
import { throttle } from '../functions/throttle.js';

(function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  const BREAKPOINT_MOBILE = 576;
  const isMobileViewport = () => window.innerWidth <= BREAKPOINT_MOBILE;

  let lastScrollY = window.scrollY;

  const handleScroll = () => {
    // Работаем только на мобилке
    if (!isMobileViewport()) {
      header.classList.remove('header--hidden');
      header.classList.remove('header--visible');
      lastScrollY = window.scrollY;
      return;
    }

    const currentScrollY = window.scrollY;

    // Игнорируем скролл в самом верху страницы
    if (currentScrollY < 10) {
      header.classList.remove('header--hidden');
      header.classList.remove('header--visible');
      lastScrollY = currentScrollY;
      return;
    }

    // Определяем направление скролла
    if (currentScrollY > lastScrollY) {
      // Скролл вниз - скрываем
      header.classList.add('header--hidden');
      header.classList.remove('header--visible');
    } else if (currentScrollY < lastScrollY) {
      // Скролл вверх - показываем
      header.classList.remove('header--hidden');
      header.classList.add('header--visible');
    }

    lastScrollY = currentScrollY;
  };

  // Используем throttle для оптимизации (150ms)
  const throttledHandleScroll = throttle(handleScroll, 150);

  // Инициализация при загрузке
  handleScroll();

  // Обработчик скролла
  window.addEventListener('scroll', throttledHandleScroll, { passive: true });

  // Обработка изменения размера окна
  window.addEventListener('resize', () => {
    handleScroll();
  });
})();

