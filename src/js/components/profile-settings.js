// import Inputmask from "../../../node_modules/inputmask/dist/inputmask.es6.js";
// import { validateFormsWP } from "../functions/validate-forms.js";

// const PROFILE_FORM_SELECTOR = ".settings__form";
// // const API_BASE = "/wp-json/infinity/v1";

// // // Функции для работы с REST API кошельков
// // async function getWallets() {
// //   try {
// //     const response = await fetch(`${API_BASE}/wallets`, {
// //       method: "GET",
// //       credentials: "same-origin",
// //       headers: {
// //         "Content-Type": "application/json",
// //       },
// //     });

// //     if (!response.ok) {
// //       if (response.status === 401) {
// //         throw new Error("Необходима авторизация");
// //       }
// //       throw new Error(`Ошибка: ${response.status}`);
// //     }

// //     const wallets = await response.json();
// //     return wallets;
// //   } catch (error) {
// //     console.error("Ошибка при получении кошельков:", error);
// //     throw error;
// //   }
// // }

// // async function addWallet(address, type = "btc") {
// //   try {
// //     const response = await fetch(`${API_BASE}/wallets`, {
// //       method: "POST",
// //       credentials: "same-origin",
// //       headers: {
// //         "Content-Type": "application/json",
// //       },
// //       body: JSON.stringify({
// //         address: address.trim(),
// //         type: type,
// //       }),
// //     });

// //     if (!response.ok) {
// //       const error = await response.json();
// //       throw new Error(error.message || `Ошибка: ${response.status}`);
// //     }

// //     const result = await response.json();
// //     return result;
// //   } catch (error) {
// //     console.error("Ошибка при добавлении кошелька:", error);
// //     throw error;
// //   }
// // }

// // async function deleteWallet(walletId) {
// //   try {
// //     const response = await fetch(`${API_BASE}/wallets/${walletId}`, {
// //       method: "DELETE",
// //       credentials: "same-origin",
// //       headers: {
// //         "Content-Type": "application/json",
// //       },
// //     });

// //     if (!response.ok) {
// //       const error = await response.json();
// //       throw new Error(error.message || `Ошибка: ${response.status}`);
// //     }

// //     const result = await response.json();
// //     return result;
// //   } catch (error) {
// //     console.error("Ошибка при удалении кошелька:", error);
// //     throw error;
// //   }
// // }

// const initProfileSettings = () => {
//   const form = document.querySelector(PROFILE_FORM_SELECTOR);
//   if (!form) return;

//   const editBtn = document.querySelector(".settings__btn");
//   const saveBtn = form.querySelector(".settings__save");
//   const inputs = Array.from(form.querySelectorAll(".form__input"));
//   const firstInput = inputs[0];
//   const phoneInput = form.querySelector(".input-only-tel");
//   // const walletBtn = document.querySelector(".settings__add");
//   // const walletContainer =
//   //   document.querySelector("[data-wallets]") || walletBtn?.parentElement;

//   // let walletCounter = 0;

//   // // Получаем URL спрайта для иконок
//   // const spriteUrl =
//   //   walletContainer?.dataset.spriteUrl ||
//   //   "/wp-content/themes/infinity/assets/img/sprite.svg" ||
//   //   "img/sprite.svg";
//   const initFieldState = (field) => {
//     if (!field) return;
//     const input = field.querySelector(".form__input");
//     const label = field.querySelector(".form__label");
//     if (!input || !label) return;

//     const toggleFilled = () => {
//       if (input.value.trim().length) {
//         field.classList.add("filled");
//       } else {
//         field.classList.remove("filled");
//       }
//     };

//     input.addEventListener("focus", () => {
//       field.classList.add("focus");
//     });

//     input.addEventListener("blur", () => {
//       field.classList.remove("focus");
//       toggleFilled();
//     });

//     input.addEventListener("input", toggleFilled);

//     toggleFilled();
//   };

//   const initPhoneMask = () => {
//     if (!phoneInput) return;
//     const mask = new Inputmask({
//       mask: "+7 (999) 999-99-99",
//       showMaskOnHover: false,
//       showMaskOnFocus: true,
//       onBeforeMask(value) {
//         if (!value || typeof value !== "string") return value;
//         if (value.startsWith("7") || value.startsWith("8")) {
//           return "";
//         }
//         return value;
//       },
//     });
//     mask.mask(phoneInput);
//   };

//   const toggleInputs = (editable) => {
//     inputs.forEach((input) => {
//       if (editable) {
//         input.removeAttribute("disabled");
//       } else {
//         input.setAttribute("disabled", "disabled");
//       }
//     });
//     form.classList.toggle("is-editing", editable);
//     if (saveBtn) {
//       saveBtn.classList.toggle("is-visible", editable);
//       saveBtn.disabled = !editable;
//     }
//   };

//   const showToast = (message) => {
//     const toast = document.createElement("div");
//     toast.className = "settings-toast";
//     toast.setAttribute("role", "status");
//     toast.textContent = message;
//     document.body.appendChild(toast);

//     requestAnimationFrame(() => {
//       toast.classList.add("is-visible");
//     });

//     setTimeout(() => {
//       toast.classList.remove("is-visible");
//     }, 3200);

//     setTimeout(() => {
//       toast.remove();
//     }, 3600);
//   };

//   const handleEditClick = (event) => {
//     event.preventDefault();
//     if (form.classList.contains("is-editing")) {
//       firstInput?.focus();
//       return;
//     }
//     toggleInputs(true);
//     firstInput?.focus();
//   };

//   const profileRules = [
//     {
//       ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-first-name`,
//       rules: [
//         {
//           rule: "required",
//           value: true,
//           errorMessage: "Заполните имя!",
//         },
//         {
//           rule: "minLength",
//           value: 2,
//           errorMessage: "Минимум 2 символа",
//         },
//       ],
//     },
//     {
//       ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-last-name`,
//       rules: [
//         {
//           rule: "required",
//           value: true,
//           errorMessage: "Заполните фамилию!",
//         },
//         {
//           rule: "minLength",
//           value: 2,
//           errorMessage: "Минимум 2 символа",
//         },
//       ],
//     },
//     {
//       ruleSelector: `${PROFILE_FORM_SELECTOR} #profile-email`,
//       rules: [
//         {
//           rule: "required",
//           value: true,
//           errorMessage: "Заполните email!",
//         },
//         {
//           rule: "email",
//           value: true,
//           errorMessage: "Введите корректный email!",
//         },
//       ],
//     },
//   ];

//   const handleProfileSaved = () => {
//     toggleInputs(false);
//     showToast("Данные профиля успешно сохранены");
//   };

//   // // Создание элемента кошелька из данных API
//   // const createWalletFieldFromData = (walletData = null) => {
//   //   if (!walletContainer) return null;
//   //   walletCounter += 1;
//   //   const walletId = walletData?.id || `new-${Date.now()}`;
//   //   const inputId = `wallet-token-${walletCounter}`;
//   //   const address = walletData?.address || "";
//   //   const isNew = !walletData;

//   //   const field = document.createElement("div");
//   //   field.className = "form__field settings__wallet-item";
//   //   if (isNew) {
//   //     field.classList.add("is-editing");
//   //   }
//   //   field.setAttribute("data-wallet-id", walletId);
//   //   field.setAttribute("data-wallet-address", address);
//   //   if (isNew) {
//   //     field.setAttribute("data-wallet-new", "true");
//   //   }

//   //   // Экранируем адрес для безопасной вставки в HTML
//   //   const escapedAddress = address
//   //     .replace(/&/g, "&amp;")
//   //     .replace(/</g, "&lt;")
//   //     .replace(/>/g, "&gt;")
//   //     .replace(/"/g, "&quot;")
//   //     .replace(/'/g, "&#039;");

//   //   field.innerHTML = `
//   //     <div class="settings__wallet-row">
//   //       <div class="form__field-wrapper">
//   //         <input
//   //           type="text"
//   //           class="form__input settings__wallet-input"
//   //           id="${inputId}"
//   //           value="${escapedAddress}"
//   //           ${!isNew ? "disabled" : ""}
//   //           placeholder="Введите адрес кошелька"
//   //         />
//   //         <label class="form__label" for="${inputId}">
//   //           ${isNew ? "Новый кошелек" : "Адрес кошелька"}
//   //         </label>
//   //         <button
//   //           type="button"
//   //           class="btn-reset settings__wallet-copy"
//   //           aria-label="Скопировать адрес"
//   //           data-wallet-copy
//   //         >
//   //           <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
//   //             <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
//   //             <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="black" stroke-opacity="0.45" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
//   //           </svg>
//   //         </button>
//   //       </div>
//   //       <button
//   //         type="button"
//   //         class="btn-reset settings__wallet-edit"
//   //         aria-label="Редактировать адрес"
//   //         data-state="${isNew ? "edit" : "view"}"
//   //         data-wallet-edit
//   //       >
//   //         <svg width="24" height="24">
//   //           <use xlink:href="${spriteUrl}#pen"></use>
//   //         </svg>
//   //       </button>
//   //     </div>
//   //     <div class="settings__wallet-error" aria-live="polite" data-wallet-error style="display: none;"></div>
//   //   `;

//   //   const walletInput = field.querySelector(".settings__wallet-input");
//   //   const copyBtn = field.querySelector(".settings__wallet-copy");
//   //   const editBtn = field.querySelector(".settings__wallet-edit");
//   //   const walletError = field.querySelector(".settings__wallet-error");

//   //   const clearWalletError = () => {
//   //     walletError.textContent = "";
//   //     walletError.style.display = "none";
//   //     field.classList.remove("has-error");
//   //   };

//   //   const showWalletError = (message) => {
//   //     walletError.textContent = message;
//   //     walletError.style.display = "block";
//   //     field.classList.add("has-error");
//   //   };

//   //   const validateWallet = () => {
//   //     const value = walletInput.value.trim();
//   //     if (!value.length) {
//   //       showWalletError("Введите адрес кошелька");
//   //       return false;
//   //     }
//   //     if (value.length < 10) {
//   //       showWalletError("Адрес кошелька слишком короткий");
//   //       return false;
//   //     }
//   //     clearWalletError();
//   //     return true;
//   //   };

//   //   const saveWallet = async () => {
//   //     const walletId = field.getAttribute("data-wallet-id");
//   //     const isNew = field.hasAttribute("data-wallet-new");
//   //     const newAddress = walletInput.value.trim();
//   //     const oldAddress = field.getAttribute("data-wallet-address") || "";

//   //     if (!validateWallet()) {
//   //       return false;
//   //     }

//   //     // Если адрес не изменился, просто выходим из режима редактирования
//   //     if (!isNew && newAddress === oldAddress) {
//   //       cancelEditing();
//   //       return true;
//   //     }

//   //     // Показываем состояние загрузки
//   //     field.classList.add("is-loading");
//   //     clearWalletError();

//   //     try {
//   //       if (isNew) {
//   //         // Добавляем новый кошелек
//   //         const result = await addWallet(newAddress, "btc");
//   //         if (result.success) {
//   //           // Обновляем ID и убираем флаг нового
//   //           field.setAttribute("data-wallet-id", result.wallet.id);
//   //           field.setAttribute("data-wallet-address", result.wallet.address);
//   //           field.removeAttribute("data-wallet-new");
//   //           walletInput.value = result.wallet.address;
//   //           cancelEditing();
//   //           showToast("Кошелек успешно добавлен");
//   //           return true;
//   //         }
//   //       } else {
//   //         // Обновляем существующий кошелек
//   //         // Если адрес пустой, удаляем кошелек
//   //         if (!newAddress) {
//   //           await deleteWallet(walletId);
//   //           field.remove();
//   //           showToast("Кошелек удален");
//   //           return true;
//   //         }
//   //         // Сначала удаляем старый
//   //         await deleteWallet(walletId);
//   //         // Затем добавляем новый
//   //         const result = await addWallet(newAddress, "btc");
//   //         if (result.success) {
//   //           field.setAttribute("data-wallet-id", result.wallet.id);
//   //           field.setAttribute("data-wallet-address", result.wallet.address);
//   //           walletInput.value = result.wallet.address;
//   //           cancelEditing();
//   //           showToast("Кошелек успешно обновлен");
//   //           return true;
//   //         }
//   //       }
//   //     } catch (error) {
//   //       showWalletError(error.message || "Ошибка при сохранении кошелька");
//   //       return false;
//   //     } finally {
//   //       field.classList.remove("is-loading");
//   //     }
//   //   };

//   //   const cancelEditing = () => {
//   //     const oldAddress = field.getAttribute("data-wallet-address") || "";
//   //     const isNew = field.hasAttribute("data-wallet-new");

//   //     // Если это новый кошелек и он пустой, удаляем его
//   //     if (isNew && !walletInput.value.trim()) {
//   //       field.remove();
//   //       return;
//   //     }

//   //     walletInput.value = oldAddress;
//   //     walletInput.setAttribute("disabled", "disabled");
//   //     field.classList.remove("is-editing");
//   //     editBtn.setAttribute("data-state", "view");
//   //     editBtn.setAttribute("aria-label", "Редактировать адрес");
//   //     clearWalletError();
//   //   };

//   //   const startEditing = () => {
//   //     field.classList.add("is-editing");
//   //     walletInput.removeAttribute("disabled");
//   //     walletInput.focus();
//   //     walletInput.setSelectionRange(
//   //       walletInput.value.length,
//   //       walletInput.value.length
//   //     );
//   //     editBtn.setAttribute("data-state", "edit");
//   //     editBtn.setAttribute("aria-label", "Сохранить адрес");
//   //     clearWalletError();
//   //   };

//   //   editBtn.addEventListener("click", async (event) => {
//   //     event.preventDefault();
//   //     const state = editBtn.getAttribute("data-state");
//   //     if (state === "edit") {
//   //       // Сохраняем
//   //       await saveWallet();
//   //     } else {
//   //       // Начинаем редактирование
//   //       startEditing();
//   //     }
//   //   });

//   //   copyBtn.addEventListener("click", async (event) => {
//   //     event.preventDefault();
//   //     const value = walletInput.value.trim();
//   //     if (!value) return;
//   //     try {
//   //       await navigator.clipboard.writeText(value);
//   //       showToast("Адрес скопирован");
//   //     } catch (error) {
//   //       console.error("Clipboard error", error);
//   //     }
//   //   });

//   //   walletInput.addEventListener("input", () => {
//   //     if (field.classList.contains("has-error")) {
//   //       clearWalletError();
//   //     }
//   //   });

//   //   walletInput.addEventListener("keydown", async (event) => {
//   //     if (event.key === "Enter") {
//   //       event.preventDefault();
//   //       await saveWallet();
//   //     } else if (event.key === "Escape") {
//   //       event.preventDefault();
//   //       cancelEditing();
//   //     }
//   //   });

//   //   walletInput.addEventListener("blur", async () => {
//   //     const state = editBtn.getAttribute("data-state");
//   //     if (state === "edit") {
//   //       // Небольшая задержка, чтобы сработал click на кнопке сохранения
//   //       setTimeout(async () => {
//   //         if (editBtn.getAttribute("data-state") === "edit") {
//   //           await saveWallet();
//   //         }
//   //       }, 200);
//   //     }
//   //   });

//   //   // Добавляем в контейнер
//   //   if (
//   //     walletBtn &&
//   //     walletBtn.parentElement &&
//   //     walletBtn.parentElement === walletContainer
//   //   ) {
//   //     walletContainer.insertBefore(field, walletBtn);
//   //   } else if (walletBtn && walletBtn.parentElement) {
//   //     walletBtn.parentElement.insertBefore(field, walletBtn);
//   //   } else {
//   //     walletContainer.appendChild(field);
//   //   }

//   //   if (isNew) {
//   //     startEditing();
//   //   }
//   //   initFieldState(field);
//   //   return field;
//   // };

//   // // Загрузка и отображение кошельков из API
//   // const loadWallets = async () => {
//   //   if (!walletContainer) return;

//   //   try {
//   //     const wallets = await getWallets();

//   //     // Очищаем контейнер (кроме кнопки добавления)
//   //     const existingItems = walletContainer.querySelectorAll(
//   //       ".settings__wallet-item"
//   //     );
//   //     existingItems.forEach((item) => item.remove());

//   //     // Создаем элементы для каждого кошелька
//   //     if (wallets && Array.isArray(wallets)) {
//   //       wallets.forEach((wallet) => {
//   //         createWalletFieldFromData(wallet);
//   //       });
//   //     }
//   //   } catch (error) {
//   //     console.error("Не удалось загрузить кошельки:", error);
//   //     // Не показываем ошибку пользователю, просто логируем
//   //   }
//   // };

//   // // Создание нового кошелька (для кнопки "Добавить")
//   // const createWalletField = () => {
//   //   createWalletFieldFromData(null);
//   // };

//   toggleInputs(false);
//   initPhoneMask();
//   editBtn?.addEventListener("click", handleEditClick);

//   // validateFormsWP(
//   //   PROFILE_FORM_SELECTOR,
//   //   profileRules,
//   //   [],
//   //   handleProfileSaved,
//   //   "update_profile",
//   //   {
//   //     resetOnSuccess: false,
//   //     clearFilled: false,
//   //   }
//   // );

//   form.addEventListener("submit", () => {
//     toggleInputs(false);
//   });

//   // // Загружаем кошельки при инициализации
//   // if (walletContainer) {
//   //   loadWallets();
//   // }

//   // walletBtn?.addEventListener("click", (event) => {
//   //   event.preventDefault();
//   //   createWalletField();
//   // });
// };

// document.addEventListener("DOMContentLoaded", () => {
//   console.log("loaded");
//   initProfileSettings();
// });
