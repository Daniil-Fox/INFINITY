import "./components/loan.js";
import "./components/tooltips.js";
import { initCalculator } from "./components/calculator-engine.js";
import { initCalculatorPatterns } from "./components/calculator-patterns.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".calculator__form");
  if (form) {
    const calculatorApi = initCalculator(form);
    initCalculatorPatterns(form, calculatorApi);
  }
});
