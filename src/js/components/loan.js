import noUiSlider from "nouislider";

const calculatorForm = document.querySelector(".calculator__form");

if (calculatorForm) {
  const controls = [
    {
      input: calculatorForm.querySelector("#loanAmountInput"),
      slider: calculatorForm.querySelector("#loanAmountSlider"),
    },
    {
      input: calculatorForm.querySelector("#loanPowerInput"),
      slider: calculatorForm.querySelector("#loanPowerSlider"),
    },
    {
      input: calculatorForm.querySelector("#loanCourseInput"),
      slider: calculatorForm.querySelector("#loanCourseSlider"),
    },
  ].filter(({ input, slider }) => input && slider);

  controls.forEach(({ input, slider }) => {
    initRangeControl({ input, slider });
  });

  setupCurrencySuffix(calculatorForm);
}

export function initRangeControl({ input, slider }) {
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
  const precision = getPrecision(step);

  const clamp = (value) => Math.min(Math.max(value, min), max);

  const initialCandidate = readInitialValue(input);
  const startValue = clamp(
    Number.isFinite(initialCandidate) ? initialCandidate : min
  );

  setInputValue(input, startValue, precision);

  noUiSlider.create(slider, {
    start: [startValue],
    range: {
      min,
      max,
    },
    step,
    connect: "lower",
  });

  slider.noUiSlider.on("update", (values) => {
    const numericValue = parseFloat(values[0]);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    setInputValue(input, numericValue, precision);
  });

  const syncSlider = (value) => {
    slider.noUiSlider.set(clamp(value));
  };

  const handleInputChange = () => {
    const raw = input.value.trim();

    if (raw === "") {
      updateFilledState(input);
      return;
    }

    const numericValue = Number(raw);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    syncSlider(numericValue);
  };

  input.addEventListener("change", handleInputChange);
  input.addEventListener("input", handleInputChange);
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

  return Number(value).toFixed(precision);
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
