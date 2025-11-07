// Калькулятор доходности и интеграция с OurPool API
// ВАЖНО: Токен и account читаем из DOM-атрибутов формы или из конфигурации

import {
  initRangeControl,
  setupCurrencySuffix,
  updateFilledState,
} from "./loan";
import { initCurrencyController } from "./currency-controller";
import { convertFromUsd, formatCurrency } from "./currency-utils";

window.INFINITY_ENV = {
  OURPOOL_ACCOUNT: "your-account",
  OURPOOL_TOKEN: "a09be072-d684-4f73-afa1-39f745d98f0c",
};
// Конфиг по умолчанию: можно переопределить через data-атрибуты
export const defaultConfig = {
  ourPool: {
    baseUrl: "https://ourpool.io",
    account: "", // data-account на .calculator__form или передать через init
    token: "", // data-token на .calculator__form или передать через init
  },
  pricing: {
    // Стоимость за 1 TH по диапазонам мощности (из ТЗ/CSV)
    // Пожалуйста, передайте актуальные значения в init(options)
    tiers: [
      { min: 1, max: 188, pricePerTh: 27 },
      { min: 189, max: 563, pricePerTh: 26 },
      { min: 564, max: 1127, pricePerTh: 25 },
      { min: 1128, max: 1879, pricePerTh: 24 },
      { min: 1880, max: 2820, pricePerTh: 23 },
    ],
  },
  electricity: {
    // Стоимость электроэнергии, $ за kWh
    pricePerKwh: 0.06,
    // Потребление устройства (Вт). Если есть на 1 TH — передайте deviceWattPerTh и мы пересчитаем.
    deviceWatt: 3550,
    deviceTh: 188, // мощность устройства в TH для deviceWatt
  },
  yield: {
    // Базовая доходность BTC на 1 TH в день (из ТЗ/CSV). Просим подтвердить.
    btcPerThPerDay: 0.0000004,
    // Uptime в процентах (0..100)
    uptimePercent: 93.09,
  },
};

export function initCalculator(formEl, options = {}) {
  if (!formEl) return;

  const config = mergeConfigFromDom(defaultConfig, formEl, options);
  const remoteConfigUrl = formEl.getAttribute("data-config-url");

  // Биндим контролы (ползунок + input) по существующей разметке
  bindControl(formEl, "#loanAmountInput", "#loanAmountSlider");
  bindControl(formEl, "#loanPowerInput", "#loanPowerSlider");
  bindControl(formEl, "#loanCourseInput", "#loanCourseSlider");

  setupCurrencySuffix(formEl);

  // Валюты и курс BTC
  const currencyCtl = initCurrencyController(formEl);

  // Инициализация итогового блока (если есть)
  const summary = query(formEl, ".calculator__summary");
  const powerInput = query(formEl, "#loanPowerInput");
  const priceInput = query(formEl, "#loanAmountInput");
  const courseInput = query(formEl, "#loanCourseInput");

  const render = async () => {
    const powerTh = toNumber(powerInput?.value);
    // Базово расчет в USD. Если знаем текущий курс BTC в USD — используем его,
    // иначе — берем то, что ввёл пользователь в поле курса.
    const ctlState = currencyCtl?.getState?.() || {};
    const btcUsd = Number.isFinite(ctlState.btcUsd)
      ? ctlState.btcUsd
      : toNumber(courseInput?.value);
    const btcPrice = btcUsd;

    const tierPrice = resolveTierPrice(powerTh, config.pricing.tiers);
    const packageCost = powerTh * tierPrice;

    if (priceInput) {
      priceInput.value = String(Math.round(packageCost));
      priceInput.setAttribute("value", priceInput.value);
      updateFilledState(priceInput);
    }

    const metrics = computeProfitability({
      powerTh,
      btcPrice,
      config,
    });

    if (summary) {
      updateSummary(summary, metrics, {
        currency: ctlState.currency || "dollar",
        rates: ctlState.usdRates || { USD: 1 },
        packageCostUsd: packageCost,
      });
    }
  };

  // Подписки на изменения
  [powerInput, priceInput, courseInput].forEach((el) => {
    el?.addEventListener("input", render);
    el?.addEventListener("change", render);
  });

  // При старте: подгружаем удалённую конфигурацию, если указана
  if (remoteConfigUrl) {
    loadRemoteConfig(remoteConfigUrl)
      .then((remote) => {
        if (remote && typeof remote === "object") {
          deepMerge(config, remote);
        }
      })
      .catch(() => {})
      .finally(() => {
        render();
      });
  } else {
    render();
  }

  return { render, config };
}

// --- API OurPool (заготовки) ---

export async function fetchRewardsStats({ baseUrl, account, token }) {
  if (!account || !token) return null;
  const url = `${baseUrl}/api/v1/accounts/${encodeURIComponent(
    account
  )}/btc/rewards-stats?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

// --- Расчёты ---

export function computeProfitability({ powerTh, btcPrice, config }) {
  const { btcPerThPerDay, uptimePercent } = config.yield;

  const uptime = Math.max(0, Math.min(100, uptimePercent)) / 100;
  const dailyBtc = btcPerThPerDay * powerTh * uptime;

  const periods = {
    day: 1,
    week: 7,
    month: 30.5,
    year: 365,
  };

  const deviceWattPerTh =
    config.electricity.deviceWatt / config.electricity.deviceTh;
  const totalWatt = deviceWattPerTh * powerTh;
  const kwhPerDay = (totalWatt / 1000) * 24;
  const electricityPerDay = kwhPerDay * config.electricity.pricePerKwh * uptime;

  const toUsd = (btc) => btc * btcPrice;

  const result = {};
  Object.entries(periods).forEach(([key, days]) => {
    const btcGross = dailyBtc * days;
    const usdGross = toUsd(btcGross);
    const usdElectricity = electricityPerDay * days;
    const btcNet = Math.max(0, btcGross - usdElectricity / btcPrice);
    const usdNet = Math.max(0, usdGross - usdElectricity);

    result[key] = {
      btc: round(btcGross, 11),
      usd: round(usdGross, 2),
      electricityUsd: round(usdElectricity, 2),
      accrualBtc: round(btcNet, 11),
      accrualUsd: round(usdNet, 2),
    };
  });

  return result;
}

export function resolveTierPrice(powerTh, tiers) {
  for (const t of tiers) {
    if (powerTh >= t.min && powerTh <= t.max) return t.pricePerTh;
  }
  // Выше верхнего диапазона — нужен менеджер
  return tiers[tiers.length - 1]?.pricePerTh ?? 0;
}

// --- UI helpers ---

function bindControl(formEl, inputSel, sliderSel) {
  const input = query(formEl, inputSel);
  const slider = query(formEl, sliderSel);
  if (!input || !slider) return;
  initRangeControl({ input, slider });
}

function updateSummary(root, metrics, viewCtx) {
  const profitEl = root.querySelector(".calculator__summary-profit");
  const costEl = root.querySelector(".calculator__summary-cost");

  if (profitEl && metrics?.day?.btc != null) {
    profitEl.textContent = `${metrics.day.btc} BTC`;
  }

  if (costEl && viewCtx) {
    const { currency, rates, packageCostUsd } = viewCtx;
    const amount = convertFromUsd(packageCostUsd, currency, rates);
    costEl.textContent = formatCurrency(amount, currency);
  }
}

// --- Utils ---

function mergeConfigFromDom(base, formEl, overrides) {
  const cfg = JSON.parse(JSON.stringify(base));
  // 1) Переменные окружения (глобалка)
  const env = (typeof window !== "undefined" && window.INFINITY_ENV) || {};
  if (env.OURPOOL_TOKEN) cfg.ourPool.token = env.OURPOOL_TOKEN;
  if (env.OURPOOL_ACCOUNT) cfg.ourPool.account = env.OURPOOL_ACCOUNT;

  // 2) Meta-теги в <head>
  const metaToken = document
    .querySelector('meta[name="ourpool-token"]')
    ?.getAttribute("content");
  const metaAccount = document
    .querySelector('meta[name="ourpool-account"]')
    ?.getAttribute("content");
  if (metaToken) cfg.ourPool.token = metaToken;
  if (metaAccount) cfg.ourPool.account = metaAccount;

  // 3) data-атрибуты формы (dev fallback)
  const token = formEl.getAttribute("data-token");
  const account = formEl.getAttribute("data-account");
  if (token) cfg.ourPool.token = token;
  if (account) cfg.ourPool.account = account;
  return deepMerge(cfg, overrides || {});
}

function deepMerge(target, source) {
  if (!source) return target;
  Object.keys(source).forEach((key) => {
    const s = source[key];
    if (s && typeof s === "object" && !Array.isArray(s)) {
      target[key] = deepMerge(target[key] || {}, s);
    } else {
      target[key] = s;
    }
  });
  return target;
}

function query(root, sel) {
  return root?.querySelector(sel) || null;
}

function toNumber(v) {
  const n = Number(String(v || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function round(n, digits = 2) {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

async function loadRemoteConfig(url) {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (_e) {
    return null;
  }
}

export default {
  initCalculator,
  computeProfitability,
  resolveTierPrice,
  fetchRewardsStats,
};
