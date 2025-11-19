/**
 * Пример использования REST API для управления кошельками
 *
 * Endpoints:
 * - GET /wp-json/infinity/v1/wallets - получить список кошельков
 * - POST /wp-json/infinity/v1/wallets - добавить кошелек
 * - DELETE /wp-json/infinity/v1/wallets/{wallet_id} - удалить кошелек
 */

// Базовый URL для REST API
const API_BASE = "/wp-json/infinity/v1";

/**
 * Получить список кошельков текущего пользователя
 */
async function getWallets() {
  try {
    const response = await fetch(`${API_BASE}/wallets`, {
      method: "GET",
      credentials: "same-origin", // Важно для передачи cookies авторизации
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Необходима авторизация");
      }
      throw new Error(`Ошибка: ${response.status}`);
    }

    const wallets = await response.json();
    return wallets;
  } catch (error) {
    console.error("Ошибка при получении кошельков:", error);
    throw error;
  }
}

/**
 * Добавить новый кошелек
 * @param {string} address - Адрес кошелька
 * @param {string} type - Тип кошелька (по умолчанию 'btc')
 */
async function addWallet(address, type = "btc") {
  try {
    const response = await fetch(`${API_BASE}/wallets`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: address.trim(),
        type: type,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Ошибка: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Ошибка при добавлении кошелька:", error);
    throw error;
  }
}

/**
 * Удалить кошелек
 * @param {string} walletId - ID кошелька
 */
async function deleteWallet(walletId) {
  try {
    const response = await fetch(`${API_BASE}/wallets/${walletId}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Ошибка: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Ошибка при удалении кошелька:", error);
    throw error;
  }
}

/**
 * Пример использования в обработчиках событий
 */
document.addEventListener("DOMContentLoaded", function () {
  const walletsContainer = document.querySelector("[data-wallets]");
  const addButton = document.querySelector("[data-wallet-add]");

  if (!walletsContainer) return;

  const spriteUrl =
    walletsContainer.dataset.spriteUrl ||
    "/wp-content/themes/infinity/assets/img/sprite.svg";

  let walletCounter = walletsContainer.querySelectorAll(
    ".settings__wallet-item"
  ).length;

  // Загрузка кошельков при загрузке страницы
  loadWallets();

  // Обработчик кнопки "Добавить кошелек"
  if (addButton) {
    addButton.addEventListener("click", function () {
      addNewWalletItem();
    });
  }

  // Делегирование событий для контейнера кошельков
  walletsContainer.addEventListener("click", function (e) {
    // Кнопка редактирования
    const editButton = e.target.closest("[data-wallet-edit]");
    if (editButton) {
      handleEditWallet(editButton);
      return;
    }

    // Кнопка копирования
    const copyButton = e.target.closest("[data-wallet-copy]");
    if (copyButton) {
      handleCopyWallet(copyButton);
      return;
    }
  });

  // Обработка изменений в полях ввода
  walletsContainer.addEventListener("input", function (e) {
    const input = e.target.closest("[data-wallet-input]");
    if (input) {
      validateWalletInput(input);
    }
  });

  // Обработка blur для сохранения изменений
  walletsContainer.addEventListener(
    "blur",
    function (e) {
      const input = e.target.closest("[data-wallet-input]");
      if (input && input.hasAttribute("data-wallet-save")) {
        handleSaveWallet(input);
      }
    },
    true
  );

  // Обработка Enter для сохранения
  walletsContainer.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Enter") {
        const input = e.target.closest("[data-wallet-input]");
        if (input && !input.readOnly) {
          e.preventDefault();
          handleSaveWallet(input);
        }
      }
      if (e.key === "Escape") {
        const input = e.target.closest("[data-wallet-input]");
        if (input && !input.readOnly) {
          cancelEditWallet(input);
        }
      }
    },
    true
  );

  /**
   * Добавить новый элемент кошелька
   */
  function addNewWalletItem() {
    walletCounter++;
    const walletId = `new-${Date.now()}`;
    const inputId = `wallet-token-${walletCounter}`;

    const walletItem = document.createElement("div");
    walletItem.className = "form__field settings__wallet-item is-editing";
    walletItem.setAttribute("data-wallet-id", walletId);
    walletItem.setAttribute("data-wallet-new", "true");

    walletItem.innerHTML = `
      <div class="settings__wallet-row">
        <div class="form__field-wrapper">
          <input 
            type="text" 
            class="form__input settings__wallet-input" 
            id="${inputId}"
            data-wallet-input
            data-wallet-save
            placeholder="Введите адрес кошелька"
          />
          <label class="form__label" for="${inputId}">
            Новый кошелек
          </label>
          <button type="button" class="btn-reset settings__wallet-copy" aria-label="Скопировать адрес" data-wallet-copy>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M7 17.5H6.3C4.74833 17.5 3.5 16.2517 3.5 14.7V6.3C3.5 4.74833 4.74833 3.5 6.3 3.5H14.7C16.2517 3.5 17.5 4.74833 17.5 6.3V7M13.3 10.5H21.7C22.4426 10.5 23.1548 10.795 23.6799 11.3201C24.205 11.8452 24.5 12.5574 24.5 13.3V21.7C24.5 22.4426 24.205 23.1548 23.6799 23.6799C23.1548 24.205 22.4426 24.5 21.7 24.5H13.3C12.5574 24.5 11.8452 24.205 11.3201 23.6799C10.795 23.1548 10.5 22.4426 10.5 21.7V13.3C10.5 12.9323 10.5724 12.5682 10.7131 12.2285C10.8538 11.8888 11.0601 11.5801 11.3201 11.3201C11.5801 11.0601 11.8888 10.8538 12.2285 10.7131C12.5682 10.5724 12.9323 10.5 13.3 10.5Z" stroke="black" stroke-opacity="0.45" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
        <button type="button" class="btn-reset settings__wallet-edit" aria-label="Редактировать адрес" data-state="edit" data-wallet-edit>
          <svg width="24" height="24">
            <use xlink:href="${spriteUrl}#pen"></use>
          </svg>
        </button>
      </div>
      <div class="settings__wallet-error" aria-live="polite" data-wallet-error style="display: none;"></div>
    `;

    walletsContainer.appendChild(walletItem);
    const input = walletItem.querySelector("[data-wallet-input]");
    if (input) {
      input.focus();
    }
  }

  /**
   * Обработка редактирования кошелька
   */
  function handleEditWallet(editButton) {
    const walletItem = editButton.closest(".settings__wallet-item");
    if (!walletItem) return;

    const input = walletItem.querySelector("[data-wallet-input]");
    const state = editButton.getAttribute("data-state");

    if (state === "edit") {
      // Включаем режим редактирования
      input.removeAttribute("readonly");
      input.focus();
      walletItem.classList.add("is-editing");
      editButton.setAttribute("data-state", "save");
      editButton.setAttribute("aria-label", "Сохранить адрес");
      input.setAttribute("data-wallet-save", "true");
    } else if (state === "save") {
      // Сохраняем изменения
      handleSaveWallet(input);
    }
  }

  /**
   * Сохранение изменений кошелька
   */
  async function handleSaveWallet(input) {
    const walletItem = input.closest(".settings__wallet-item");
    if (!walletItem) return;

    const walletId = walletItem.getAttribute("data-wallet-id");
    const isNew = walletItem.hasAttribute("data-wallet-new");
    const newAddress = input.value.trim();
    const oldAddress = walletItem.getAttribute("data-wallet-address") || "";

    // Валидация (для новых кошельков и непустых адресов)
    if (isNew || newAddress) {
      if (!validateWalletInput(input)) {
        return;
      }
    }

    // Если адрес не изменился, просто выходим из режима редактирования
    if (!isNew && newAddress === oldAddress) {
      cancelEditWallet(input);
      return;
    }

    // Показываем состояние загрузки
    walletItem.classList.add("is-loading");
    hideError(walletItem);

    try {
      if (isNew) {
        // Добавляем новый кошелек
        const result = await addWallet(newAddress, "btc");
        if (result.success) {
          // Обновляем ID и убираем флаг нового
          walletItem.setAttribute("data-wallet-id", result.wallet.id);
          walletItem.setAttribute("data-wallet-address", result.wallet.address);
          walletItem.removeAttribute("data-wallet-new");
          input.value = result.wallet.address;
          cancelEditWallet(input);
          // Перезагружаем список для синхронизации
          loadWallets();
        }
      } else {
        // Обновляем существующий кошелек
        // Если адрес пустой, удаляем кошелек
        if (!newAddress) {
          await deleteWallet(walletId);
          walletItem.remove();
          return;
        }
        // Сначала удаляем старый
        await deleteWallet(walletId);
        // Затем добавляем новый
        const result = await addWallet(newAddress, "btc");
        if (result.success) {
          walletItem.setAttribute("data-wallet-id", result.wallet.id);
          walletItem.setAttribute("data-wallet-address", result.wallet.address);
          input.value = result.wallet.address;
          cancelEditWallet(input);
          loadWallets();
        }
      }
    } catch (error) {
      showError(walletItem, error.message || "Ошибка при сохранении кошелька");
    } finally {
      walletItem.classList.remove("is-loading");
    }
  }

  /**
   * Отмена редактирования
   */
  function cancelEditWallet(input) {
    const walletItem = input.closest(".settings__wallet-item");
    if (!walletItem) return;

    const editButton = walletItem.querySelector("[data-wallet-edit]");
    const oldAddress = walletItem.getAttribute("data-wallet-address") || "";

    // Если это новый кошелек и он пустой, удаляем его
    if (walletItem.hasAttribute("data-wallet-new") && !input.value.trim()) {
      walletItem.remove();
      return;
    }

    input.value = oldAddress;
    input.setAttribute("readonly", "readonly");
    input.removeAttribute("data-wallet-save");
    walletItem.classList.remove("is-editing", "has-error");
    if (editButton) {
      editButton.setAttribute("data-state", "edit");
      editButton.setAttribute("aria-label", "Редактировать адрес");
    }
    hideError(walletItem);
  }

  /**
   * Копирование адреса кошелька
   */
  async function handleCopyWallet(copyButton) {
    const walletItem = copyButton.closest(".settings__wallet-item");
    if (!walletItem) return;

    const input = walletItem.querySelector("[data-wallet-input]");
    if (!input) return;

    const address = input.value.trim();
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      // Можно показать уведомление об успешном копировании
      console.log("Адрес скопирован:", address);
    } catch (error) {
      // Fallback для старых браузеров
      input.select();
      document.execCommand("copy");
    }
  }

  /**
   * Валидация адреса кошелька
   */
  function validateWalletInput(input) {
    const walletItem = input.closest(".settings__wallet-item");
    if (!walletItem) return false;

    const address = input.value.trim();

    if (!address) {
      showError(walletItem, "Введите токен кошелька");
      return false;
    }

    // Базовая валидация (можно расширить)
    if (address.length < 10) {
      showError(walletItem, "Адрес кошелька слишком короткий");
      return false;
    }

    hideError(walletItem);
    return true;
  }

  /**
   * Показать ошибку
   */
  function showError(walletItem, message) {
    const errorElement = walletItem.querySelector("[data-wallet-error]");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
      walletItem.classList.add("has-error");
    }
  }

  /**
   * Скрыть ошибку
   */
  function hideError(walletItem) {
    const errorElement = walletItem.querySelector("[data-wallet-error]");
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
      walletItem.classList.remove("has-error");
    }
  }

  /**
   * Загрузка и отображение кошельков
   */
  async function loadWallets() {
    try {
      const wallets = await getWallets();
      // Синхронизируем атрибуты data-wallet-address с серверными данными
      wallets.forEach((wallet) => {
        const walletItem = walletsContainer.querySelector(
          `[data-wallet-id="${wallet.id}"]`
        );
        if (walletItem) {
          walletItem.setAttribute("data-wallet-address", wallet.address);
          const input = walletItem.querySelector("[data-wallet-input]");
          if (input && input.readOnly) {
            input.value = wallet.address;
          }
        }
      });
    } catch (error) {
      console.error("Не удалось загрузить кошельки:", error);
    }
  }
});
