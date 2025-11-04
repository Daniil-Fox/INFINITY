// Аккордеон для секции "why" на мобилке
(function initWhyAccordion() {
  const section = document.querySelector('.why');
  if (!section) return;

  const BREAKPOINT_MOBILE = 576;
  const isMobileViewport = () => window.innerWidth <= BREAKPOINT_MOBILE;

  const items = section.querySelectorAll('.why__item');
  if (!items.length) return;

  const toggleItem = (item, isActive) => {
    const desc = item.querySelector('.why__item-desc');
    if (!desc) return;

    if (isActive) {
      item.classList.add('active');
      // Временно устанавливаем max-height: none для получения правильного scrollHeight
      desc.style.maxHeight = 'none';
      // Используем requestAnimationFrame для корректного вычисления высоты
      requestAnimationFrame(() => {
        const height = desc.scrollHeight;
        desc.style.maxHeight = height + 'px';
      });
    } else {
      item.classList.remove('active');
      desc.style.maxHeight = '0px';
    }
  };

  // Используем делегирование событий для избежания дублирования обработчиков
  const handleClick = (e) => {
    // Работаем только на мобилке
    if (!isMobileViewport()) return;

    const capture = e.target.closest('.why__item-capture');
    if (!capture) return;

    const item = capture.closest('.why__item');
    if (!item) return;

    const isActive = item.classList.contains('active');

    // Закрываем все элементы
    items.forEach((otherItem) => {
      if (otherItem !== item) {
        toggleItem(otherItem, false);
      }
    });

    // Переключаем текущий элемент
    toggleItem(item, !isActive);
  };

  const initAccordion = () => {
    if (!isMobileViewport()) {
      // На десктопе убираем класс active и сбрасываем max-height
      items.forEach((item) => {
        item.classList.remove('active');
        const desc = item.querySelector('.why__item-desc');
        if (desc) {
          desc.style.maxHeight = '';
        }
      });
      return;
    }

    // На мобилке активируем функциональность
    // Первый элемент делаем активным по умолчанию
    if (items[0]) {
      toggleItem(items[0], true);
    }
  };

  // Инициализация при загрузке
  initAccordion();

  // Делегирование событий - один обработчик на весь контейнер
  section.addEventListener('click', handleClick);

  // Обработка изменения размера окна с троттлингом
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initAccordion();
    }, 150);
  });
})();

