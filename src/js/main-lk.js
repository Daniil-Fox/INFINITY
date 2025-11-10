import "./components/loan.js";
import "./components/tooltips.js";
import { initCalculator } from "./components/calculator-engine.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".calculator__form");
  if (form) {
    initCalculator(form);
  }
});
