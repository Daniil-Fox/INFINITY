// import { validateFormsWP } from "../functions/validate-forms.js";

// const LOGIN_FORM_SELECTOR = ".login__form[data-form='login']";
// const REGISTER_FORM_SELECTOR = ".login__form[data-form='register']";

const initLoginForm = () => {
  // const loginForm = document.querySelector(LOGIN_FORM_SELECTOR);
  // const registerForm = document.querySelector(REGISTER_FORM_SELECTOR);
  const tabs = document.querySelectorAll(".login__tab");
  const forms = document.querySelectorAll(".login__form");

  // if (!loginForm || !registerForm) return;

  // Переключение табов
  const switchTab = (tabName) => {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle("login__tab--active", isActive);
    });

    forms.forEach((form) => {
      const isActive = form.dataset.form === tabName;
      form.classList.toggle("login__form--active", isActive);
    });

    // Очищаем уведомления при переключении
    document.querySelectorAll(".login__notice").forEach((notice) => {
      notice.textContent = "";
      notice.classList.remove("login__notice--error");
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.tab);
    });
  });

  // // Валидация формы входа
  // const loginSubmitBtn = loginForm.querySelector(".login__submit");
  // const loginNotice = loginForm.querySelector("[data-login-notice]");

  // const setLoginNotice = (message = "", isError = false) => {
  //   if (!loginNotice) return;
  //   loginNotice.textContent = message;
  //   loginNotice.classList.toggle("login__notice--error", isError);
  // };

  // const toggleLoginSubmitState = () => {
  //   if (!loginSubmitBtn) return;
  //   const email = loginForm.querySelector("#login-email")?.value.trim();
  //   const password = loginForm.querySelector("#login-password")?.value.trim();
  //   loginSubmitBtn.disabled = !(email && password);
  // };

  // const handleLoginSuccess = () => {
  //   setLoginNotice("Вход выполнен успешно");
  //   toggleLoginSubmitState();
  // };

  // const loginRules = [
  //   {
  //     ruleSelector: `${LOGIN_FORM_SELECTOR} #login-email`,
  //     rules: [
  //       { rule: "required", value: true, errorMessage: "Введите email" },
  //       {
  //         rule: "email",
  //         value: true,
  //         errorMessage: "Некорректный email",
  //       },
  //     ],
  //   },
  //   {
  //     ruleSelector: `${LOGIN_FORM_SELECTOR} #login-password`,
  //     rules: [
  //       { rule: "required", value: true, errorMessage: "Введите пароль" },
  //       {
  //         rule: "minLength",
  //         value: 6,
  //         errorMessage: "Минимум 6 символов",
  //       },
  //     ],
  //   },
  // ];

  // validateFormsWP(
  //   LOGIN_FORM_SELECTOR,
  //   loginRules,
  //   [],
  //   handleLoginSuccess,
  //   "login_user",
  //   {
  //     resetOnSuccess: true,
  //     clearFilled: true,
  //   }
  // );

  // loginForm.addEventListener("input", toggleLoginSubmitState);
  // loginForm.addEventListener("submit", () => {
  //   setLoginNotice();
  //   if (loginSubmitBtn) {
  //     loginSubmitBtn.disabled = true;
  //   }
  // });

  // // Валидация формы регистрации
  // const registerSubmitBtn = registerForm.querySelector(".register__submit");
  // const registerNotice = registerForm.querySelector("[data-register-notice]");

  // const setRegisterNotice = (message = "", isError = false) => {
  //   if (!registerNotice) return;
  //   registerNotice.textContent = message;
  //   registerNotice.classList.toggle("login__notice--error", isError);
  // };

  // const toggleRegisterSubmitState = () => {
  //   if (!registerSubmitBtn) return;
  //   const name = registerForm.querySelector("#register-name")?.value.trim();
  //   const email = registerForm.querySelector("#register-email")?.value.trim();
  //   const password = registerForm
  //     .querySelector("#register-password")
  //     ?.value.trim();
  //   const passwordConfirm = registerForm
  //     .querySelector("#register-password-confirm")
  //     ?.value.trim();
  //   registerSubmitBtn.disabled = !(
  //     name &&
  //     email &&
  //     password &&
  //     passwordConfirm
  //   );
  // };

  // const handleRegisterSuccess = () => {
  //   setRegisterNotice("Регистрация выполнена успешно");
  //   toggleRegisterSubmitState();
  // };

  // const registerRules = [
  //   {
  //     ruleSelector: `${REGISTER_FORM_SELECTOR} #register-password-confirm`,
  //     rules: [
  //       {
  //         rule: "function",
  //         validator: (name, value) => {
  //           const password =
  //             registerForm.querySelector("#register-password")?.value;
  //           return value === password;
  //         },
  //         errorMessage: "Пароли не совпадают",
  //       },
  //     ],
  //   },
  // ];

  // const registerValidator = validateFormsWP(
  //   REGISTER_FORM_SELECTOR,
  //   registerRules,
  //   [],
  //   handleRegisterSuccess,
  //   "register_user",
  //   {
  //     resetOnSuccess: true,
  //     clearFilled: true,
  //   }
  // );

  // if (!registerValidator) {
  //   console.error("Не удалось инициализировать валидацию формы регистрации");
  // }

  // registerForm.addEventListener("input", toggleRegisterSubmitState);

  // // Обработчик клика на кнопку для отладки
  // if (registerSubmitBtn) {
  //   registerSubmitBtn.addEventListener("click", (e) => {
  //     console.log("Register button clicked", {
  //       disabled: registerSubmitBtn.disabled,
  //       form: registerForm,
  //       validator: registerValidator,
  //     });
  //   });
  // }

  // registerForm.addEventListener("submit", (e) => {
  //   console.log("Register form submit event");
  //   const password = registerForm.querySelector("#register-password")?.value;
  //   const passwordConfirm = registerForm.querySelector(
  //     "#register-password-confirm"
  //   )?.value;

  //   // Проверяем совпадение паролей перед отправкой
  //   if (password !== passwordConfirm) {
  //     e.preventDefault();
  //     setRegisterNotice("Пароли не совпадают", true);
  //     if (registerSubmitBtn) {
  //       registerSubmitBtn.disabled = false;
  //     }
  //     return false;
  //   }

  //   setRegisterNotice();
  //   if (registerSubmitBtn) {
  //     registerSubmitBtn.disabled = true;
  //   }
  // });

  // // Инициализация состояния кнопок
  // toggleLoginSubmitState();
  // toggleRegisterSubmitState();
};

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  // console.log("init");
});
