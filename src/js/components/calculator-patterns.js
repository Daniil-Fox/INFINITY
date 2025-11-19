import { computeProfitability, resolveTierPrice } from "./calculator-engine.js";
import { convertFromUsd, formatCurrency } from "./currency-utils.js";

const CURRENCY_SYMBOLS = {
  dollar: "$",
  euro: "€",
  ruble: "₽",
};

function formatPower(powerTh) {
  const formatted = Number(powerTh).toLocaleString("ru-RU");
  return `${formatted} TH`;
}

function formatProfitBtc(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Number(value).toFixed(9)} BTC`;
}

function formatFiat(amountUsd, currencyState) {
  const currency = currencyState?.currency || "dollar";
  const rates = currencyState?.usdRates || { USD: 1 };
  const converted = convertFromUsd(amountUsd, currency, rates);
  if (!Number.isFinite(converted)) return "-";
  const symbol = CURRENCY_SYMBOLS[currency] || "$";
  const formatted = converted.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${symbol}`;
}

function formatPricePerTh(pricePerThUsd, currencyState) {
  const currency = currencyState?.currency || "dollar";
  const rates = currencyState?.usdRates || { USD: 1 };
  const converted = convertFromUsd(pricePerThUsd, currency, rates);
  if (!Number.isFinite(converted)) return "-";

  // Для компактного отображения убираем валютный символ в начале
  const symbol = CURRENCY_SYMBOLS[currency] || "$";
  const formatted = converted.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${symbol}`;
}

function formatAnnualPercent(packageCostUsd, metrics) {
  if (
    !metrics?.year ||
    !Number.isFinite(packageCostUsd) ||
    packageCostUsd <= 0
  ) {
    return "-";
  }
  const net = metrics.year.accrualUsd;
  if (!Number.isFinite(net)) return "-";
  const percent = (net / packageCostUsd) * 100;
  if (!Number.isFinite(percent)) return "-";
  return `${Math.round(percent)}%`;
}

function updatePatternCard(patternEl, calculatorContext) {
  const powerTh = Number(patternEl.dataset.power);
  if (!Number.isFinite(powerTh) || powerTh <= 0) {
    return;
  }

  const { config, currencyState, powerTh: currentPowerTh } = calculatorContext;

  const isActive =
    Number.isFinite(currentPowerTh) &&
    Math.round(currentPowerTh) === Math.round(powerTh);
  patternEl.classList.toggle("pattern--active", isActive);
  if (!config) return;

  // Для карточек всегда используем рыночный курс BTC из API,
  // игнорируя пользовательские изменения курса в калькуляторе.
  const marketBtcPrice =
    Number(currencyState?.btcUsd) && currencyState.btcUsd > 0
      ? Number(currencyState.btcUsd)
      : 109500;

  const tierPrice = resolveTierPrice(powerTh, config.pricing.tiers);
  if (tierPrice === null) {
    return;
  }

  const packageCostUsd = Math.round(powerTh * tierPrice);
  const metrics = computeProfitability({
    powerTh,
    btcPrice: marketBtcPrice,
    config,
  });

  const profitEl = patternEl.querySelector('[data-field="profit"]');
  const powerEl = patternEl.querySelector('[data-field="power"]');
  const costEl = patternEl.querySelector('[data-field="cost"]');
  const priceEl = patternEl.querySelector('[data-field="price"]');
  const annualEl = patternEl.querySelector('[data-field="annual"]');

  if (profitEl) {
    const profitBtc =
      metrics?.day?.accrualBtc ?? metrics?.day?.btc ?? Number.NaN;
    profitEl.textContent = formatProfitBtc(profitBtc);
  }

  if (powerEl) {
    powerEl.textContent = formatPower(powerTh);
  }

  if (costEl) {
    costEl.textContent = formatFiat(packageCostUsd, currencyState);
  }

  if (priceEl) {
    priceEl.textContent = formatPricePerTh(tierPrice, currencyState);
  }

  if (annualEl) {
    annualEl.textContent = formatAnnualPercent(packageCostUsd, metrics);
  }
}

export function initCalculatorPatterns(rootEl, calculatorApi) {
  if (!calculatorApi) return null;

  const calculatorRoot =
    rootEl?.closest?.(".calculator") || document.querySelector(".calculator");
  if (!calculatorRoot) return null;

  const patternEls = Array.from(
    calculatorRoot.querySelectorAll(".calculator__pattern[data-power]")
  );
  if (!patternEls.length) return null;

  const refresh = () => {
    const context = calculatorApi.getContext?.();
    if (!context) return;
    patternEls.forEach((pattern) => updatePatternCard(pattern, context));
  };

  patternEls.forEach((pattern) => {
    pattern.addEventListener("click", (event) => {
      event.preventDefault();
      const powerTh = Number(pattern.dataset.power);
      if (Number.isFinite(powerTh) && powerTh > 0) {
        calculatorApi.setPowerTh?.(powerTh, { focus: true });
      }
    });
  });

  refresh();

  const unsubscribe =
    calculatorApi.onAfterRender?.(() => {
      refresh();
    }) || (() => {});

  return {
    refresh,
    destroy() {
      unsubscribe();
    },
  };
}

export default {
  initCalculatorPatterns,
};
