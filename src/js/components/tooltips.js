import tippy from "tippy.js";

window.addEventListener("DOMContentLoaded", () => {
  const hints = document.querySelectorAll(".hint");

  if (hints) {
    hints.forEach((hint) => {
      tippy(hint, {
        content: hint.dataset.text,
        theme: "tooltip",
        arrow: false,
      });
    });
  }
});
