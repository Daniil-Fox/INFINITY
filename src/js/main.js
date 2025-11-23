import "./_components.js";
import Rellax from "rellax";

import { burger } from "./functions/burger.js";
import { initCalculator } from "./components/calculator-engine.js";
import { initCalculatorPatterns } from "./components/calculator-patterns.js";
// Отключаем автоматическое восстановление позиции скролла
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

// Всегда скроллим наверх при загрузке/перезагрузке страницы
window.scrollTo(0, 0);

// Дополнительно скроллим наверх после полной загрузки страницы
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.scrollTo(0, 0);
  });
}

window.addEventListener("load", () => {
  window.scrollTo(0, 0);
});

const rellax = new Rellax(".rellax", {
  center: true,
});

document.addEventListener("DOMContentLoaded", () => {
  const calculator = document.querySelector(".calculator");
  const form = calculator?.querySelector(".calculator__form");
  if (form) {
    const calculatorApi = initCalculator(form);
    initCalculatorPatterns(form, calculatorApi);
  }
});
