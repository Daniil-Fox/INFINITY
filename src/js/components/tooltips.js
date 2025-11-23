import tippy from "tippy.js";

window.addEventListener("DOMContentLoaded", () => {
  const hints = document.querySelectorAll(".hint");

  if (hints) {
    hints.forEach((hint) => {
      tippy(hint, {
        content: hint.innerHTML,
        allowHTML: true,
        theme: "tooltip",
        arrow: false,
      });
    });
  }
});
