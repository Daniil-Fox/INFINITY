document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".form__dropdown").forEach((dropdown) => {
    const dropdownHeader = dropdown.querySelector(".dropdown__header");
    const dropdownBody = dropdown.querySelector(".dropdown__body");
    const dropdownItems = dropdown.querySelectorAll(".dropdown__item");
    const capture = dropdown.querySelector(".dropdown__capture");
    const select = dropdown.parentElement.querySelector("select");

    dropdownHeader.addEventListener("click", () => {
      const isOpen = dropdown.classList.toggle("open");
      if (isOpen) {
        dropdownBody.style.maxHeight = dropdownBody.scrollHeight + "px";
      } else {
        dropdownBody.style.maxHeight = "";
      }
    });

    dropdownItems.forEach((item, idx) => {
      item.addEventListener("click", () => {
        capture.textContent = item.textContent;
        dropdown.classList.remove("open");
        dropdownBody.style.maxHeight = "";

        select.selectedIndex = idx;
        select.dispatchEvent(new Event("change", { bubbles: true }));

        dropdown.classList.add("filled");

        console.log(
          "Выбранный пункт селекта:",
          select.options[select.selectedIndex].text
        );
      });
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("open");
        dropdownBody.style.maxHeight = "";
      }
    });
  });
});
