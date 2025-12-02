import noUiSlider from "nouislider";

export function initRangeControl({ input, slider }) {
  // Проверяем, не инициализирован ли слайдер уже
  if (slider.noUiSlider) {
    return;
  }
  const min = readNumberAttribute(
    input,
    "min",
    readNumberAttribute(slider, "data-min", 0)
  );
  const max = readNumberAttribute(
    input,
    "max",
    readNumberAttribute(slider, "data-max", min + 1)
  );
  const step = resolveStep(input);
  // Для шага читаем из атрибута напрямую, чтобы сохранить точность
  const stepAttr = input.getAttribute("step");
  const precision =
    stepAttr && stepAttr !== "any"
      ? stepAttr.includes(".")
        ? stepAttr.split(".")[1].length
        : 0
      : getPrecision(step);

  // ВАЖНО: min/max для поля могут динамически меняться (калькулятор обновляет атрибуты).
  // Поэтому при каждом клампе читаем актуальные границы из атрибутов,
  // используя исходные min/max как запасной вариант.
  const clamp = (value) => {
    const currentMin = readNumberAttribute(input, "min", min);
    const currentMax = readNumberAttribute(input, "max", max);
    const lo = Number.isFinite(currentMin) ? currentMin : min;
    const hi = Number.isFinite(currentMax) ? currentMax : max;
    return Math.min(Math.max(value, lo), hi);
  };

  const initialCandidate = readInitialValue(input);
  const startValue = clamp(
    Number.isFinite(initialCandidate) ? initialCandidate : min
  );

  setInputValue(input, startValue, precision);

  // Для поля курса биткоина настраиваем форматирование значений
  const isCourseInput = input.id === "loanCourseInput";

  // Для поля курса используем шаг из атрибута (теперь это целые числа)
  let actualStep = step;

  const sliderOptions = {
    start: [startValue],
    range: {
      min,
      max,
    },
    step: actualStep,
    connect: "lower",
  };

  // Для поля курса добавляем форматирование для правильного отображения
  if (isCourseInput) {
    sliderOptions.format = {
      to: function (value) {
        // Округляем до целого числа (стоимость 1 BTC в выбранной валюте)
        return Math.round(value);
      },
      from: function (value) {
        // Парсим значение обратно
        return parseFloat(value);
      },
    };
  }

  noUiSlider.create(slider, sliderOptions);

  slider.noUiSlider.on(
    "update",
    (values, handle, unencoded, tap, positions) => {
      // Для поля курса используем unencoded значение для максимальной точности
      // unencoded - это значение до применения форматирования (если доступно)
      let rawValue;

      if (isCourseInput) {
        // Для поля курса округляем до целого числа
        rawValue = Math.round(parseFloat(String(values[0])));
      } else {
        // Для других полей используем обычное значение
        rawValue = parseFloat(String(values[0]));
      }

      if (!Number.isFinite(rawValue) || rawValue <= 0) {
        return;
      }

      // Для поля курса форматируем значение как целое число
      if (isCourseInput) {
        // Округляем до целого числа (стоимость 1 BTC в выбранной валюте)
        const rounded = Math.round(rawValue);
        const formatted = rounded.toString();

        input.value = formatted;
        input.setAttribute("value", formatted);
        updateFilledState(input);

        // Триггерим кастомное событие БЕЗ перерасчета (перерасчет при slider-end)
        input.dispatchEvent(
          new CustomEvent("slider-update", {
            detail: { value: rounded, skipRender: true },
          })
        );
      } else {
        const actualPrecision = precision;
        setInputValue(input, rawValue, actualPrecision);

        // Триггерим кастомное событие для синхронизации с калькулятором
        input.dispatchEvent(
          new CustomEvent("slider-update", {
            detail: { value: rawValue, skipRender: true },
          })
        );
      }
    }
  );

  // Обработчик окончания перетаскивания слайдера для всех полей
  slider.noUiSlider.on("end", () => {
    const inputId = input.id;
    let value = 0;

    if (isCourseInput) {
      // Для курса используем целое число
      value = Math.round(parseFloat(input.value) || 0);
    } else {
      // Для других полей
      value = parseFloat(input.value) || 0;
    }

    // Триггерим событие окончания перетаскивания
    input.dispatchEvent(
      new CustomEvent("slider-end", {
        detail: { value },
      })
    );
  });

  const syncSlider = (value) => {
    // Для поля курса округляем значение до целого числа
    if (isCourseInput) {
      const rounded = Math.round(value);
      slider.noUiSlider.set(clamp(rounded));
    } else {
      slider.noUiSlider.set(clamp(value));
    }
  };

  const handleInputChange = () => {
    const raw = input.value.trim();

    if (raw === "") {
      updateFilledState(input);
      return;
    }

    // Для поля курса используем parseFloat для сохранения точности маленьких чисел
    const isCourseInput = input.id === "loanCourseInput";
    const numericValue = isCourseInput ? parseFloat(raw) : Number(raw);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    syncSlider(numericValue);
  };

  input.addEventListener("change", handleInputChange);
  // input.addEventListener("input", handleInputChange);
}

export function readNumberAttribute(element, attributeName, fallback) {
  if (!element) {
    return fallback;
  }

  const attributeValue = element.getAttribute(attributeName);

  if (attributeValue !== null && attributeValue !== "") {
    const parsed = Number(attributeValue);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function resolveStep(input) {
  const rawStep = input.getAttribute("step");

  if (!rawStep || rawStep === "any") {
    return 1;
  }

  const parsed = Number(rawStep);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function getPrecision(step) {
  if (!Number.isFinite(step)) {
    return 0;
  }

  // Для очень маленьких чисел toString() может вернуть научную нотацию (например, "1e-9")
  // В этом случае вычисляем precision из самого числа
  if (step < 1 && step > 0) {
    // Для чисел меньше 1 вычисляем количество знаков после запятой
    // Умножаем на 10^9, чтобы получить целое число, и считаем нули
    let precision = 0;
    let temp = step;
    while (temp < 1 && precision < 20) {
      temp *= 10;
      precision++;
      // Проверяем, что следующая цифра не равна 0 (чтобы не считать лишние нули)
      if (Math.floor(temp) > 0) {
        break;
      }
    }
    // Если число очень маленькое, используем альтернативный метод
    if (precision >= 20 || temp >= 10) {
      // Используем строковое представление из атрибута, если доступно
      const stepString = step.toString();
      if (stepString.includes("e-")) {
        // Научная нотация: "1e-9" -> precision = 9
        const match = stepString.match(/e-(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      } else if (stepString.includes(".")) {
        return stepString.split(".")[1].length;
      }
    }
    return precision;
  }

  const stepString = step.toString();

  if (!stepString.includes(".")) {
    return 0;
  }

  return stepString.split(".")[1].length;
}

export function readInitialValue(input) {
  if (input.value) {
    const parsed = Number(input.value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const attrValue = input.getAttribute("value");

  if (attrValue !== null && attrValue !== "") {
    const parsed = Number(attrValue);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function setInputValue(input, value, precision) {
  const formatted = formatValue(value, precision);
  input.value = formatted;
  input.setAttribute("value", formatted);
  updateFilledState(input);
}

export function formatValue(value, precision) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (precision === 0) {
    return String(Math.round(value));
  }

  // Используем toFixed для форматирования с нужной точностью
  // toFixed всегда работает корректно для любого числа, включая очень маленькие
  return value.toFixed(precision);
}

export function setupCurrencySuffix(form) {
  const amountInput = form.querySelector("#loanAmountInput");

  if (!amountInput) {
    return;
  }

  const wrapper = amountInput.closest(".calculator__inwrapper");

  if (!wrapper) {
    return;
  }

  const radios = Array.from(form.querySelectorAll('input[name="currency"]'));

  const updateSuffix = () => {
    const active = radios.find((radio) => radio.checked);

    if (!active) {
      wrapper.dataset.after = "";
      return;
    }

    const label = form.querySelector(`label[for="${active.id}"]`);
    wrapper.dataset.after = label ? label.textContent.trim() : "";
  };

  radios.forEach((radio) => {
    radio.addEventListener("change", updateSuffix);
  });

  updateSuffix();
}

export function updateFilledState(input) {
  if (!input) {
    return;
  }

  const wrapper = input.closest(".calculator__inwrapper");

  if (!wrapper) {
    return;
  }

  const hasValue = input.value.trim() !== "";
  wrapper.classList.toggle("is-filled", hasValue);
}

export default {
  initRangeControl,
  setupCurrencySuffix,
  readNumberAttribute,
  resolveStep,
  getPrecision,
  readInitialValue,
  setInputValue,
  formatValue,
  updateFilledState,
};
