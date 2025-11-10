// Контроллер валют: загрузка курсов, переключение валюты, обновление UI

import { fetchBtcUsdPrice, fetchUsdRates } from "./rates-api.js";
import {
  getSelectedCurrency,
  convertFromUsd,
  formatCurrency,
} from "./currency-utils.js";

export function initCurrencyController(formEl, options = {}) {
  if (!formEl) return null;

  let state = {
    currency: getSelectedCurrency(formEl),
    btcUsd: null,
    usdRates: null,
  };

  const listeners = new Set();
  const notify = () => listeners.forEach((cb) => cb({ ...state }));

  const updateCourseView = (btcUsdValue = null) => {
    const out = formEl.querySelector(".course__value");
    if (!out) return;

    // Используем переданное значение или значение из state
    const btcUsd = btcUsdValue !== null ? btcUsdValue : state.btcUsd;

    if (btcUsd == null || btcUsd <= 0) return;

    // Показываем обратное значение: 1 доллар = X биткоина
    // btcUsd - это стоимость 1 BTC в USD
    // 1 USD = 1/btcUsd BTC
    const btcPerUsd = 1 / btcUsd;

    // Форматируем с точностью до 9 знаков после запятой
    out.textContent = btcPerUsd.toFixed(9);
  };

  const load = async () => {
    try {
      const [btcUsd, usdRates] = await Promise.all([
        fetchBtcUsdPrice(options),
        fetchUsdRates(options),
      ]);
      state.btcUsd = btcUsd;
      state.usdRates = usdRates;
      updateCourseView();
      notify();
    } catch (_e) {
      // тихо игнорируем, UI останется как есть
    }
  };

  const onCurrencyChange = () => {
    state.currency = getSelectedCurrency(formEl);
    updateCourseView();
    notify();
  };

  Array.from(formEl.querySelectorAll('input[name="currency"]')).forEach((r) => {
    r.addEventListener("change", onCurrencyChange);
  });

  load();

  return {
    onChange(cb) {
      if (typeof cb === "function") listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getState() {
      return { ...state };
    },
    updateCourseView(btcUsdValue) {
      updateCourseView(btcUsdValue);
    },
  };
}

export default { initCurrencyController };
