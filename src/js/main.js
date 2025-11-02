import './_components.js';
import Rellax from 'rellax';

// Отключаем автоматическое восстановление позиции скролла
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Всегда скроллим наверх при загрузке/перезагрузке страницы
window.scrollTo(0, 0);

// Дополнительно скроллим наверх после полной загрузки страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.scrollTo(0, 0);
  });
}

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
});

const rellax = new Rellax('.rellax', {
  center: true
});
