// Калькулятор доходности и интеграция с OurPool API
// ВАЖНО: Токен и account читаем из DOM-атрибутов формы или из конфигурации

import {
  initRangeControl,
  setupCurrencySuffix,
  updateFilledState,
} from "./loan.js";
import { initCurrencyController } from "./currency-controller.js";
import { convertFromUsd, formatCurrency } from "./currency-utils.js";

window.INFINITY_ENV = {
  OURPOOL_ACCOUNT: "olegkarpun",
  OURPOOL_TOKEN: "a09be072-d684-4f73-afa1-39f745d98f0c",
};
// Конфиг по умолчанию: можно переопределить через data-атрибуты
export const defaultConfig = {
  ourPool: {
    baseUrl: "https://ourpool.io",
    account: "olegkarpun", // data-account на .calculator__form или передать через init
    token: "a09be072-d684-4f73-afa1-39f745d98f0c", // data-token на .calculator__form или передать через init
  },
  pricing: {
    // Стоимость за 1 TH по диапазонам мощности (из ТЗ/CSV)
    // Пожалуйста, передайте актуальные значения в init(options)
    tiers: [
      { min: 8, max: 188, pricePerTh: 27 },
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
  const ourPoolCfg = config.ourPool || {};

  // Биндим контролы (ползунок + input) по существующей разметке
  // Сумма будет инициализирована динамически на основе мощности
  bindControl(formEl, "#loanPowerInput", "#loanPowerSlider");
  // Слайдер курса будет инициализирован после загрузки курса из API
  // bindControl(formEl, "#loanCourseInput", "#loanCourseSlider");

  setupCurrencySuffix(formEl);

  // Валюты и курс BTC
  const currencyCtl = initCurrencyController(formEl);

  // Инициализация итогового блока (если есть)
  const summary = query(formEl, ".calculator__summary");
  const powerInput = query(formEl, "#loanPowerInput");
  const priceInput = query(formEl, "#loanAmountInput");
  const courseInput = query(formEl, "#loanCourseInput");
  const pricePerThEl = query(formEl, ".calculator__info span");
  const resetBtn = query(formEl, ".course__btn");
  const buyButton = query(formEl, ".calculator__btn");
  const powerSliderEl = query(formEl, "#loanPowerSlider");
  const periodTabs = Array.from(
    formEl.querySelectorAll('input[name="доходность"]')
  );

  // Флаг для отслеживания инициализации слайдера суммы (используем объект для передачи по ссылке)
  const amountSliderInitialized = { current: false };
  const afterRenderListeners = new Set();
  let lastRenderContext = {
    powerTh: toNumber(powerInput?.value),
    amountUsd: 0,
    btcPrice: 109500,
    currencyState: {
      currency: "dollar",
      usdRates: { USD: 1 },
      btcUsd: 109500,
    },
  };

  const getPublicContext = () => ({
    config,
    ...lastRenderContext,
  });

  const notifyAfterRender = () => {
    const context = getPublicContext();
    afterRenderListeners.forEach((cb) => {
      try {
        cb(context);
      } catch (error) {
        console.error("Calculator post-render listener failed", error);
      }
    });
  };

  // Обновление курса BTC в поле при загрузке из API и при изменении валюты
  if (currencyCtl) {
    let courseSliderInitialized = false;
    currencyCtl.onChange((state) => {
      // Обновляем курс при загрузке из API
      if (Number.isFinite(state.btcUsd) && courseInput && state.btcUsd > 0) {
        // Конвертируем в обратное значение: 1 доллар = X биткоина
        const btcPerUsd = 1 / state.btcUsd;
        const btcPerUsdFormatted = btcPerUsd.toFixed(9);

        courseInput.value = btcPerUsdFormatted;
        courseInput.setAttribute("value", courseInput.value);
        updateFilledState(courseInput);

        // Настраиваем диапазон слайдера курса (80%-120% от текущего курса)
        // Для обратного значения: если курс 109500, то обратное = 0.000009132
        // Диапазон 80%-120%: 0.000007306 - 0.000010958
        const courseSlider = query(formEl, "#loanCourseSlider");
        if (courseSlider && state.btcUsd > 0) {
          const minBtcPerUsd = (1 / (state.btcUsd * 1.2)).toFixed(9); // 120% курса = меньше BTC за доллар
          const maxBtcPerUsd = (1 / (state.btcUsd * 0.8)).toFixed(9); // 80% курса = больше BTC за доллар

          courseInput.setAttribute("min", minBtcPerUsd);
          courseInput.setAttribute("max", maxBtcPerUsd);
          courseInput.setAttribute("step", "0.000000001"); // Шаг 0.000000001 (9 знаков)

          if (!courseSliderInitialized) {
            // Убеждаемся, что значение установлено правильно перед инициализацией
            // Устанавливаем значение с точностью до 9 знаков
            courseInput.value = btcPerUsdFormatted;
            courseInput.setAttribute("value", btcPerUsdFormatted);

            // Инициализируем слайдер курса
            initRangeControl({ input: courseInput, slider: courseSlider });

            // После инициализации проверяем и восстанавливаем точное значение
            // (на случай если initRangeControl изменил его из-за округления)
            const currentValue = parseFloat(courseInput.value);
            const expectedValue = parseFloat(btcPerUsdFormatted);
            if (Math.abs(currentValue - expectedValue) > 0.0000000001) {
              courseInput.value = btcPerUsdFormatted;
              courseInput.setAttribute("value", btcPerUsdFormatted);
              updateFilledState(courseInput);
            }

            courseSliderInitialized = true;
          } else {
            // Обновляем диапазон существующего слайдера
            if (courseSlider.noUiSlider) {
              const minNum = parseFloat(minBtcPerUsd);
              const maxNum = parseFloat(maxBtcPerUsd);
              const currentNum = parseFloat(btcPerUsdFormatted);

              courseSlider.noUiSlider.updateOptions({
                range: {
                  min: minNum,
                  max: maxNum,
                },
                step: 0.000000001,
                format: {
                  to: function (value) {
                    // Сохраняем точность до 9 знаков с помощью Math.round
                    const multiplier = 1000000000; // 10^9
                    return Math.round(value * multiplier) / multiplier;
                  },
                  from: function (value) {
                    return parseFloat(value);
                  },
                },
              });

              // Устанавливаем значение с точностью до 9 знаков
              courseSlider.noUiSlider.set(currentNum);
            }
          }
        }
      }
      // Всегда обновляем калькулятор при изменении состояния (курс или валюта)
      render();
    });
  }

  // Кнопка "Сброс" курса
  if (resetBtn && currencyCtl) {
    resetBtn.addEventListener("click", async () => {
      const state = currencyCtl.getState();
      if (Number.isFinite(state.btcUsd) && state.btcUsd > 0) {
        // Конвертируем в обратное значение: 1 доллар = X биткоина
        const btcPerUsd = (1 / state.btcUsd).toFixed(9);
        const btcPerUsdNum = parseFloat(btcPerUsd);

        if (courseInput) {
          // Устанавливаем значение с точностью до 9 знаков
          courseInput.value = btcPerUsd;
          courseInput.setAttribute("value", btcPerUsd);
          updateFilledState(courseInput);
        }

        const courseSlider = query(formEl, "#loanCourseSlider");
        if (courseSlider?.noUiSlider) {
          courseSlider.noUiSlider.set(btcPerUsdNum);
        }

        // Обновляем отображение курса
        if (currencyCtl) {
          currencyCtl.updateCourseView?.(state.btcUsd);
        }

        render();
      }
    });
  }

  // Табы периодов: по умолчанию показываем "год", радиокнопки не активны
  let selectedPeriod = "year";
  // Сбрасываем любые предзаданные checked в разметке
  periodTabs.forEach((r) => {
    if (r.checked) r.checked = false;
    r.dataset.selected = "0";
  });
  periodTabs.forEach((tab, idx) => {
    const period = idx === 0 ? "day" : idx === 1 ? "week" : "month";
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const isCurrentlySelected = tab.dataset.selected === "1";
      if (isCurrentlySelected) {
        // Повторный клик по выбранному периоду — вернуться к "год"
        tab.checked = false;
        tab.dataset.selected = "0";
        selectedPeriod = "year";
        render();
        return;
      }
      // Выбор нового периода
      periodTabs.forEach((r) => {
        r.checked = false;
        r.dataset.selected = "0";
      });
      tab.checked = true;
      tab.dataset.selected = "1";
      selectedPeriod = period;
      render();
    });
  });

  // Флаг для предотвращения циклических обновлений
  let isUpdating = false;

  const render = async (source = "auto") => {
    if (isUpdating) return;
    isUpdating = true;

    const powerTh = toNumber(powerInput?.value);
    const ctlState = currencyCtl?.getState?.() || {};
    const currency = ctlState.currency || "dollar";
    const rates = ctlState.usdRates || { USD: 1 };
    // Читаем сумму из инпута и конвертируем в USD в зависимости от выбранной валюты
    const rawAmount = toNumber(priceInput?.value);
    const amountUsd = convertToUsd(rawAmount, currency, rates);

    // Получаем курс BTC: приоритет у значения из поля курса (если пользователь изменил),
    // иначе используем курс из API
    // Читаем значение напрямую из поля, чтобы сохранить точность для маленьких чисел
    const courseInputRaw = courseInput?.value?.trim() || "";
    const courseInputValue = courseInputRaw ? parseFloat(courseInputRaw) : 0;

    // Разделяем рыночный курс из API и "пользовательский" курс из инпута
    const apiBtcUsd =
      Number.isFinite(ctlState.btcUsd) && ctlState.btcUsd > 0
        ? ctlState.btcUsd
        : 109500;
    const userOverrideBtcUsd =
      Number.isFinite(courseInputValue) && courseInputValue > 0
        ? 1 / courseInputValue
        : null;
    // В расчетах калькулятора используем пользовательский курс, если он задан; иначе курс API
    const btcUsd = userOverrideBtcUsd ?? apiBtcUsd;

    const btcPrice = btcUsd > 0 ? btcUsd : 109500; // Fallback к примерному курсу если нет данных

    let finalPowerTh = powerTh;
    let finalAmountUsd = amountUsd;

    // Обновляем границы суммы на основе текущей мощности
    const hasValidTier = updateAmountBounds(
      formEl,
      finalPowerTh,
      config.pricing.tiers,
      amountSliderInitialized,
      null,
      { currency, rates }
    );

    // Обрабатываем диапазон 2821-3760 TH (нужен менеджер)
    if (finalPowerTh > 2820 && finalPowerTh <= 3760) {
      if (buyButton) {
        buyButton.textContent = "Связаться для индивидуальных условий";
        buyButton.classList.add("calculator__btn--contact");
      }
      // Продолжаем расчеты для показа доходности, но не показываем сумму
    } else {
      if (buyButton) {
        buyButton.textContent = "Купить";
        buyButton.classList.remove("calculator__btn--contact");
      }
    }

    // Если источник изменения - сумма, пересчитываем мощность
    if (source === "amount" && amountUsd > 0) {
      const calculatedPower = calculatePowerFromAmount(
        amountUsd,
        config.pricing.tiers
      );
      if (calculatedPower > 0) {
        finalPowerTh = calculatedPower;
        if (powerInput) {
          powerInput.value = String(Math.round(finalPowerTh));
          powerInput.setAttribute("value", powerInput.value);
          updateFilledState(powerInput);
          // Обновляем слайдер мощности
          if (powerSliderEl?.noUiSlider) {
            powerSliderEl.noUiSlider.set(finalPowerTh);
          }
        }
        // Обновляем границы суммы, так как мощность могла измениться (переход в другой тир)
        // Передаем текущую сумму как целевое значение
        updateAmountBounds(
          formEl,
          finalPowerTh,
          config.pricing.tiers,
          amountSliderInitialized,
          amountUsd,
          { currency, rates }
        );
        finalAmountUsd = amountUsd; // Используем исходную сумму
      }
    } else if (source === "power" && powerTh > 0 && hasValidTier) {
      // Если источник изменения - мощность, пересчитываем сумму
      const tierPrice = resolveTierPrice(powerTh, config.pricing.tiers);
      if (tierPrice !== null) {
        finalAmountUsd = Math.round(powerTh * tierPrice);
        // Обновляем границы и значение суммы
        updateAmountBounds(
          formEl,
          powerTh,
          config.pricing.tiers,
          amountSliderInitialized,
          finalAmountUsd,
          { currency, rates }
        );
      }
    } else {
      // Автоматический расчет: приоритет мощности
      if (powerTh > 0 && hasValidTier) {
        const tierPrice = resolveTierPrice(powerTh, config.pricing.tiers);
        if (tierPrice !== null) {
          finalAmountUsd = Math.round(powerTh * tierPrice);
          // Обновляем границы и значение суммы
          updateAmountBounds(
            formEl,
            powerTh,
            config.pricing.tiers,
            amountSliderInitialized,
            finalAmountUsd,
            { currency, rates }
          );
        }
      } else if (powerTh > 0) {
        // Если мощность есть, но нет валидного тира, просто обновляем границы (скроет поле)
        updateAmountBounds(
          formEl,
          powerTh,
          config.pricing.tiers,
          amountSliderInitialized,
          null,
          { currency, rates }
        );
      }
    }

    const tierPrice = resolveTierPrice(finalPowerTh, config.pricing.tiers);

    // Обновляем цену за 1 TH (только если есть валидный тир)
    if (pricePerThEl && tierPrice !== null) {
      const priceInCurrency = convertFromUsd(tierPrice, currency, rates);
      const locales = { ruble: "ru-RU", dollar: "en-US", euro: "de-DE" };
      const codes = { ruble: "RUB", dollar: "USD", euro: "EUR" };
      const formatted = new Intl.NumberFormat(locales[currency] || "en-US", {
        style: "currency",
        currency: codes[currency] || "USD",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(Number(priceInCurrency));
      pricePerThEl.textContent = formatted;
    } else if (pricePerThEl && finalPowerTh > 2820) {
      // Для диапазона 2821-3760 скрываем или показываем сообщение
      pricePerThEl.textContent = "Индивидуальные условия";
    }

    // Всегда вычисляем доходность, даже для диапазона 2821-3760
    // (курс BTC влияет на доходность независимо от диапазона мощности)

    const metrics = computeProfitability({
      powerTh: finalPowerTh,
      btcPrice,
      config,
    });

    if (summary) {
      // Для диапазона 2821-3760 используем 0 как стоимость пакета
      const packageCost =
        tierPrice !== null && finalPowerTh <= 2820 ? finalAmountUsd : 0;
      updateSummary(summary, metrics, {
        currency: ctlState.currency || "dollar",
        rates: ctlState.usdRates || { USD: 1 },
        packageCostUsd: packageCost,
        selectedPeriod: selectedPeriod,
      });
    }

    lastRenderContext = {
      powerTh: finalPowerTh,
      amountUsd: finalAmountUsd,
      btcPrice,
      currencyState: {
        currency,
        usdRates: rates,
        // Сохраняем в контекст именно рыночный курс из API — для паттернов
        btcUsd: apiBtcUsd,
      },
    };

    isUpdating = false;
    notifyAfterRender();
  };

  // Подписки на изменения с указанием источника
  if (powerInput) {
    powerInput.addEventListener("input", () => {
      if (!isUpdating) render("power");
    });
    powerInput.addEventListener("change", () => {
      if (!isUpdating) render("power");
    });
    powerInput.addEventListener("slider-update", () => {
      if (!isUpdating) render("power");
    });
  }
  if (priceInput) {
    priceInput.addEventListener("input", () => {
      if (!isUpdating) render("amount");
    });
    priceInput.addEventListener("change", () => {
      if (!isUpdating) render("amount");
    });
    priceInput.addEventListener("slider-update", (e) => {
      // Предотвращаем циклические обновления при программном обновлении слайдера
      if (!isUpdating && e.detail?.source !== "programmatic") {
        render("amount");
      }
    });
  }
  if (courseInput) {
    const updateCourseDisplay = () => {
      // Читаем значение напрямую из поля, чтобы сохранить точность
      const rawValue = courseInput.value.trim();
      if (!rawValue) return;

      // Парсим значение, сохраняя точность
      const courseValue = parseFloat(rawValue);
      if (!Number.isFinite(courseValue) || courseValue <= 0) return;

      // Форматируем значение с 9 знаками после запятой
      const formattedValue = courseValue.toFixed(9);
      // Обновляем только если значение изменилось (чтобы избежать циклов)
      if (courseInput.value !== formattedValue && !isUpdating) {
        courseInput.value = formattedValue;
        courseInput.setAttribute("value", formattedValue);
        updateFilledState(courseInput);
      }
      if (!isUpdating) render("auto");
    };

    courseInput.addEventListener("input", updateCourseDisplay);
    courseInput.addEventListener("change", updateCourseDisplay);
    courseInput.addEventListener("slider-update", updateCourseDisplay);
  }

  const setPowerTh = (value, options = {}) => {
    if (!powerInput) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const min = Number(powerInput.getAttribute("min")) || 0;
    const maxAttr = Number(powerInput.getAttribute("max"));
    const max = Number.isFinite(maxAttr) ? maxAttr : 3760;
    const clamped = Math.max(min, Math.min(max, Math.round(numeric)));
    if (clamped !== toNumber(powerInput.value)) {
      powerInput.value = String(clamped);
      powerInput.setAttribute("value", powerInput.value);
      updateFilledState(powerInput);
      if (powerSliderEl?.noUiSlider) {
        try {
          powerSliderEl.noUiSlider.set(clamped);
        } catch (_e) {
          // игнорируем ошибки noUiSlider
        }
      }
    }
    if (options.focus) {
      requestAnimationFrame(() => powerInput?.focus());
    }
    render("power");
  };

  const onAfterRender = (cb) => {
    if (typeof cb === "function") {
      afterRenderListeners.add(cb);
      return () => afterRenderListeners.delete(cb);
    }
    return () => {};
  };

  // При старте: подгружаем удалённую конфигурацию, если указана
  // Параллельно тянем статистику из OurPool (если заданы account и token)
  const remoteCfgPromise = remoteConfigUrl
    ? loadRemoteConfig(remoteConfigUrl)
        .then((remote) => {
          if (remote && typeof remote === "object") {
            deepMerge(config, remote);
          }
        })
        .catch(() => {})
    : Promise.resolve();

  const ourPoolStatsPromise =
    ourPoolCfg?.account && ourPoolCfg?.token
      ? fetchRewardsStats({
          baseUrl: ourPoolCfg.baseUrl || "https://ourpool.io",
          account: ourPoolCfg.account,
          token: ourPoolCfg.token,
        })
          .then((stats) => {
            if (stats) {
              applyRewardsStatsToConfig(config, stats);
            }
          })
          .catch(() => {})
      : Promise.resolve();

  Promise.allSettled([remoteCfgPromise, ourPoolStatsPromise]).finally(() => {
    render();
  });

  return {
    render,
    config,
    setPowerTh,
    getContext: getPublicContext,
    onAfterRender,
  };
}

// --- API OurPool (заготовки) ---

export async function fetchRewardsStats({ baseUrl, account, token }) {
  if (!account || !token) return null;
  // В режиме разработки используем прокси, в продакшене - прямой запрос
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const apiPath = `/api/v1/accounts/${encodeURIComponent(
    account
  )}/btc/rewards-stats?token=${encodeURIComponent(token)}`;
  const url = isDev ? apiPath : `${baseUrl}${apiPath}`;

  const res = await fetch(url, {
    mode: "cors",
    credentials: "omit",
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

// --- Расчёты ---

// Нестрогая мапа статистики OurPool в конфиг калькулятора
function applyRewardsStatsToConfig(config, stats) {
  if (!config || !stats) return;
  // Ищем btcPerThPerDay
  const btcPerThCandidates = [
    stats.btcPerThPerDay,
    stats.btc_per_th_per_day,
    stats.btc_per_th_day,
    stats.perThPerDayBtc,
    stats.per_th_per_day_btc,
    stats?.daily?.btcPerTh,
    stats?.daily?.btc_per_th,
  ].filter((v) => typeof v === "number" && isFinite(v) && v > 0);
  if (btcPerThCandidates.length) {
    config.yield.btcPerThPerDay = btcPerThCandidates[0];
  }
  // Ищем uptime в процентах (допускаем 0..1 и 0..100)
  const uptimeCandidates = [
    stats.uptimePercent,
    stats.uptime_percent,
    stats.uptime,
    stats.uptime_avg,
    stats?.daily?.uptime,
  ].filter((v) => typeof v === "number" && isFinite(v) && v >= 0);
  if (uptimeCandidates.length) {
    let u = uptimeCandidates[0];
    // Если 0..1, конвертируем в проценты
    if (u <= 1) u = u * 100;
    // Нормализуем в 0..100
    u = Math.max(0, Math.min(100, u));
    config.yield.uptimePercent = u;
  }
}

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
  // Выше верхнего диапазона (2821-3760) — нужен менеджер
  return null;
}

// Получить текущий тир по мощности
export function resolveTier(powerTh, tiers) {
  for (const t of tiers) {
    if (powerTh >= t.min && powerTh <= t.max) return t;
  }
  // Выше верхнего диапазона (2821-3760)
  return null;
}

// Обратный расчет: из суммы получить мощность
export function calculatePowerFromAmount(amountUsd, tiers) {
  if (amountUsd <= 0) return 0;

  // Перебираем диапазоны от меньшего к большему
  for (const tier of tiers) {
    const minCost = tier.min * tier.pricePerTh;
    const maxCost = tier.max * tier.pricePerTh;

    // Если сумма попадает в диапазон стоимости этого тира
    if (amountUsd >= minCost && amountUsd <= maxCost) {
      const calculatedPower = amountUsd / tier.pricePerTh;
      // Проверяем, что рассчитанная мощность попадает в диапазон тира
      if (calculatedPower >= tier.min && calculatedPower <= tier.max) {
        return Math.round(calculatedPower);
      }
    }
  }

  // Если сумма больше максимального диапазона, возвращаем мощность по последнему тиру
  const lastTier = tiers[tiers.length - 1];
  if (lastTier && amountUsd > lastTier.max * lastTier.pricePerTh) {
    return Math.round(amountUsd / lastTier.pricePerTh);
  }

  // Если сумма меньше минимального диапазона, используем первый тир
  const firstTier = tiers[0];
  if (firstTier && amountUsd < firstTier.min * firstTier.pricePerTh) {
    return Math.round(amountUsd / firstTier.pricePerTh);
  }

  return 0;
}

// --- UI helpers ---

function bindControl(formEl, inputSel, sliderSel) {
  const input = query(formEl, inputSel);
  const slider = query(formEl, sliderSel);
  if (!input || !slider) return;
  initRangeControl({ input, slider });
}

// Обновить границы и шаг для поля суммы на основе текущей мощности
function updateAmountBounds(
  formEl,
  powerTh,
  tiers,
  initializedRef,
  targetAmount = null,
  currencyCtx = null
) {
  const priceInput = query(formEl, "#loanAmountInput");
  const amountSlider = query(formEl, "#loanAmountSlider");

  if (!priceInput || !amountSlider) return false;

  const tier = resolveTier(powerTh, tiers);

  // Находим родительский элемент calculator__field для скрытия/показа
  const fieldElement = priceInput.closest(".calculator__field");

  // Если мощность выше 2820 TH, скрываем поле суммы и показываем кнопку "Связаться"
  if (!tier || powerTh > 2820) {
    if (fieldElement) {
      fieldElement.style.display = "none";
    }
    if (amountSlider) {
      amountSlider.style.display = "none";
    }
    // Уничтожаем слайдер, если он был инициализирован
    if (amountSlider?.noUiSlider) {
      amountSlider.noUiSlider.destroy();
      amountSlider.noUiSlider = null;
      initializedRef.current = false;
    }
    return false;
  }

  // Показываем поле суммы
  if (fieldElement) {
    fieldElement.style.display = "";
  }
  if (amountSlider) {
    amountSlider.style.display = "";
  }

  // Вычисляем границы суммы на основе диапазона тира
  const minAmountUsd = Math.round(tier.min * tier.pricePerTh);
  const maxAmountUsd = Math.round(tier.max * tier.pricePerTh);
  const stepUsd = tier.pricePerTh; // Шаг равен цене за 1 TH

  // Конвертация для отображения в выбранной валюте
  const currency = currencyCtx?.currency || "dollar";
  const rates = currencyCtx?.rates || { USD: 1 };
  const decimals = currency === "ruble" ? 0 : 2;
  const normalize = (value) =>
    Number.isFinite(value) ? Number(value.toFixed(decimals)) : value;
  const minAmount = normalize(convertFromUsd(minAmountUsd, currency, rates));
  const maxAmount = normalize(convertFromUsd(maxAmountUsd, currency, rates));
  const stepRaw = convertFromUsd(stepUsd, currency, rates);
  const stepConverted = Number(
    Number(stepRaw).toFixed(decimals === 0 ? 0 : decimals)
  );
  const stepSafe = Number.isFinite(stepConverted)
    ? stepConverted
    : decimals === 0
    ? 1
    : Number.EPSILON;
  const minStep =
    decimals === 0 ? 1 : Number((1 / Math.pow(10, decimals)).toFixed(decimals));
  const step =
    decimals === 0 ? Math.max(stepSafe, minStep) : Math.max(stepSafe, minStep);

  // Обновляем атрибуты input
  priceInput.setAttribute("min", String(minAmount));
  priceInput.setAttribute("max", String(maxAmount));
  priceInput.setAttribute("step", String(step));

  // Определяем целевое значение суммы
  let amountValueUsd = targetAmount;
  if (amountValueUsd === null) {
    const currentValue = toNumber(priceInput.value);
    // currentValue в отображаемой валюте → конвертируем в USD для внутренней логики
    const currentValueUsd = convertToUsd(currentValue, currency, rates);
    const minUsd = minAmountUsd;
    const maxUsd = maxAmountUsd;
    if (
      currentValueUsd &&
      currentValueUsd >= minUsd &&
      currentValueUsd <= maxUsd
    ) {
      amountValueUsd = currentValueUsd;
    } else {
      // Устанавливаем значение по умолчанию (текущая мощность * цена) в USD
      amountValueUsd = Math.round(powerTh * tier.pricePerTh);
    }
  }

  // Ограничиваем значение границами
  amountValueUsd = Math.max(
    minAmountUsd,
    Math.min(maxAmountUsd, Math.round(amountValueUsd))
  );
  const amountValue = normalize(
    convertFromUsd(amountValueUsd, currency, rates)
  );

  // Обновляем слайдер, если он уже инициализирован
  if (amountSlider.noUiSlider) {
    try {
      // Получаем текущее значение слайдера
      const currentSliderValue = parseFloat(amountSlider.noUiSlider.get());

      // Обновляем границы слайдера
      amountSlider.noUiSlider.updateOptions({
        range: { min: minAmount, max: maxAmount },
        step: step,
      });

      // Проверяем, нужно ли обновить значение
      // Обновляем, если:
      // 1. Значение было явно задано (targetAmount !== null)
      // 2. Текущее значение вне новых границ
      // 3. Текущее значение значительно отличается от целевого
      const shouldUpdateValue =
        targetAmount !== null &&
        (currentSliderValue < minAmount ||
          currentSliderValue > maxAmount ||
          Math.abs(currentSliderValue - amountValue) > 1);

      if (shouldUpdateValue) {
        // Обновляем значение слайдера
        // Флаг isUpdating предотвратит циклические обновления
        amountSlider.noUiSlider.set(amountValue);
      }
    } catch (e) {
      // Если не удалось обновить, пересоздаем слайдер
      console.warn("Failed to update slider options, recreating:", e);
      amountSlider.noUiSlider.destroy();
      amountSlider.noUiSlider = null;
      initializedRef.current = false;
      // Продолжаем инициализацию ниже
    }
  }

  // Инициализируем слайдер, если он еще не инициализирован
  if (!amountSlider.noUiSlider && tier) {
    // Устанавливаем значение в input перед инициализацией
    priceInput.value = String(amountValue);
    priceInput.setAttribute("value", priceInput.value);
    updateFilledState(priceInput);

    // Инициализируем слайдер
    initRangeControl({ input: priceInput, slider: amountSlider });
    initializedRef.current = true;
  } else if (amountSlider.noUiSlider && targetAmount !== null) {
    // Обновляем значение в input, если оно было задано явно
    priceInput.value = String(amountValue);
    priceInput.setAttribute("value", priceInput.value);
    updateFilledState(priceInput);
  }

  return true;
}

function updateSummary(root, metrics, viewCtx) {
  const profitEl = root.querySelector(".calculator__summary-profit");
  const costEl = root.querySelector(".calculator__summary-cost");
  const annuallyEl = root.querySelector(".calculator__summary-annually");

  const period = viewCtx?.selectedPeriod || "day";
  const periodData = metrics?.[period];

  // Показываем клиенту чистую прибыль в BTC
  if (profitEl && periodData?.accrualBtc != null) {
    profitEl.textContent = `${periodData.accrualBtc} BTC`;
  }

  if (costEl && viewCtx) {
    const { currency, rates } = viewCtx;
    // Показываем клиенту чистую прибыль в валюте интерфейса
    const netUsd =
      periodData && typeof periodData.accrualUsd === "number"
        ? periodData.accrualUsd
        : null;
    if (netUsd != null) {
      const amount = convertFromUsd(netUsd, currency, rates);
      costEl.textContent = formatCurrency(amount, currency);
    } else {
      costEl.textContent = "-";
    }
  }

  // Окупаемость в процентах годовых
  // Используем чистую прибыль (accrualUsd), а не валовой доход (usd)
  if (annuallyEl && viewCtx && periodData) {
    const { packageCostUsd } = viewCtx;
    if (packageCostUsd > 0 && periodData.accrualUsd != null) {
      // Рассчитываем доходность на основе чистой прибыли за выбранный период
      const periodReturn = (periodData.accrualUsd / packageCostUsd) * 100;
      // Годовых (annualized): умножаем на количество периодов в году
      const annualized =
        period === "day"
          ? periodReturn * 365
          : period === "week"
          ? periodReturn * 52
          : period === "month"
          ? periodReturn * 12
          : periodReturn;
      annuallyEl.textContent = `${Math.round(annualized)}% годовых`;
    } else if (annuallyEl) {
      // Если нет стоимости пакета или данных, показываем прочерк
      annuallyEl.textContent = "-";
    }
  }
}

function convertToUsd(amount, currency, rates) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  if (currency === "dollar") return value;
  if (currency === "euro") {
    const eur = Number(rates?.EUR);
    return eur ? value / eur : value;
  }
  if (currency === "ruble") {
    const rub = Number(rates?.RUB);
    return rub ? value / rub : value;
  }
  return value;
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
