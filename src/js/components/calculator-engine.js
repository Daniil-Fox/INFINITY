// Калькулятор доходности и интеграция с OurPool API
// ВАЖНО: Токен и account читаем из DOM-атрибутов формы или из конфигурации

import {
  initRangeControl,
  setupCurrencySuffix,
  updateFilledState,
} from "./loan.js";
import { initCurrencyController } from "./currency-controller.js";
import { convertFromUsd, formatCurrency } from "./currency-utils.js";

// ВАЖНО: Токены больше не хранятся в клиентском коде!
// В продакшене токены получаются на сервере через PHP прокси.
// Для dev режима можно установить через window.INFINITY_ENV или meta-теги.
window.INFINITY_ENV =
  window.INFINITY_ENV ||
  {
    // OURPOOL_ACCOUNT: "", // Установите для dev режима
    // OURPOOL_TOKEN: "", // Установите для dev режима
  };

const GROUP_FORMATTER = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

const getCurrencyRate = (rates = {}, currency = "dollar") => {
  if (currency === "euro") return rates.EUR || 0.92;
  if (currency === "ruble") return rates.RUB || 92;
  return 1;
};

const formatIntWithSpaces = (value) => {
  if (!Number.isFinite(value)) return "";
  return GROUP_FORMATTER.format(Math.round(value)).replace(/\u00A0/g, " ");
};

const setValueWithSpaces = (input, numeric) => {
  if (!input) return;
  const plain = String(Math.round(numeric));
  input.dataset.value = plain;
  const formatted =
    input.type === "number" ? plain : formatIntWithSpaces(numeric);
  try {
    input.value = formatted;
    input.setAttribute("value", formatted);
  } catch (_e) {
    input.value = plain;
    input.setAttribute("value", plain);
  }
  updateFilledState(input);
};

const BTC_COURSE_MAX = 300000;

// Конфиг по умолчанию: можно переопределить через data-атрибуты
export const defaultConfig = {
  ourPool: {
    baseUrl: "https://ourpool.io",
    account: "", // data-account на .calculator__form или передать через init (только для dev)
    token: "", // data-token на .calculator__form или передать через init (только для dev)
  },
  pricing: {
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

const DEFAULT_CALCULATOR_CONFIG_URL = "/wp-json/infinity/v1/calculator-config";
const calculatorConfigCache = new Map();

export function initCalculator(formEl, options = {}) {
  if (!formEl) return;

  const config = mergeConfigFromDom(defaultConfig, formEl, options);
  const remoteConfigUrl = resolveCalculatorConfigUrl(formEl);
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
  const pricePerThHint = query(formEl, ".calculator__info .hint");
  const resetBtn = query(formEl, ".course__btn");
  const resetCalculatorBtn = query(formEl, ".calculator__reset");
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

  const clampAmountInputValue = () => {
    if (!priceInput) return null;
    const raw = priceInput.value?.trim() || "";
    if (!raw) {
      priceInput.value = "";
      priceInput.setAttribute("value", "");
      updateFilledState(priceInput);
      return null;
    }

    // Ранний sanitize: оставляем только число и синхронизируем атрибут,
    // сами границы min/max применяются в updateAmountBounds внутри render().
    let numeric = toNumber(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      priceInput.value = "";
      priceInput.setAttribute("value", "");
      updateFilledState(priceInput);
      return null;
    }

    setValueWithSpaces(priceInput, numeric);
    return numeric;
  };

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
        // Конвертируем стоимость 1 BTC в выбранную валюту
        const rates = state.usdRates || { USD: 1, EUR: 0.92, RUB: 92 };
        let btcPriceInCurrency;

        if (state.currency === "dollar") {
          btcPriceInCurrency = state.btcUsd;
        } else if (state.currency === "euro") {
          btcPriceInCurrency = state.btcUsd * (rates.EUR || 0.92);
        } else if (state.currency === "ruble") {
          btcPriceInCurrency = state.btcUsd * (rates.RUB || 92);
        } else {
          btcPriceInCurrency = state.btcUsd;
        }

        const rateFactor = getCurrencyRate(rates, state.currency);
        const capInCurrency = BTC_COURSE_MAX * rateFactor;
        const capped = Math.min(btcPriceInCurrency, capInCurrency);
        const btcPerUsdFormatted = Math.round(capped);
        setValueWithSpaces(courseInput, btcPerUsdFormatted);

        // Настраиваем диапазон слайдера курса (80%-120% от текущего курса)
        // Диапазон рассчитывается на основе выбранной валюты
        const courseSlider = query(formEl, "#loanCourseSlider");
        if (courseSlider && state.btcUsd > 0) {
          // Рассчитываем курс BTC в выбранной валюте
          let btcInCurrency;
          if (state.currency === "dollar") {
            btcInCurrency = state.btcUsd;
          } else if (state.currency === "euro") {
            btcInCurrency = state.btcUsd * (rates.EUR || 0.92);
          } else if (state.currency === "ruble") {
            btcInCurrency = state.btcUsd * (rates.RUB || 92);
          } else {
            btcInCurrency = state.btcUsd;
          }

          const rateFactor = getCurrencyRate(rates, state.currency);
          const capInCurrency = BTC_COURSE_MAX * rateFactor;
          const maxBtcPrice = Math.round(
            Math.min(btcInCurrency * 3, capInCurrency)
          ); // 120% курса, но не выше cap в выбранной валюте
          const minBtcPrice = Math.round(
            Math.max(1, Math.min(btcInCurrency * 0.8, maxBtcPrice * 0.8))
          ); // 80% от текущего, но не выше 80% max

          courseInput.setAttribute("min", minBtcPrice);
          courseInput.setAttribute("max", maxBtcPrice);
          courseInput.setAttribute("step", "1"); // Шаг 1 (целые числа)

          if (!courseSliderInitialized) {
            // Убеждаемся, что значение установлено правильно перед инициализацией
            // Устанавливаем значение с точностью до 9 знаков
            setValueWithSpaces(courseInput, btcPerUsdFormatted);

            // Инициализируем слайдер курса
            initRangeControl({ input: courseInput, slider: courseSlider });

            // После инициализации проверяем и восстанавливаем точное значение
            // (на случай если initRangeControl изменил его из-за округления)
            const currentValue = parseFloat(courseInput.value);
            const expectedValue = parseFloat(btcPerUsdFormatted);
            if (Math.abs(currentValue - expectedValue) > 0.5) {
              setValueWithSpaces(courseInput, btcPerUsdFormatted);
            }

            courseSliderInitialized = true;
          } else {
            // Обновляем диапазон существующего слайдера
            if (courseSlider.noUiSlider) {
              const minNum = minBtcPrice;
              const maxNum = maxBtcPrice;
              const currentNum = parseFloat(btcPerUsdFormatted);

              courseSlider.noUiSlider.updateOptions({
                range: {
                  min: minNum,
                  max: maxNum,
                },
                step: 1,
                format: {
                  to: function (value) {
                    return Math.round(value);
                  },
                  from: function (value) {
                    return parseFloat(value);
                  },
                },
              });

              // Устанавливаем значение
              courseSlider.noUiSlider.set(Math.min(currentNum, maxBtcPrice));
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
        // Конвертируем стоимость 1 BTC в выбранную валюту
        const rates = state.usdRates || { USD: 1, EUR: 0.92, RUB: 92 };
        let btcPriceInCurrency;

        if (state.currency === "dollar") {
          btcPriceInCurrency = state.btcUsd;
        } else if (state.currency === "euro") {
          btcPriceInCurrency = state.btcUsd * (rates.EUR || 0.92);
        } else if (state.currency === "ruble") {
          btcPriceInCurrency = state.btcUsd * (rates.RUB || 92);
        } else {
          btcPriceInCurrency = state.btcUsd;
        }

        const capped = Math.min(btcPriceInCurrency, BTC_COURSE_MAX);
        const btcPerUsdNum = parseFloat(capped);

        if (courseInput) {
          setValueWithSpaces(courseInput, capped);
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

  // Кнопка полного сброса калькулятора
  if (resetCalculatorBtn && currencyCtl) {
    resetCalculatorBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Сбрасываем мощность к минимальному значению (первый тир)
      const firstTier = config.pricing.tiers[0];
      const defaultPower = firstTier ? firstTier.min : 8;
      if (powerInput) {
        powerInput.value = String(defaultPower);
        powerInput.setAttribute("value", String(defaultPower));
        updateFilledState(powerInput);
        if (powerSliderEl?.noUiSlider) {
          powerSliderEl.noUiSlider.set(defaultPower);
        }
      }

      // Сбрасываем курс биткоина к курсу из API
      const state = currencyCtl.getState();
      if (Number.isFinite(state.btcUsd) && state.btcUsd > 0 && courseInput) {
        const rates = state.usdRates || { USD: 1, EUR: 0.92, RUB: 92 };
        let btcPriceInCurrency;

        if (state.currency === "dollar") {
          btcPriceInCurrency = state.btcUsd;
        } else if (state.currency === "euro") {
          btcPriceInCurrency = state.btcUsd * (rates.EUR || 0.92);
        } else if (state.currency === "ruble") {
          btcPriceInCurrency = state.btcUsd * (rates.RUB || 92);
        } else {
          btcPriceInCurrency = state.btcUsd;
        }

        const capped = Math.min(btcPriceInCurrency, BTC_COURSE_MAX);
        const btcPerUsdNum = parseFloat(capped);

        setValueWithSpaces(courseInput, capped);

        const courseSlider = query(formEl, "#loanCourseSlider");
        if (courseSlider?.noUiSlider) {
          courseSlider.noUiSlider.set(btcPerUsdNum);
        }
      }

      // Сбрасываем период к "за год"
      selectedPeriod = "year";
      periodTabs.forEach((r) => {
        r.checked = false;
        r.dataset.selected = "0";
        const label = r.closest("label");
        if (label) {
          label.style.pointerEvents = "";
          label.style.cursor = "";
        }
      });
      const defaultYearTab = periodTabs[periodTabs.length - 1];
      if (defaultYearTab) {
        defaultYearTab.checked = true;
        defaultYearTab.dataset.selected = "1";
        const yearLabel = defaultYearTab.closest("label");
        if (yearLabel) {
          yearLabel.style.pointerEvents = "none";
          yearLabel.style.cursor = "default";
        }
      }

      // Сумма пересчитается автоматически при render() на основе мощности
      render("power");
    });
  }

  // Табы периодов: по умолчанию показываем "год", радиокнопки не активны
  let selectedPeriod = "year";
  // Сбрасываем любые предзаданные checked в разметке
  periodTabs.forEach((r) => {
    if (r.checked) r.checked = false;
    r.dataset.selected = "0";
  });
  // Устанавливаем "за год" как выбранный по умолчанию (последний таб)
  const defaultYearTab = periodTabs[periodTabs.length - 1];
  if (defaultYearTab) {
    defaultYearTab.checked = true;
    defaultYearTab.dataset.selected = "1";
    // Делаем выбранный таб некликабельным
    const yearLabel = defaultYearTab.closest("label");
    if (yearLabel) {
      yearLabel.style.pointerEvents = "none";
      yearLabel.style.cursor = "default";
    }
  }
  periodTabs.forEach((tab, idx) => {
    const period =
      idx === 0 ? "day" : idx === 1 ? "week" : idx === 2 ? "month" : "year";
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const isCurrentlySelected = tab.dataset.selected === "1";
      // Если таб уже выбран, не обрабатываем клик (он некликабельный)
      if (isCurrentlySelected) {
        return;
      }
      // Выбор нового периода
      periodTabs.forEach((r) => {
        r.checked = false;
        r.dataset.selected = "0";
        // Возвращаем кликабельность всем табам
        const label = r.closest("label");
        if (label) {
          label.style.pointerEvents = "";
          label.style.cursor = "";
        }
      });
      tab.checked = true;
      tab.dataset.selected = "1";
      selectedPeriod = period;
      // Делаем выбранный таб некликабельным
      const selectedLabel = tab.closest("label");
      if (selectedLabel) {
        selectedLabel.style.pointerEvents = "none";
        selectedLabel.style.cursor = "default";
      }
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
    // В инпуте хранится стоимость 1 BTC в выбранной валюте
    const courseInputRaw =
      courseInput?.dataset?.value ||
      courseInput?.value?.replace(/\s+/g, "").replace(/\u00A0/g, "") ||
      "";
    const courseInputValue = courseInputRaw ? parseFloat(courseInputRaw) : 0;

    // Разделяем рыночный курс из API и "пользовательский" курс из инпута
    const apiBtcUsd =
      Number.isFinite(ctlState.btcUsd) && ctlState.btcUsd > 0
        ? ctlState.btcUsd
        : 109500;

    // Если пользователь изменил курс, конвертируем из выбранной валюты в USD
    let userOverrideBtcUsd = null;
    if (Number.isFinite(courseInputValue) && courseInputValue > 0) {
      const rates = ctlState.usdRates || { USD: 1, EUR: 0.92, RUB: 92 };
      if (currency === "dollar") {
        userOverrideBtcUsd = courseInputValue;
      } else if (currency === "euro") {
        userOverrideBtcUsd = courseInputValue / (rates.EUR || 0.92);
      } else if (currency === "ruble") {
        userOverrideBtcUsd = courseInputValue / (rates.RUB || 92);
      } else {
        userOverrideBtcUsd = courseInputValue;
      }
    }

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
    if (source === "amount" && rawAmount > 0) {
      // Пользователь вручную изменил сумму в выбранной валюте.
      // 1) Клампим значение по min/max атрибутам (они уже в нужной валюте).
      let localAmount = rawAmount;
      if (priceInput) {
        const minAttr = Number(priceInput.getAttribute("min"));
        const maxAttr = Number(priceInput.getAttribute("max"));
        if (Number.isFinite(minAttr)) {
          localAmount = Math.max(localAmount, minAttr);
        }
        if (Number.isFinite(maxAttr)) {
          localAmount = Math.min(localAmount, maxAttr);
        }
        setValueWithSpaces(priceInput, localAmount);
      }

      // 2) Пересчитываем мощность из суммы в USD
      const localAmountUsd = convertToUsd(localAmount, currency, rates);
      const calculatedPower = calculatePowerFromAmount(
        localAmountUsd,
        config.pricing.tiers
      );
      if (calculatedPower > 0) {
        finalPowerTh = calculatedPower;
        if (powerInput) {
          setValueWithSpaces(powerInput, Math.round(finalPowerTh));
          // Обновляем слайдер мощности
          if (powerSliderEl?.noUiSlider) {
            powerSliderEl.noUiSlider.set(finalPowerTh);
          }
        }
        // Обновляем границы суммы, так как мощность могла измениться (переход в другой тир)
        // Передаем пересчитанную сумму в USD, чтобы скорректировать её в границах тира
        updateAmountBounds(
          formEl,
          finalPowerTh,
          config.pricing.tiers,
          amountSliderInitialized,
          localAmountUsd,
          { currency, rates }
        );
        finalAmountUsd = localAmountUsd; // Используем сумму после клампа в USD
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
      // Возвращаем исходное содержимое тултипа
      if (pricePerThHint) {
        // Обновляем содержимое через API tippy, если он инициализирован
        if (pricePerThHint._tippy) {
          const insideTippy = `
          <div>
            <p class="desc">Перечень стоимости за 1 TH</p>
            <p class="desc desc_accent">Меняется в зависимости
              от количества покупаемой
              мощности за 1 раз</p>
          </div>
          `;
          pricePerThHint._tippy.setContent(insideTippy);
        }
      }
    } else if (pricePerThEl && finalPowerTh > 2820) {
      // Для диапазона 2821-3760 скрываем или показываем сообщение
      // Обновляем содержимое тултипа
      if (pricePerThHint) {
        const tooltipContent = `<div class="desc">
        <p class="desc_accent">
        ИП - Индивидуальный план
        </p>
        <p>
        После (мощность)
        ваша стоимость за 1 TH
        рассчитывается индивидуально
        </p></div>`;
        pricePerThHint.innerHTML = tooltipContent;
        pricePerThEl.textContent = "ИП";
        // Обновляем содержимое через API tippy, если он инициализирован
        if (pricePerThHint._tippy) {
          pricePerThHint._tippy.setContent(tooltipContent);
        }
      }
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
    powerInput.addEventListener("slider-update", (e) => {
      // Если это обновление от слайдера (skipRender), только обновляем визуальное состояние
      // Перерасчет запустится при событии slider-end
      if (e.detail?.skipRender) {
        updateFilledState(powerInput);
        return;
      }
      if (!isUpdating) render("power");
    });
    // Обработчик окончания перетаскивания слайдера мощности
    powerInput.addEventListener("slider-end", () => {
      if (!isUpdating) {
        render("power");
      }
    });
    // Обработчик Enter: убираем фокус с инпута
    powerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement === powerInput) {
        e.preventDefault();
        powerInput.blur();
      }
    });
  }
  if (priceInput) {
    // Debounce таймер для перерасчета при вводе с клавиатуры
    let amountDebounceTimer = null;
    const AMOUNT_DEBOUNCE_DELAY = 300; // мс

    const commitManualAmount = ({ clamp = false } = {}) => {
      const raw = priceInput.value ?? "";
      const trimmed = raw.trim();
      const hasValue = trimmed !== "";

      if (!hasValue) {
        // Поле очищено пользователем: просто обновляем визуальное состояние
        // и не запускаем перерасчет, чтобы калькулятор не "подставлял" сумму сам.
        priceInput.setAttribute("value", "");
        updateFilledState(priceInput);

        if (amountDebounceTimer) {
          clearTimeout(amountDebounceTimer);
          amountDebounceTimer = null;
        }
        return;
      }

      if (clamp) {
        // Только санитизируем ввод (убираем лишние символы, приводим к числу),
        // сами min/max применяются внутри render() через updateAmountBounds.
        clampAmountInputValue();
      } else {
        // При наборе с клавиатуры не трогаем текст, только синхронизируем атрибут
        priceInput.setAttribute("value", priceInput.value);
        updateFilledState(priceInput);
      }

      // Очищаем предыдущий таймер
      if (amountDebounceTimer) {
        clearTimeout(amountDebounceTimer);
      }

      // Запускаем перерасчет через debounce
      amountDebounceTimer = setTimeout(() => {
        if (!isUpdating) {
          render("amount");
        }
        amountDebounceTimer = null;
      }, AMOUNT_DEBOUNCE_DELAY);
    };

    priceInput.addEventListener("input", () => {
      // При вводе с клавиатуры даем пользователю полностью ввести значение.
      // Не запускаем перерасчет и не применяем min/max до события change/blur.
      const raw = priceInput.value ?? "";
      priceInput.setAttribute("value", raw);
      updateFilledState(priceInput);
    });

    priceInput.addEventListener("change", () =>
      commitManualAmount({ clamp: true })
    );

    priceInput.addEventListener("slider-update", (e) => {
      // Если это обновление от слайдера (skipRender), только обновляем визуальное состояние
      // Перерасчет запустится при событии slider-end
      if (e.detail?.skipRender) {
        updateFilledState(priceInput);
        return;
      }

      // Предотвращаем циклические обновления при программном обновлении слайдера
      if (!isUpdating && e.detail?.source !== "programmatic") {
        commitManualAmount({ clamp: true });
      }
    });

    // Обработчик окончания перетаскивания слайдера
    priceInput.addEventListener("slider-end", () => {
      // Когда перестали тянуть слайдер - сразу пересчитываем,
      // min/max применяются внутри render() через updateAmountBounds.
      if (!isUpdating) {
        render("amount");
      }
    });
    // Обработчик Enter: убираем фокус с инпута
    priceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement === priceInput) {
        e.preventDefault();
        priceInput.blur();
      }
    });
  }
  if (courseInput) {
    const updateCourseDisplay = () => {
      // Читаем значение напрямую из поля
      const rawValue = courseInput.value.trim();
      if (!rawValue) return;

      // Парсим значение и округляем до целого числа
      const courseValue = Math.round(parseFloat(rawValue));
      if (!Number.isFinite(courseValue) || courseValue <= 0) return;

      // Форматируем значение как целое число
      const formattedValue = courseValue.toString();
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
    courseInput.addEventListener("slider-update", (e) => {
      // Если это обновление от слайдера (skipRender), только обновляем визуальное состояние
      // Перерасчет запустится при событии slider-end
      if (e.detail?.skipRender) {
        updateFilledState(courseInput);
        return;
      }
      updateCourseDisplay();
    });
    // Обработчик окончания перетаскивания слайдера курса
    courseInput.addEventListener("slider-end", () => {
      if (!isUpdating) {
        render("auto");
      }
    });
    // Обработчик Enter: убираем фокус с инпута
    courseInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement === courseInput) {
        e.preventDefault();
        courseInput.blur();
      }
    });
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
      setValueWithSpaces(powerInput, clamped);
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
    ? loadCalculatorConfig(remoteConfigUrl).then((remote) => {
        if (remote && typeof remote === "object") {
          deepMerge(config, remote);
        }
      })
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
  // account и token больше не используются напрямую, но оставлены для обратной совместимости
  // В продакшене токен получается на сервере через PHP прокси
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Формируем путь API (account будет заменен на сервере, если нужно)
  const accountPlaceholder = account
    ? encodeURIComponent(account)
    : "{account}";
  const apiPath = `/api/v1/accounts/${accountPlaceholder}/btc/rewards-stats`;

  let url;
  if (isDev) {
    // Dev: используем прокси gulp, токен передаем в query (для dev режима)
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    url = `${apiPath}${tokenParam}`;
  } else {
    // Prod: используем PHP прокси WordPress (токен получается на сервере)
    const proxyPath = "/wp-content/themes/infinity/assets/ourpool-proxy.php";
    url = `${proxyPath}?path=${encodeURIComponent(apiPath)}`;
  }

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

  // Вычисляем границы суммы на основе полного диапазона (от первого тира до последнего)
  // Минимум = первый тир min * первый тир pricePerTh
  // Максимум = последний тир max * последний тир pricePerTh (до "индивидуального предложения")
  const firstTier = tiers[0];
  const lastTier = tiers[tiers.length - 1];
  const minAmountUsd = Math.round(firstTier.min * firstTier.pricePerTh);
  const maxAmountUsd = Math.round(lastTier.max * lastTier.pricePerTh);
  // Используем минимальный шаг из всех тиров для плавного перетягивания
  const stepUsd = Math.min(...tiers.map((t) => t.pricePerTh));

  // Конвертация для отображения в выбранной валюте
  const currency = currencyCtx?.currency || "dollar";
  const rates = currencyCtx?.rates || { USD: 1 };
  const decimals = 0; // Без десятичных дробей для всех валют
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
    setValueWithSpaces(priceInput, amountValue);

    // Инициализируем слайдер
    initRangeControl({ input: priceInput, slider: amountSlider });
    initializedRef.current = true;
  } else if (amountSlider.noUiSlider && targetAmount !== null) {
    // Обновляем значение в input, если оно было задано явно
    setValueWithSpaces(priceInput, amountValue);
  }

  return true;
}

// Функция анимации числа от старого значения к новому
function animateNumber(element, newValue, formatFn, duration = 600) {
  if (!element) return;

  const currentText = element.textContent.trim();

  // Парсим текущее значение (убираем все нечисловые символы кроме точки, запятой и минуса)
  let currentValue = 0;
  if (
    currentText &&
    currentText !== "-" &&
    currentText !== "- BTC" &&
    currentText !== "-%"
  ) {
    // Заменяем запятую на точку для парсинга
    const numericStr = currentText.replace(/[^\d.,-]/g, "").replace(",", ".");
    currentValue = parseFloat(numericStr) || 0;
  }

  // Парсим новое значение
  let targetValue = 0;
  if (
    newValue &&
    newValue !== "-" &&
    newValue !== "- BTC" &&
    newValue !== "-%"
  ) {
    const numericStr = String(newValue)
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".");
    targetValue = parseFloat(numericStr) || 0;
  }

  // Если значения одинаковые или новое значение некорректно, просто обновляем текст
  if (
    !Number.isFinite(targetValue) ||
    (!Number.isFinite(currentValue) && currentText !== newValue) ||
    (Number.isFinite(currentValue) &&
      Number.isFinite(targetValue) &&
      Math.abs(currentValue - targetValue) < 0.0000001)
  ) {
    element.textContent = newValue;
    return;
  }

  // Если текущее значение некорректно, начинаем с 0
  if (!Number.isFinite(currentValue)) {
    currentValue = 0;
  }

  // Анимация
  const startTime = performance.now();
  const startValue = currentValue;
  const difference = targetValue - startValue;
  let animationFrameId = null;

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing функция (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);

    const current = startValue + difference * easeOut;
    const formatted = formatFn(current);
    element.textContent = formatted;

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Финальное значение
      element.textContent = newValue;
      animationFrameId = null;
    }
  };

  // Отменяем предыдущую анимацию, если она была
  if (element._animationFrameId) {
    cancelAnimationFrame(element._animationFrameId);
  }

  element._animationFrameId = requestAnimationFrame(animate);
}

function updateSummary(root, metrics, viewCtx) {
  const profitEl = root.querySelector(".calculator__summary-profit");
  const costEl = root.querySelector(".calculator__summary-cost");
  const annuallyEl = root.querySelector(".calculator__summary-annually");

  const period = viewCtx?.selectedPeriod || "year";
  const periodData = metrics?.[period];

  // Показываем клиенту чистую прибыль в BTC с анимацией
  if (profitEl) {
    const profitFormatted = formatBtcAmount(periodData?.accrualBtc);
    const newText = profitFormatted ? `${profitFormatted} BTC` : "- BTC";

    animateNumber(
      profitEl,
      newText,
      (value) => {
        const formatted = formatBtcAmount(value);
        return formatted ? `${formatted} BTC` : "- BTC";
      },
      600
    );
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
      const newText = formatCurrency(amount, currency);

      animateNumber(
        costEl,
        newText,
        (value) => formatCurrency(value, currency),
        600
      );
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
          : period === "year"
          ? periodReturn
          : periodReturn;
      const newText = `${Math.round(annualized)}% годовых`;

      animateNumber(
        annuallyEl,
        newText,
        (value) => `${Math.round(value)}% годовых`,
        600
      );
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

function formatBtcAmount(value, decimals = 9) {
  if (!Number.isFinite(value)) return null;
  return Number(value).toFixed(decimals);
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

function resolveCalculatorConfigUrl(formEl) {
  const attrUrl = formEl?.getAttribute("data-config-url");
  if (attrUrl) return attrUrl;

  const env =
    (typeof window !== "undefined" && window.INFINITY_ENV) || undefined;
  if (env?.CALCULATOR_CONFIG_URL) {
    return env.CALCULATOR_CONFIG_URL;
  }

  if (typeof document !== "undefined") {
    const metaUrl = document
      .querySelector('meta[name="calculator-config-url"]')
      ?.getAttribute("content");
    if (metaUrl) return metaUrl;
  }

  if (isLocalhostEnv()) {
    return null;
  }

  return DEFAULT_CALCULATOR_CONFIG_URL;
}

function isLocalhostEnv() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function loadCalculatorConfig(url) {
  if (!url) return Promise.resolve(null);

  const cached = calculatorConfigCache.get(url);
  if (cached?.data) {
    return Promise.resolve(cached.data);
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) {
        return null;
      }
      return res.json();
    })
    .then((data) => {
      calculatorConfigCache.set(url, { data });
      return data;
    })
    .catch((error) => {
      console.warn("Failed to load calculator config", error);
      calculatorConfigCache.delete(url);
      return null;
    });

  calculatorConfigCache.set(url, { promise });
  return promise;
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
