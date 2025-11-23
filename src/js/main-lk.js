import "./components/loan.js";
import "./components/tooltips.js";
import "./components/charts.js";
import "./components/inputs.js";
import "./components/dropdown.js";
import { initCalculator } from "./components/calculator-engine.js";
import { initCalculatorPatterns } from "./components/calculator-patterns.js";
import { initHistoryModal } from "./components/history-modal.js";
import { burger } from "./functions/burger.js";
document.addEventListener("DOMContentLoaded", () => {
  const calculator = document.querySelector(".calculator");
  const form = calculator?.querySelector(".calculator__form");
  if (form) {
    const calculatorApi = initCalculator(form);
    initCalculatorPatterns(form, calculatorApi);
  }

  initHistoryModal();
});
