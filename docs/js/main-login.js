/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/js/_vars.js":
/*!*************************!*\
  !*** ./src/js/_vars.js ***!
  \*************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  windowEl: window,
  documentEl: document,
  htmlEl: document.documentElement,
  bodyEl: document.body
});

/***/ }),

/***/ "./src/js/components/inputs.js":
/*!*************************************!*\
  !*** ./src/js/components/inputs.js ***!
  \*************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initFormInputs: () => (/* binding */ initFormInputs)
/* harmony export */ });
/**
 * Инициализация обработчиков для полей формы
 * Работает с модальными окнами и динамически добавляемыми формами
 */
function initFormInputs() {
  const fields = document.querySelectorAll(".form__field");
  fields.forEach(field => {
    // Пропускаем поля, которые уже инициализированы
    if (field.dataset.inputsInitialized === "true") {
      return;
    }
    const input = field.querySelector(".form__input");
    if (!input) return;
    const label = field.querySelector(".form__label");
    if (!label) return;

    // Отмечаем поле как инициализированное
    field.dataset.inputsInitialized = "true";

    // Проверяем начальное значение
    if (input.value && input.value.trim() !== "") {
      field.classList.add("filled");
    }

    // Обработчик фокуса
    input.addEventListener("focus", () => {
      field.classList.add("focus");
    });

    // Обработчик ввода
    input.addEventListener("input", () => {
      const currentValue = input.value.trim();
      if (currentValue !== "") {
        field.classList.add("filled");
      } else {
        field.classList.remove("filled");
      }
    });

    // Обработчик потери фокуса
    input.addEventListener("blur", () => {
      field.classList.remove("focus");
      const currentValue = input.value.trim();
      if (currentValue === "") {
        field.classList.remove("filled");
      }
    });
  });
}

// Инициализация при загрузке DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFormInputs);
} else {
  initFormInputs();
}

// Инициализация при открытии модального окна
document.addEventListener("click", e => {
  const trigger = e.target.closest("[data-target]");
  if (!trigger) return;
  const targetId = trigger.getAttribute("data-target");
  if (!targetId || !targetId.startsWith("#")) return;
  const modal = document.querySelector(targetId);
  if (!modal) return;

  // Инициализируем поля формы в модальном окне после небольшой задержки
  // (чтобы модальное окно успело открыться)
  setTimeout(() => {
    initFormInputs();
  }, 100);
});

// Экспортируем функцию для ручного вызова


// Сохраняем в глобальной области видимости для доступа из других модулей
if (typeof window !== "undefined") {
  window.initFormInputs = initFormInputs;
}

/***/ }),

/***/ "./src/js/components/login-form.js":
/*!*****************************************!*\
  !*** ./src/js/components/login-form.js ***!
  \*****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
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
  const switchTab = tabName => {
    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle("login__tab--active", isActive);
    });
    forms.forEach(form => {
      const isActive = form.dataset.form === tabName;
      form.classList.toggle("login__form--active", isActive);
    });

    // Очищаем уведомления при переключении
    document.querySelectorAll(".login__notice").forEach(notice => {
      notice.textContent = "";
      notice.classList.remove("login__notice--error");
    });
  };
  tabs.forEach(tab => {
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

/***/ }),

/***/ "./src/js/functions/burger.js":
/*!************************************!*\
  !*** ./src/js/functions/burger.js ***!
  \************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _functions_disable_scroll_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../functions/disable-scroll.js */ "./src/js/functions/disable-scroll.js");
/* harmony import */ var _functions_enable_scroll_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../functions/enable-scroll.js */ "./src/js/functions/enable-scroll.js");


(function () {
  const burger = document?.querySelector("[data-burger]");
  const menu = document?.querySelector("[data-menu]");
  const menuItems = document?.querySelectorAll("[data-menu-item]");
  const overlay = document?.querySelector("[data-menu-overlay]");
  burger?.addEventListener("click", e => {
    burger?.classList.toggle("burger--active");
    menu?.classList.toggle("menu--active");
    if (menu?.classList.contains("menu--active")) {
      burger?.setAttribute("aria-expanded", "true");
      burger?.setAttribute("aria-label", "Закрыть меню");
      (0,_functions_disable_scroll_js__WEBPACK_IMPORTED_MODULE_0__.disableScroll)();
    } else {
      burger?.setAttribute("aria-expanded", "false");
      burger?.setAttribute("aria-label", "Открыть меню");
      (0,_functions_enable_scroll_js__WEBPACK_IMPORTED_MODULE_1__.enableScroll)();
    }
  });
  overlay?.addEventListener("click", () => {
    burger?.setAttribute("aria-expanded", "false");
    burger?.setAttribute("aria-label", "Открыть меню");
    burger.classList.remove("burger--active");
    menu.classList.remove("menu--active");
    (0,_functions_enable_scroll_js__WEBPACK_IMPORTED_MODULE_1__.enableScroll)();
  });
  menuItems?.forEach(el => {
    el.addEventListener("click", () => {
      burger?.setAttribute("aria-expanded", "false");
      burger?.setAttribute("aria-label", "Открыть меню");
      burger.classList.remove("burger--active");
      menu.classList.remove("menu--active");
      (0,_functions_enable_scroll_js__WEBPACK_IMPORTED_MODULE_1__.enableScroll)();
    });
  });
})();

/***/ }),

/***/ "./src/js/functions/disable-scroll.js":
/*!********************************************!*\
  !*** ./src/js/functions/disable-scroll.js ***!
  \********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   disableScroll: () => (/* binding */ disableScroll)
/* harmony export */ });
/* harmony import */ var _vars_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../_vars.js */ "./src/js/_vars.js");

const disableScroll = () => {
  const fixBlocks = document?.querySelectorAll('.fixed-block');
  const pagePosition = window.scrollY;
  const paddingOffset = `${window.innerWidth - _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.offsetWidth}px`;
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].htmlEl.style.scrollBehavior = 'none';
  fixBlocks.forEach(el => {
    el.style.paddingRight = paddingOffset;
  });
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.style.paddingRight = paddingOffset;
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.classList.add('dis-scroll');
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.dataset.position = pagePosition;
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.style.top = `-${pagePosition}px`;
};

/***/ }),

/***/ "./src/js/functions/enable-scroll.js":
/*!*******************************************!*\
  !*** ./src/js/functions/enable-scroll.js ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   enableScroll: () => (/* binding */ enableScroll)
/* harmony export */ });
/* harmony import */ var _vars_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../_vars.js */ "./src/js/_vars.js");

const enableScroll = () => {
  const fixBlocks = document?.querySelectorAll('.fixed-block');
  const body = document.body;
  const pagePosition = parseInt(_vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.dataset.position, 10);
  fixBlocks.forEach(el => {
    el.style.paddingRight = '0px';
  });
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.style.paddingRight = '0px';
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.style.top = 'auto';
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.classList.remove('dis-scroll');
  window.scroll({
    top: pagePosition,
    left: 0
  });
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].bodyEl.removeAttribute('data-position');
  _vars_js__WEBPACK_IMPORTED_MODULE_0__["default"].htmlEl.style.scrollBehavior = 'smooth';
};

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!******************************!*\
  !*** ./src/js/main-login.js ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _components_inputs_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./components/inputs.js */ "./src/js/components/inputs.js");
/* harmony import */ var _components_login_form_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./components/login-form.js */ "./src/js/components/login-form.js");
/* harmony import */ var _functions_burger_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./functions/burger.js */ "./src/js/functions/burger.js");



})();

/******/ })()
;
//# sourceMappingURL=main-login.js.map