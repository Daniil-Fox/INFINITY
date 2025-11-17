import Inputmask from "../../../node_modules/inputmask/dist/inputmask.es6.js";
import { validateFormsWP } from "../functions/validate-forms.js";

const PROFILE_FORM_SELECTOR = ".settings__form";
const initProfileSettings = () => {
  const form = document.querySelector(PROFILE_FORM_SELECTOR);
  if (!form) return;

  const editBtn = document.querySelector(".settings__btn");
  const saveBtn = form.querySelector(".settings__save");
  const inputs = Array.from(form.querySelectorAll(".form__input"));
  const firstInput = inputs[0];
  const phoneInput = form.querySelector(".input-only-tel");
  const walletBtn = document.querySelector(".settings__add");
  const walletContainer =
    document.querySelector("[data-wallets]") || walletBtn?.parentElement;

  let walletCounter = 0;
  const initFieldState = (field) => {
    if (!field) return;
    const input = field.querySelector(".form__input");
    const label = field.querySelector(".form__label");
    if (!input || !label) return;

    const toggleFilled = () => {
      if (input.value.trim().length) {
        field.classList.add("filled");
      } else {
        field.classList.remove("filled");
      }
    };

    input.addEventListener("focus", () => {
      field.classList.add("focus");
    });

    input.addEventListener("blur", () => {
      field.classList.remove("focus");
      toggleFilled();
    });

    input.addEventListener("input", toggleFilled);

    toggleFilled();
  };

  const initPhoneMask = () => {
    if (!phoneInput) return;
    const mask = new Inputmask({
      mask: "+7 (999) 999-99-99",
      showMaskOnHover: false,
      showMaskOnFocus: true,
      onBeforeMask(value) {
        if (!value || typeof value !== "string") return value;
        if (value.startsWith("7") || value.startsWith("8")) {
          return "";
        }
        return value;
      },
    });
    mask.mask(phoneInput);
  };

  const toggleInputs = (editable) => {
    inputs.forEach((input) => {
      if (editable) {
        input.removeAttribute("disabled");
      } else {
        input.setAttribute("disabled", "disabled");
      }
    });
    form.classList.toggle("is-editing", editable);
    if (saveBtn) {
      saveBtn.classList.toggle("is-visible", editable);
      saveBtn.disabled = !editable;
    }
  };

  const showToast = (message) => {
    const toast = document.createElement("div");
    toast.className = "settings-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);

    setTimeout(() => {
      toast.remove();
    }, 3600);
  };

  const handleEditClick = (event) => {
    event.preventDefault();
    if (form.classList.contains("is-editing")) {
      firstInput?.focus();
      return;
    }
    toggleInputs(true);
    firstInput?.focus();
  };

  const profileRules = [
    {
      ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-first-name`,
      rules: [
        {
          rule: "required",
          value: true,
          errorMessage: "Заполните имя!",
        },
        {
          rule: "minLength",
          value: 2,
          errorMessage: "Минимум 2 символа",
        },
      ],
    },
    {
      ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-last-name`,
      rules: [
        {
          rule: "required",
          value: true,
          errorMessage: "Заполните фамилию!",
        },
        {
          rule: "minLength",
          value: 2,
          errorMessage: "Минимум 2 символа",
        },
      ],
    },
    {
      ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-phone`,
      rules: [
        {
          rule: "required",
          value: true,
          errorMessage: "Заполните телефон!",
        },
        {
          rule: "function",
          validator(name, value) {
            if (!value || typeof value !== "string") return false;
            const cleanValue = value.replace(/\D/g, "");
            return cleanValue.length === 11;
          },
          errorMessage: "Введите корректный номер телефона",
        },
      ],
    },
    {
      ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-email`,
      rules: [
        {
          rule: "required",
          value: true,
          errorMessage: "Заполните email!",
        },
        {
          rule: "email",
          value: true,
          errorMessage: "Введите корректный email!",
        },
      ],
    },
  ];

  const handleProfileSaved = () => {
    toggleInputs(false);
    showToast("Данные профиля успешно сохранены");
  };

  const createWalletField = () => {
    if (!walletContainer) return;
    walletCounter += 1;
    const walletId = `wallet-token-${walletCounter}`;
    const field = document.createElement("div");
    field.className = "form__field settings__wallet-item";
    field.innerHTML = `
      <div class="settings__wallet-row">
        <div class="form__field-wrapper">
          <input
            type="text"
            class="form__input settings__wallet-input"
            id="${walletId}"
          />
          <label class="form__label" for="${walletId}">
            Новый кошелек
          </label>
          <button
            type="button"
            class="btn-reset settings__wallet-copy"
            aria-label="Скопировать адрес"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="black" stroke-opacity="0.45" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="btn-reset settings__wallet-edit"
          aria-label="Редактировать адрес"
        >
          <svg width="24" height="24">
            <use xlink:href="img/sprite.svg#pen"></use>
          </svg>
        </button>
      </div>
      <div class="settings__wallet-error" aria-live="polite"></div>
    `;

    const walletInput = field.querySelector(".settings__wallet-input");
    const copyBtn = field.querySelector(".settings__wallet-copy");
    const editBtn = field.querySelector(".settings__wallet-edit");
    const walletError = field.querySelector(".settings__wallet-error");

    const clearWalletError = () => {
      walletError.textContent = "";
      field.classList.remove("has-error");
    };

    const validateWallet = () => {
      const value = walletInput.value.trim();
      if (!value.length) {
        walletError.textContent = "Введите токен кошелька";
        field.classList.add("has-error");
        return false;
      }
      clearWalletError();
      return true;
    };

    const finishEditing = (showMessage = true) => {
      if (editBtn.dataset.state === "view") return;
      if (!validateWallet()) return;
      walletInput.setAttribute("disabled", "disabled");
      walletInput.blur();
      field.classList.remove("is-editing");
      editBtn.dataset.state = "view";
      if (showMessage) {
        showToast("Кошелек успешно сохранен");
      }
    };

    const startEditing = () => {
      field.classList.add("is-editing");
      walletInput.removeAttribute("disabled");
      walletInput.focus();
      walletInput.setSelectionRange(
        walletInput.value.length,
        walletInput.value.length
      );
      editBtn.dataset.state = "edit";
      clearWalletError();
    };

    editBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const isEditing = editBtn.dataset.state === "edit";
      if (isEditing) {
        finishEditing();
      } else {
        startEditing();
      }
    });

    copyBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      const value = walletInput.value.trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        showToast("Адрес скопирован");
      } catch (error) {
        console.error("Clipboard error", error);
      }
    });

    walletInput.addEventListener("input", () => {
      if (field.classList.contains("has-error")) {
        clearWalletError();
      }
    });

    walletInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finishEditing();
      } else if (event.key === "Escape") {
        event.preventDefault();
        walletInput.blur();
      }
    });

    walletInput.addEventListener("blur", () => {
      if (editBtn.dataset.state === "edit") {
        finishEditing(false);
      } else {
        walletInput.setAttribute("disabled", "disabled");
      }
    });

    if (
      walletBtn &&
      walletBtn.parentElement &&
      walletBtn.parentElement === walletContainer
    ) {
      walletContainer.insertBefore(field, walletBtn);
    } else if (walletBtn && walletBtn.parentElement) {
      walletBtn.parentElement.insertBefore(field, walletBtn);
    } else {
      walletContainer.appendChild(field);
    }
    startEditing();
    initFieldState(field);
  };

  toggleInputs(false);
  initPhoneMask();
  editBtn?.addEventListener("click", handleEditClick);

  validateFormsWP(
    PROFILE_FORM_SELECTOR,
    profileRules,
    [],
    handleProfileSaved,
    "update_profile",
    {
      resetOnSuccess: false,
      clearFilled: false,
    }
  );

  form.addEventListener("submit", () => {
    toggleInputs(false);
  });

  walletBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    createWalletField();
  });
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("loaded");
  initProfileSettings();
});
