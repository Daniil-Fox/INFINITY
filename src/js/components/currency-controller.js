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

  const updateCourseView = () => {
    const out = formEl.querySelector(".course__value");
    if (!out || state.btcUsd == null || !state.usdRates) return;
    const value = convertFromUsd(state.btcUsd, state.currency, state.usdRates);
    out.textContent = formatCurrency(value, state.currency);
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
  };
}

export default { initCurrencyController };
