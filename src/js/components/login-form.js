import { validateFormsWP } from "../functions/validate-forms.js";

const LOGIN_FORM_SELECTOR = ".login__form";

const initLoginForm = () => {
  const form = document.querySelector(LOGIN_FORM_SELECTOR);
  if (!form) return;

  const submitBtn = form.querySelector(".login__submit");
  const notice = form.querySelector("[data-login-notice]");

  const setNotice = (message = "", isError = false) => {
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("login__notice--error", isError);
  };

  const toggleSubmitState = () => {
    if (!submitBtn) return;
    const email = form.querySelector("#login-email")?.value.trim();
    const password = form.querySelector("#login-password")?.value.trim();
    submitBtn.disabled = !(email && password);
  };

  const handleSuccess = () => {
    setNotice("Письмо с ссылкой отправлено. Проверьте почту.");
    toggleSubmitState();
  };

  const rules = [
    {
      ruleSelector: `${LOGIN_FORM_SELECTOR} #login-email`,
      rules: [
        { rule: "required", value: true, errorMessage: "Введите email" },
        {
          rule: "email",
          value: true,
          errorMessage: "Некорректный email",
        },
      ],
    },
    {
      ruleSelector: `${LOGIN_FORM_SELECTOR} #login-password`,
      rules: [
        { rule: "required", value: true, errorMessage: "Введите пароль" },
        {
          rule: "minLength",
          value: 6,
          errorMessage: "Минимум 6 символов",
        },
      ],
    },
  ];

  validateFormsWP(
    LOGIN_FORM_SELECTOR,
    rules,
    [],
    handleSuccess,
    "login_user",
    {
      resetOnSuccess: true,
      clearFilled: true,
    }
  );

  form.addEventListener("input", toggleSubmitState);

  form.addEventListener("submit", () => {
    setNotice();
    if (submitBtn) {
      submitBtn.disabled = true;
    }
  });

  toggleSubmitState();
};

document.addEventListener("DOMContentLoaded", initLoginForm);

