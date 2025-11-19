/**
 * Модальное окно
 * Управление открытием/закрытием через класс modal--active
 * Плавная анимация через opacity
 */

export function initModal() {
  const modals = document.querySelectorAll(".modal");
  if (modals.length === 0) return;

  // Обработчик открытия модального окна
  const openModal = (modalId) => {
    const modal = document.querySelector(modalId);
    if (!modal) {
      console.warn(`Modal with id ${modalId} not found`);
      return;
    }

    // Блокируем скролл страницы
    document.body.style.overflow = "hidden";

    // Добавляем класс для открытия
    modal.classList.add("modal--active");

    // Устанавливаем opacity для плавной анимации
    requestAnimationFrame(() => {
      modal.style.opacity = "1";

      // Инициализируем поля формы в модальном окне после открытия
      if (
        window.initFormInputs &&
        typeof window.initFormInputs === "function"
      ) {
        window.initFormInputs();
      }
    });
  };

  // Обработчик закрытия модального окна
  const closeModal = (modal) => {
    if (!modal) return;

    // Плавно скрываем модальное окно
    modal.style.opacity = "0";

    // Удаляем класс после завершения анимации
    setTimeout(() => {
      modal.classList.remove("modal--active");
      // Разблокируем скролл страницы
      document.body.style.overflow = "";
    }, 300); // Длительность анимации должна совпадать с CSS transition
  };

  // Инициализация для каждого модального окна
  modals.forEach((modal) => {
    // Устанавливаем начальное состояние (transition уже в CSS)
    modal.style.opacity = "0";

    // Обработчик закрытия по клику на overlay
    const overlay = modal.querySelector(".modal__overlay");
    if (overlay) {
      overlay.addEventListener("click", () => {
        closeModal(modal);
      });
    }

    // Обработчик закрытия по клику на кнопку закрытия
    const closeBtn = modal.querySelector(".modal__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeModal(modal);
      });
    }

    // Закрытие по клавише Escape
    const handleEscape = (e) => {
      if (e.key === "Escape" && modal.classList.contains("modal--active")) {
        closeModal(modal);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Сохраняем обработчик для возможного удаления
    modal._escapeHandler = handleEscape;
  });

  // Обработчик открытия модального окна по клику на кнопки с data-target
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-target]");
    if (!trigger) return;

    const targetId = trigger.getAttribute("data-target");
    if (!targetId || !targetId.startsWith("#")) return;

    const targetModal = document.querySelector(targetId);
    if (!targetModal) return;

    // Если клик по кнопке внутри модального окна успеха, закрываем его
    if (
      targetModal.classList.contains("modal--success") ||
      trigger.closest(".modal--success")
    ) {
      closeModal(targetModal);
      return;
    }

    openModal(targetId);
  });

  // Функция закрытия всех модальных окон
  const closeAllModals = () => {
    modals.forEach((modal) => {
      if (modal.classList.contains("modal--active")) {
        closeModal(modal);
      }
    });
  };

  // Функция открытия модального окна успеха (закрывает все остальные)
  const openSuccessModal = () => {
    // Закрываем все открытые модальные окна
    closeAllModals();

    // Небольшая задержка для плавного перехода
    setTimeout(() => {
      const successModal = document.querySelector("#modal-success");
      if (successModal) {
        openModal("#modal-success");
      }
    }, 300);
  };

  // Возвращаем API для программного управления
  return {
    open: openModal,
    close: (modalId) => {
      const modal = document.querySelector(modalId);
      closeModal(modal);
    },
    closeAll: closeAllModals,
    openSuccess: openSuccessModal,
  };
}

// Сохраняем API модального окна в глобальной переменной
let modalApi = null;

// Автоматическая инициализация при загрузке DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    modalApi = initModal();
    window.modalApi = modalApi; // Сохраняем в window для доступа из других модулей
  });
} else {
  modalApi = initModal();
  window.modalApi = modalApi; // Сохраняем в window для доступа из других модулей
}
