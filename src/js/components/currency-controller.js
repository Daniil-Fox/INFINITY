// Контроллер валют: загрузка курсов, переключение валюты, обновление UI

import { fetchBtcUsdPrice, fetchUsdRates } from "./rates-api.js";
import {
  getSelectedCurrency,
  convertFromUsd,
  formatCurrency,
} from "./currency-utils.js";

const FALLBACK_USD_RATES = { EUR: 0.92, RUB: 92, USD: 1 };
const FALLBACK_BTC_USD = 109500;

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
      const [btcResult, usdResult] = await Promise.allSettled([
        fetchBtcUsdPrice(options),
        fetchUsdRates(options),
      ]);

      let didUpdate = false;

      if (btcResult.status === "fulfilled") {
        const price = Number(btcResult.value);
        if (Number.isFinite(price) && price > 0) {
          state.btcUsd = price;
          didUpdate = true;
        }
      } else if (!state.btcUsd) {
        state.btcUsd = FALLBACK_BTC_USD;
        didUpdate = true;
      }

      if (usdResult.status === "fulfilled" && usdResult.value) {
        state.usdRates = usdResult.value;
        didUpdate = true;
      } else if (!state.usdRates) {
        state.usdRates = FALLBACK_USD_RATES;
        didUpdate = true;
      }

      if (didUpdate) {
        updateCourseView();
        notify();
      }
    } catch (_e) {
      let didUpdate = false;
      if (!state.btcUsd) {
        state.btcUsd = FALLBACK_BTC_USD;
        didUpdate = true;
      }
      if (!state.usdRates) {
        state.usdRates = FALLBACK_USD_RATES;
        didUpdate = true;
      }
      if (didUpdate) {
        updateCourseView();
        notify();
      }
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
