/**
 * Инициализация обработчиков для полей формы
 * Работает с модальными окнами и динамически добавляемыми формами
 */
function initFormInputs() {
  const fields = document.querySelectorAll(".form__field");

  fields.forEach((field) => {
    // Пропускаем поля, которые уже инициализированы
    if (field.dataset.inputsInitialized === "true") {
      return;
    }

    const input = field.querySelector(".form__input");
    if (!input) return;

    const label = field.querySelector(".form__label");
    if (!label) return;

    // Отмечаем поле как инициализированное
    field.dataset.inputsInitialized = "true";

    // Проверяем начальное значение
    if (input.value && input.value.trim() !== "") {
      field.classList.add("filled");
    }

    // Обработчик фокуса
    input.addEventListener("focus", () => {
      field.classList.add("focus");
    });

    // Обработчик ввода
    input.addEventListener("input", () => {
      const currentValue = input.value.trim();
      if (currentValue !== "") {
        field.classList.add("filled");
      } else {
        field.classList.remove("filled");
      }
    });

    // Обработчик потери фокуса
    input.addEventListener("blur", () => {
      field.classList.remove("focus");
      const currentValue = input.value.trim();
      if (currentValue === "") {
        field.classList.remove("filled");
      }
    });
  });
}

// Инициализация при загрузке DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFormInputs);
} else {
  initFormInputs();
}

// Инициализация при открытии модального окна
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-target]");
  if (!trigger) return;

  const targetId = trigger.getAttribute("data-target");
  if (!targetId || !targetId.startsWith("#")) return;

  const modal = document.querySelector(targetId);
  if (!modal) return;

  // Инициализируем поля формы в модальном окне после небольшой задержки
  // (чтобы модальное окно успело открыться)
  setTimeout(() => {
    initFormInputs();
  }, 100);
});

// Экспортируем функцию для ручного вызова
export { initFormInputs };

// Сохраняем в глобальной области видимости для доступа из других модулей
if (typeof window !== "undefined") {
  window.initFormInputs = initFormInputs;
}
