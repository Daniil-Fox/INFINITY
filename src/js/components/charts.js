import Chart from "chart.js/auto";

// Конфигурация доходности (из CSV/ТЗ)
// Используется та же логика, что и в calculator-engine.js
const YIELD_CONFIG = {
  // Доходность BTC на 1 TH в день
  btcPerThPerDay: 0.0000004,
  // Uptime в процентах
  uptimePercent: 93.09,
};

// Расчет добычи BTC за день по формуле из calculator-engine.js
function calculateDailyBtc(powerTh, config = YIELD_CONFIG) {
  const { btcPerThPerDay, uptimePercent } = config;
  const uptime = Math.max(0, Math.min(100, uptimePercent)) / 100;
  const dailyBtc = btcPerThPerDay * powerTh * uptime;
  return dailyBtc;
}

// Кастомный плагин для улучшенного hover эффекта
const hoverZoomPlugin = {
  id: "hoverZoom",
  afterEvent(chart, args) {
    const { event, inChartArea } = args;
    if (!inChartArea || event.type !== "mousemove") return;
  },
};

Chart.register(hoverZoomPlugin);

// Получение мощностей пользователя из DOM
function getUserPower() {
  const powerElement = document.querySelector(".p-main__inwallet");
  if (!powerElement) return 100; // Значение по умолчанию

  const text = powerElement.textContent.trim();
  const match = text.match(/([\d.]+)\s*TH/i);
  return match ? parseFloat(match[1]) : 100;
}

// Кеш для данных о покупках (чтобы не запрашивать каждый раз)
let purchaseInfoCache = null;

// Получение данных о пополнениях из WordPress REST API или глобальной переменной
async function getPurchaseInfo() {
  // Если есть кеш, возвращаем его
  if (purchaseInfoCache !== null) {
    return purchaseInfoCache;
  }

  // Приоритет 1: REST API WordPress
  try {
    const nonce = window.INFINITY_REST_NONCE || "";
    const response = await fetch("/wp-json/infinity/v1/purchases", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-WP-Nonce": nonce,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (
        data.purchases &&
        Array.isArray(data.purchases) &&
        data.purchases.length > 0
      ) {
        const sortedPurchases = data.purchases
          .map((p) => {
            const date = p.date ? new Date(p.date) : null;
            if (!date || isNaN(date.getTime())) return null;
            return {
              date,
              amount: parseFloat(p.amount || 0),
              powerTh: parseFloat(p.power_th || 0),
            };
          })
          .filter((p) => p !== null)
          .sort((a, b) => a.date - b.date);

        if (sortedPurchases.length > 0) {
          purchaseInfoCache = sortedPurchases;
          return sortedPurchases;
        }
      }
    } else if (response.status === 401) {
      // 401 - не авторизован, используем fallback
      console.warn("Unauthorized access to purchases API, using fallback");
    }
  } catch (error) {
    console.warn("Failed to fetch purchases from WordPress API", error);
  }

  // Приоритет 2: Глобальная переменная (для обратной совместимости)
  const userData = window.INFINITY_USER_DATA || {};

  if (
    userData.purchases &&
    Array.isArray(userData.purchases) &&
    userData.purchases.length > 0
  ) {
    const sortedPurchases = userData.purchases
      .map((p) => {
        const date = p.date ? new Date(p.date) : null;
        if (!date || isNaN(date.getTime())) return null;
        return {
          date,
          amount: parseFloat(p.amount || p.powerTh || 0),
          powerTh: parseFloat(p.powerTh || p.amount || 0),
        };
      })
      .filter((p) => p !== null)
      .sort((a, b) => a.date - b.date);

    if (sortedPurchases.length > 0) {
      purchaseInfoCache = sortedPurchases;
      return sortedPurchases;
    }
  }

  // Fallback: пустой массив (если нет данных)
  purchaseInfoCache = [];
  return [];
}

// Получение конфигурации OurPool из окружения (аналогично calculator-engine.js)
function getOurPoolConfig() {
  const env = window.INFINITY_ENV || {};
  const baseUrl = env.OURPOOL_BASE_URL || "https://ourpool.io";
  const account = env.OURPOOL_ACCOUNT || "";
  const token = env.OURPOOL_TOKEN || "";

  // Также проверяем meta-теги
  const metaToken = document
    .querySelector('meta[name="ourpool-token"]')
    ?.getAttribute("content");
  const metaAccount = document
    .querySelector('meta[name="ourpool-account"]')
    ?.getAttribute("content");

  return {
    baseUrl,
    account: account || metaAccount || "",
    token: token || metaToken || "",
  };
}

// Получение транзакций из API OurPool
async function fetchTransactions({ baseUrl, account, token }) {
  // account и token больше не используются напрямую, но оставлены для обратной совместимости
  // В продакшене токен получается на сервере через PHP прокси
  try {
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // Формируем путь API (account будет заменен на сервере, если нужно)
    const accountPlaceholder = account
      ? encodeURIComponent(account)
      : "{account}";
    const apiPath = `/api/v1/accounts/${accountPlaceholder}/btc/transactions`;

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
  } catch (error) {
    console.warn("Failed to fetch transactions from OurPool API", error);
    return null;
  }
}

// Получение статистики наград из API OurPool
async function fetchRewardsStats({ baseUrl, account, token }) {
  // account и token больше не используются напрямую, но оставлены для обратной совместимости
  // В продакшене токен получается на сервере через PHP прокси
  try {
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
  } catch (error) {
    console.warn("Failed to fetch rewards stats from OurPool API", error);
    return null;
  }
}

// Преобразование транзакций в формат для графика с поддержкой масштабирования
function transformTransactionsToChartData(
  transactions,
  period,
  userPowerTh,
  zoomLevel = null,
  purchaseInfo = null
) {
  if (!transactions) return null;

  // API может вернуть массив напрямую или объект с массивом
  let txArray = null;
  if (Array.isArray(transactions)) {
    txArray = transactions;
  } else if (transactions.data && Array.isArray(transactions.data)) {
    txArray = transactions.data;
  } else if (
    transactions.transactions &&
    Array.isArray(transactions.transactions)
  ) {
    txArray = transactions.transactions;
  } else {
    return null;
  }

  // Получаем информацию о покупках
  const purchases = purchaseInfo || [];
  const purchase =
    Array.isArray(purchases) && purchases.length > 0 ? purchases[0] : null;

  // Фильтруем только транзакции типа "reward" или "mining"
  const rewardTransactions = txArray.filter(
    (tx) =>
      tx.type === "reward" ||
      tx.type === "mining" ||
      tx.type === "credit" ||
      (tx.amount && parseFloat(tx.amount) > 0) ||
      (tx.value && parseFloat(tx.value) > 0)
  );

  // Если нет транзакций наград, но есть дата покупки, создаем график с нулевой точкой
  if (rewardTransactions.length === 0 && !purchase) return null;

  // Получаем конфигурацию масштаба для периода
  const zoomConfig = ZOOM_CONFIG[period];
  const interval = zoomLevel || zoomConfig.default;

  // Определяем временной диапазон с учетом масштаба и даты покупки
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  let intervalMs = 0;
  let pointsCount = 0;
  let usePurchaseDate = false;

  // Если есть дата покупки, используем её как начальную точку
  if (purchase && purchase.date) {
    const purchaseDate = new Date(purchase.date);
    purchaseDate.setHours(0, 0, 0, 0);

    switch (period) {
      case "day":
        // Для дня показываем от начала текущего дня
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        // Для недели показываем от даты покупки до сегодня (максимум 7 дней)
        startDate = purchaseDate;
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        const daysDiff = Math.ceil(
          (endDate - startDate) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 7) {
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
        }
        usePurchaseDate = daysDiff <= 7;
        break;
      case "month":
        // Для месяца показываем от даты покупки до сегодня (максимум 30 дней)
        startDate = purchaseDate;
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        const daysDiffMonth = Math.ceil(
          (endDate - startDate) / (1000 * 60 * 60 * 24)
        );
        if (daysDiffMonth > 30) {
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 29);
          startDate.setHours(0, 0, 0, 0);
        }
        usePurchaseDate = daysDiffMonth <= 30;
        break;
    }
  } else {
    // Если нет даты покупки, используем стандартные диапазоны
    switch (period) {
      case "day":
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "month":
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
    }
  }

  // Рассчитываем количество точек и интервалы
  switch (period) {
    case "day":
      const hoursInDay = 24;
      pointsCount = Math.ceil(hoursInDay / interval);
      intervalMs = (hoursInDay / pointsCount) * 60 * 60 * 1000;
      break;
    case "week":
      const daysInWeek =
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      pointsCount = Math.ceil(daysInWeek / interval);
      intervalMs = (daysInWeek / pointsCount) * 24 * 60 * 60 * 1000;
      break;
    case "month":
      const daysInMonth =
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      pointsCount = Math.ceil(daysInMonth / interval);
      intervalMs = (daysInMonth / pointsCount) * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  // Группируем транзакции по интервалам
  const intervals = Array(pointsCount)
    .fill(0)
    .map((_, i) => {
      const intervalStart = new Date(startDate.getTime() + i * intervalMs);
      const intervalEnd = new Date(intervalStart.getTime() + intervalMs);
      return {
        start: intervalStart,
        end: intervalEnd,
        btc: 0,
        count: 0,
        isPurchaseDate: false,
      };
    });

  // Если есть дата покупки, отмечаем соответствующий интервал
  if (purchase && purchase.date && usePurchaseDate) {
    const purchaseDate = new Date(purchase.date);
    purchaseDate.setHours(0, 0, 0, 0);
    const purchaseIntervalIndex = intervals.findIndex(
      (interval) =>
        purchaseDate >= interval.start && purchaseDate < interval.end
    );
    if (purchaseIntervalIndex !== -1) {
      intervals[purchaseIntervalIndex].isPurchaseDate = true;
      intervals[purchaseIntervalIndex].purchaseAmount = purchase.amount || 0;
    }
  }

  // Распределяем транзакции по интервалам
  rewardTransactions.forEach((tx) => {
    // Пробуем разные форматы даты/времени
    const txDateStr =
      tx.timestamp ||
      tx.date ||
      tx.time ||
      tx.created_at ||
      tx.createdAt ||
      tx.datetime;
    if (!txDateStr) return;

    const txDate = new Date(txDateStr);
    if (isNaN(txDate.getTime())) return;

    const intervalIndex = intervals.findIndex(
      (interval) => txDate >= interval.start && txDate < interval.end
    );

    if (intervalIndex !== -1) {
      // Пробуем разные поля для суммы
      const amount = parseFloat(
        tx.amount || tx.value || tx.btc || tx.reward || 0
      );
      if (amount > 0) {
        intervals[intervalIndex].btc += amount;
        intervals[intervalIndex].count += 1;
      }
    }
  });

  // Формируем данные для графика с накопленной суммой
  const labels = [];
  const data = [];
  let cumulativeBtc = 0; // Накопленная добыча

  intervals.forEach((interval, index) => {
    let label = "";
    if (period === "day") {
      label = `${String(interval.start.getHours()).padStart(2, "0")}:00`;
    } else {
      label = `${String(interval.start.getDate()).padStart(2, "0")}.${String(
        interval.start.getMonth() + 1
      ).padStart(2, "0")}`;
    }

    labels.push(label);

    // Если это дата покупки, добыча = 0
    if (interval.isPurchaseDate) {
      cumulativeBtc = 0;
      data.push({
        time: label,
        btc: 0,
        rate: 0,
        isPurchase: true,
        purchaseAmount: interval.purchaseAmount || 0,
      });
    } else {
      // Накопленная добыча
      cumulativeBtc += interval.btc;

      // Рассчитываем скорость добычи
      let rate = 0;
      if (period === "day") {
        // BTC/час
        rate = interval.btc / interval;
      } else {
        // BTC/день
        rate = interval.btc / interval;
      }

      data.push({
        time: label,
        btc: cumulativeBtc, // Накопленная добыча
        rate: rate,
        dailyBtc: interval.btc, // Добыча за этот период
        isPurchase: false,
      });
    }
  });

  return { labels, data, zoomLevel: interval, purchaseInfo: purchase };
}

// Получение данных начислений из WordPress REST API
async function fetchAccrualsFromWordPress(period) {
  try {
    const nonce = window.INFINITY_REST_NONCE || "";
    const url = `/wp-json/infinity/v1/accruals?period=${period}`;
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-WP-Nonce": nonce,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 401 - не авторизован, возвращаем null для использования fallback
        console.warn("Unauthorized access to accruals API, using fallback");
      }
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn("Failed to fetch accruals from WordPress API", error);
    return null;
  }
}

// Преобразование данных из WordPress API в формат для графика
function transformWordPressAccrualsToChartData(apiData, period) {
  if (!apiData || !Array.isArray(apiData.data)) {
    return null;
  }

  const parseDateString = (value) => {
    if (!value) return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }
    return null;
  };

  const rootScope = typeof window !== "undefined" ? window : globalThis;

  const resolveRegistrationDate = () => {
    const sources = [
      apiData.registrationDate,
      rootScope?.INFINITY_USER_DATA?.registrationDate,
      rootScope?.INFINITY_USER_DATA?.user_registered,
      rootScope?.INFINITY_USER?.registrationDate,
      rootScope?.INFINITY_USER?.user_registered,
      rootScope?.INFINITY_PROFILE?.registrationDate,
      rootScope?.INFINITY_PROFILE?.user_registered,
    ];
    for (const candidate of sources) {
      const parsed = parseDateString(candidate);
      if (parsed) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    return null;
  };

  const registrationDate = resolveRegistrationDate();

  const bucketMap = new Map();

  apiData.data.forEach((item) => {
    const rawTimestamp =
      item.timestamp || item.hour_start || item.label || item.time;
    if (!rawTimestamp) {
      return;
    }

    const normalizedTimestamp = rawTimestamp
      .toString()
      .replace(" ", "T")
      .replace(/\.\d+Z$/, "Z");

    const date = new Date(normalizedTimestamp);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const bucketKey =
      period === "day"
        ? date.toISOString().slice(0, 13) // YYYY-MM-DDTHH
        : date.toISOString().slice(0, 10); // YYYY-MM-DD

    const label =
      period === "day"
        ? `${String(date.getHours()).padStart(2, "0")}:00`
        : `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

    const bucket = bucketMap.get(bucketKey) || {
      label,
      timestamp: date,
      btc: 0,
      usd: 0,
      powerSamples: [],
    };

    const btcValue = Number(item.btc_hourly ?? item.btc ?? 0) || 0;
    const usdValue = Number(item.usd ?? item.usd_accrual ?? 0) || 0;

    bucket.btc += btcValue;
    bucket.usd += usdValue;

    if (typeof item.power_th === "number" && !Number.isNaN(item.power_th)) {
      bucket.powerSamples.push(item.power_th);
    }

    bucketMap.set(bucketKey, bucket);
  });

  const buckets = Array.from(bucketMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prependZeroBucket = (date) => {
    const label =
      period === "day"
        ? `${String(date.getHours()).padStart(2, "0")}:00`
        : `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

    return {
      label,
      timestamp: new Date(date),
      btc: 0,
      usd: 0,
      bucketValue: 0,
      rate: 0,
      powerSamples: [],
      powerTh: 0,
    };
  };

  if (registrationDate && (period === "week" || period === "month")) {
    const baseStart = new Date(today);
    if (period === "week") {
      baseStart.setDate(baseStart.getDate() - 6);
    } else if (period === "month") {
      baseStart.setDate(baseStart.getDate() - 29);
    }
    baseStart.setHours(0, 0, 0, 0);

    const desiredStart =
      registrationDate > baseStart ? registrationDate : baseStart;

    if (buckets.length === 0) {
      let cursor = new Date(desiredStart);
      const end = new Date(today);
      while (cursor <= end) {
        buckets.push(prependZeroBucket(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const firstBucketDate = new Date(buckets[0].timestamp);
      firstBucketDate.setHours(0, 0, 0, 0);

      if (firstBucketDate > desiredStart) {
        const fillers = [];
        const cursor = new Date(desiredStart);
        while (cursor < firstBucketDate) {
          fillers.push(prependZeroBucket(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
        buckets.unshift(...fillers);
      }
    }
  }

  if (buckets.length === 0) {
    return null;
  }

  const labels = [];
  const data = [];

  buckets.forEach((bucket) => {
    labels.push(bucket.label);

    const averagePower =
      bucket.powerSamples.length > 0
        ? bucket.powerSamples.reduce((sum, value) => sum + value, 0) /
          bucket.powerSamples.length
        : 0;

    data.push({
      time: bucket.label,
      btc: bucket.btc,
      bucketValue: bucket.btc,
      rate: bucket.btc,
      usd: bucket.usd,
      isPurchase: false,
      timestamp: bucket.timestamp.toISOString(),
      powerTh: averagePower,
    });
  });

  return {
    labels,
    data,
    zoomLevel: null,
    purchaseInfo: null,
    currentHour: apiData.current_hour,
    endDate: apiData.end_date,
    isGenerated: false,
    supportsZoom: false,
  };
}

// Получение данных из API (если доступно)
async function fetchMiningData(period, userPowerTh) {
  // Приоритет: WordPress REST API с фактическими начислениями
  const wpData = await fetchAccrualsFromWordPress(period);

  // Сохраняем registrationDate в глобальных данных для использования в generateChartData
  if (wpData && wpData.registrationDate) {
    if (!window.INFINITY_USER_DATA) {
      window.INFINITY_USER_DATA = {};
    }
    window.INFINITY_USER_DATA.registrationDate = wpData.registrationDate;
  }

  if (wpData && wpData.data && wpData.data.length > 0) {
    const chartData = transformWordPressAccrualsToChartData(wpData, period);
    if (chartData) {
      return { data: chartData, stats: null, purchaseInfo: null };
    }
  }

  // Fallback: старый метод через OurPool API (для совместимости)
  const config = getOurPoolConfig();
  if (!config.account || !config.token) {
    return { data: null, stats: null };
  }

  try {
    // Пытаемся получить транзакции и статистику параллельно
    const [transactions, stats] = await Promise.all([
      fetchTransactions(config),
      fetchRewardsStats(config),
    ]);

    // Если есть транзакции, используем их
    if (transactions) {
      const purchaseInfo = await getPurchaseInfo(); // Берем из WordPress, не из транзакций
      const chartData = transformTransactionsToChartData(
        transactions,
        period,
        userPowerTh,
        null, // используем масштаб по умолчанию
        purchaseInfo
      );
      if (chartData && chartData.data.length > 0) {
        return { data: chartData, stats, purchaseInfo };
      }
    }

    // Если транзакций нет, возвращаем статистику для использования в генерации
    const purchaseInfo = await getPurchaseInfo(); // Берем из WordPress
    return { data: null, stats, purchaseInfo };
  } catch (error) {
    console.warn("API недоступно, используем сгенерированные данные", error);
    const purchaseInfo = await getPurchaseInfo(); // Берем из WordPress
    return { data: null, stats: null, purchaseInfo };
  }
}

// Конфигурация масштабирования для каждого периода
// Интервал определяет шаг между точками, но временной диапазон всегда полный
const ZOOM_CONFIG = {
  day: {
    default: 3, // часов между точками по умолчанию (8 точек за день)
    min: 1, // минимальный интервал (1 час = 24 точки)
    max: 6, // максимальный интервал (6 часов = 4 точки)
    step: 1, // шаг изменения
    totalHours: 24, // всегда 24 часа
  },
  week: {
    default: 1, // день между точками по умолчанию (7 точек)
    min: 0.5, // минимальный интервал (12 часов = 14 точек)
    max: 2, // максимальный интервал (2 дня = 4 точки)
    step: 0.5, // шаг изменения
    totalDays: 7, // всегда 7 дней
  },
  month: {
    default: 1, // день между точками по умолчанию (30 точек)
    min: 0.5, // минимальный интервал (12 часов = 60 точек)
    max: 3, // максимальный интервал (3 дня = 10 точек)
    step: 0.5, // шаг изменения
    totalDays: 30, // всегда 30 дней
  },
};

// Генерация пустого графика (когда мощность = 0 или нет покупок)
function generateEmptyChartData(period, userPowerTh) {
  const data = [];
  const labels = [];
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Получаем дату регистрации
  const registrationDate =
    window.INFINITY_USER_DATA?.registrationDate ||
    window.INFINITY_USER_DATA?.user_registered ||
    null;

  let startDate = today;
  if (registrationDate) {
    startDate = new Date(registrationDate);
    startDate.setHours(0, 0, 0, 0);
  }

  switch (period) {
    case "day":
      // За день - от 00:00 до текущего часа
      const currentHour = Math.floor(now.getHours());
      for (let hour = 0; hour <= currentHour; hour++) {
        labels.push(`${String(hour).padStart(2, "0")}:00`);
        data.push({
          time: `${String(hour).padStart(2, "0")}:00`,
          btc: 0,
          rate: 0,
          dailyBtc: 0,
          bucketValue: 0,
          isPurchase: false,
        });
      }
      break;

    case "week":
      // За неделю - от даты регистрации или последние 7 дней
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekStart =
        registrationDate && new Date(registrationDate) > weekAgo
          ? new Date(registrationDate)
          : weekAgo;
      weekStart.setHours(0, 0, 0, 0);

      for (
        let d = new Date(weekStart);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;
        labels.push(dayLabel);
        data.push({
          time: dayLabel,
          btc: 0,
          rate: 0,
          dailyBtc: 0,
          bucketValue: 0,
          isPurchase: false,
        });
      }
      break;

    case "month":
      // За месяц - от даты регистрации или последние 30 дней
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      const monthStart =
        registrationDate && new Date(registrationDate) > monthAgo
          ? new Date(registrationDate)
          : monthAgo;
      monthStart.setHours(0, 0, 0, 0);

      for (
        let d = new Date(monthStart);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;
        labels.push(dayLabel);
        data.push({
          time: dayLabel,
          btc: 0,
          rate: 0,
          dailyBtc: 0,
          bucketValue: 0,
          isPurchase: false,
        });
      }
      break;
  }

  return {
    labels,
    data,
    zoomLevel: null,
    purchaseInfo: null,
    isGenerated: true,
    supportsZoom: false,
  };
}

// Генерация данных для графика на основе периода с учетом масштаба
// Использует формулу из calculator-engine.js для расчета добычи
async function generateChartData(
  period,
  userPowerTh,
  apiStats = null,
  zoomLevel = null,
  purchaseInfo = null
) {
  const data = [];
  let labels = [];

  // Получаем список пополнений
  const purchases = purchaseInfo || (await getPurchaseInfo());

  // Если нет пополнений или мощность = 0, показываем график с нулями
  if (!purchases || purchases.length === 0 || userPowerTh <= 0) {
    // Генерируем график с нулями для текущего периода
    return generateEmptyChartData(period, userPowerTh);
  }

  // Используем данные из API, если доступны
  let btcPerThPerDay = YIELD_CONFIG.btcPerThPerDay;
  let uptimePercent = YIELD_CONFIG.uptimePercent;

  if (apiStats) {
    // Пробуем извлечь данные из статистики API
    const btcPerThCandidates = [
      apiStats.btcPerThPerDay,
      apiStats.btc_per_th_per_day,
      apiStats.btc_per_th_day,
      apiStats.perThPerDayBtc,
      apiStats.per_th_per_day_btc,
      apiStats?.daily?.btcPerTh,
      apiStats?.daily?.btc_per_th,
    ].filter((v) => typeof v === "number" && isFinite(v) && v > 0);
    if (btcPerThCandidates.length) {
      btcPerThPerDay = btcPerThCandidates[0];
    }

    const uptimeCandidates = [
      apiStats.uptimePercent,
      apiStats.uptime_percent,
      apiStats.uptime,
      apiStats.uptime_avg,
      apiStats?.daily?.uptime,
    ].filter((v) => typeof v === "number" && isFinite(v) && v >= 0);
    if (uptimeCandidates.length) {
      let u = uptimeCandidates[0];
      if (u <= 1) u = u * 100; // Конвертируем из 0..1 в проценты
      uptimePercent = Math.max(0, Math.min(100, u));
    }
  }

  // Конфигурация для расчета добычи (как в calculator-engine.js)
  const yieldConfig = {
    btcPerThPerDay,
    uptimePercent,
  };

  // Получаем конфигурацию масштаба для периода
  const zoomConfig = ZOOM_CONFIG[period];
  const interval = zoomLevel || zoomConfig.default;

  // Определяем дату начала (дата регистрации или первое пополнение)
  // Сначала пытаемся получить дату регистрации из глобальных данных
  const registrationDate =
    window.INFINITY_USER_DATA?.registrationDate ||
    window.INFINITY_USER_DATA?.user_registered ||
    null;

  let startDate = null;
  if (registrationDate) {
    // Используем дату регистрации
    startDate = new Date(registrationDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback: используем дату первой покупки
    const firstPurchase =
      purchases && purchases.length > 0 ? purchases[0] : null;
    if (!firstPurchase || !firstPurchase.date) {
      // Если нет валидной даты, возвращаем пустой график
      return generateEmptyChartData(period, userPowerTh);
    }
    startDate = new Date(firstPurchase.date);
    startDate.setHours(0, 0, 0, 0);
  }

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  // Текущий день (для ограничения правой границы графика)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cumulativeBtc = 0; // Накопленная добыча
  let currentPowerTh = 0; // Текущая мощность (накапливается при пополнениях)

  // Вспомогательная функция для расчета добычи за день
  const getDailyBtc = (powerTh) => calculateDailyBtc(powerTh, yieldConfig);

  // Вспомогательная функция для проверки, является ли дата днем пополнения
  const isPurchaseDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return purchases.some((p) => {
      const pDate = new Date(p.date);
      pDate.setHours(0, 0, 0, 0);
      return pDate.toISOString().split("T")[0] === dateStr;
    });
  };

  // Вспомогательная функция для получения информации о пополнении на дату
  const getPurchaseOnDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return purchases.find((p) => {
      const pDate = new Date(p.date);
      pDate.setHours(0, 0, 0, 0);
      return pDate.toISOString().split("T")[0] === dateStr;
    });
  };

  // Вспомогательная функция для получения текущей мощности на дату
  // Учитывает выводы (когда мощность становится 0)
  const getPowerOnDate = (date) => {
    let power = 0;
    let lastWithdrawalDate = null;

    // Проходим по всем покупкам и выводам в хронологическом порядке
    for (const purchase of purchases) {
      const pDate = new Date(purchase.date);
      pDate.setHours(0, 0, 0, 0);

      if (pDate <= date) {
        // Если это вывод (мощность становится 0 или отрицательной)
        if (
          purchase.powerTh < 0 ||
          purchase.type === "withdrawal" ||
          purchase.type === "debit"
        ) {
          power = 0;
          lastWithdrawalDate = pDate;
        } else {
          // Пополнение - добавляем мощность
          power += purchase.powerTh || 0;
        }
      }
    }

    // Если был вывод после последнего пополнения и до текущей даты, мощность = 0
    if (lastWithdrawalDate) {
      const hasPurchaseAfterWithdrawal = purchases.some((p) => {
        const pDate = new Date(p.date);
        pDate.setHours(0, 0, 0, 0);
        return (
          pDate > lastWithdrawalDate &&
          pDate <= date &&
          p.powerTh > 0 &&
          p.type !== "withdrawal" &&
          p.type !== "debit"
        );
      });

      if (!hasPurchaseAfterWithdrawal && lastWithdrawalDate <= date) {
        // Проверяем, есть ли пополнения после вывода
        const purchasesAfterWithdrawal = purchases.filter((p) => {
          const pDate = new Date(p.date);
          pDate.setHours(0, 0, 0, 0);
          return (
            pDate > lastWithdrawalDate &&
            pDate <= date &&
            p.powerTh > 0 &&
            p.type !== "withdrawal" &&
            p.type !== "debit"
          );
        });

        if (purchasesAfterWithdrawal.length === 0) {
          power = 0;
        }
      }
    }

    return Math.max(0, power);
  };

  switch (period) {
    case "day":
      // За день - от 00:00 до текущего часа (не забегаем вперёд)
      // Текущий час, округлённый вниз (правая граница графика)
      const currentHour = Math.floor(now.getHours());
      const maxHour = currentHour; // Не показываем будущие часы

      // Проверяем, есть ли пополнение сегодня
      const todayPurchase = getPurchaseOnDate(today);

      // Количество часов от 0 до текущего часа включительно
      const hoursInDay = maxHour + 1;
      const pointsCount = Math.ceil(hoursInDay / interval);

      // Если есть пополнение сегодня, добавляем точку в 00:00
      if (todayPurchase) {
        labels.push("00:00");
        data.push({
          time: "00:00",
          btc: 0,
          rate: 0,
          isPurchase: true,
          purchaseAmount: todayPurchase.amount || 0,
          purchasePowerTh: todayPurchase.powerTh || 0,
        });
        currentPowerTh += todayPurchase.powerTh || 0;
        cumulativeBtc = 0;
      } else {
        // Если нет пополнения сегодня, берем текущую мощность
        currentPowerTh = getPowerOnDate(today);
      }

      // Генерируем точки только до текущего часа
      const startIndex = todayPurchase ? 1 : 0;
      for (let i = startIndex; i < pointsCount; i++) {
        let hour;
        if (i === 0) {
          hour = 0;
        } else if (i === pointsCount - 1) {
          hour = maxHour; // Последняя точка - текущий час
        } else {
          hour = Math.floor((i * hoursInDay) / (pointsCount - 1));
        }

        // Не генерируем точки за будущие часы
        if (hour > maxHour) {
          break;
        }

        // Если мощность = 0, добыча = 0
        if (currentPowerTh <= 0) {
          labels.push(`${String(Math.floor(hour)).padStart(2, "0")}:00`);
          data.push({
            time: `${String(Math.floor(hour)).padStart(2, "0")}:00`,
            btc: cumulativeBtc, // Сохраняем накопленную сумму
            rate: 0,
            dailyBtc: 0,
            isPurchase: false,
          });
          continue;
        }

        // Рассчитываем добычу за интервал по формуле из calculator-engine.js
        const dailyBtc = getDailyBtc(currentPowerTh);
        const hourBtc = (dailyBtc / 24) * interval;
        cumulativeBtc += hourBtc;

        labels.push(`${String(Math.floor(hour)).padStart(2, "0")}:00`);
        data.push({
          time: `${String(Math.floor(hour)).padStart(2, "0")}:00`,
          btc: cumulativeBtc,
          rate: hourBtc / interval,
          dailyBtc: hourBtc,
          isPurchase: false,
        });
      }
      break;

    case "week":
      // За неделю - от даты первого пополнения до сегодня (максимум 7 дней)
      // Правая граница - текущий день (не забегаем вперёд)
      let weekStartDate = new Date(startDate);
      const weekEndDate = new Date(now);
      weekEndDate.setHours(23, 59, 59, 999);

      let daysInWeek =
        Math.ceil((weekEndDate - weekStartDate) / (1000 * 60 * 60 * 24)) + 1;
      if (daysInWeek > 7) {
        weekStartDate = new Date(weekEndDate);
        weekStartDate.setDate(weekStartDate.getDate() - 6);
        weekStartDate.setHours(0, 0, 0, 0);
        daysInWeek = 7;
      }

      // Ограничиваем правую границу текущим днём
      if (weekEndDate > today) {
        weekEndDate.setTime(today.getTime());
        weekEndDate.setHours(23, 59, 59, 999);
      }

      // Генерируем точки для каждого дня (только до сегодня)
      const processedDates = new Set();

      for (let dayOffset = 0; dayOffset < daysInWeek; dayOffset++) {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

        // Не генерируем точки за будущие дни
        if (date > today) {
          break;
        }

        const dateKey = date.toISOString().split("T")[0];
        if (processedDates.has(dateKey)) continue;
        processedDates.add(dateKey);

        // Проверяем, есть ли пополнение в этот день
        const purchase = getPurchaseOnDate(date);

        if (purchase) {
          // Точка пополнения
          currentPowerTh += purchase.powerTh || 0;
          cumulativeBtc = 0; // Сбрасываем накопленную добычу в день пополнения

          const dayLabel = `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          labels.push(dayLabel);
          data.push({
            time: dayLabel,
            btc: 0,
            rate: 0,
            isPurchase: true,
            purchaseAmount: purchase.amount || 0,
            purchasePowerTh: purchase.powerTh || 0,
          });
        } else {
          // Обычный день - рассчитываем добычу
          const dayPower = getPowerOnDate(date);

          // Если мощность = 0, добыча = 0, но сохраняем накопленную сумму до этого момента
          if (dayPower <= 0) {
            // После вывода добыча становится 0, но предыдущие данные сохраняются
            const dayLabel = `${String(date.getDate()).padStart(
              2,
              "0"
            )}.${String(date.getMonth() + 1).padStart(2, "0")}`;
            labels.push(dayLabel);
            data.push({
              time: dayLabel,
              btc: cumulativeBtc, // Сохраняем накопленную сумму
              rate: 0,
              dailyBtc: 0,
              isPurchase: false,
            });
            // Не увеличиваем cumulativeBtc, так как добыча = 0
            continue;
          }

          const dailyBtc = getDailyBtc(dayPower);
          cumulativeBtc += dailyBtc;

          const dayLabel = `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          labels.push(dayLabel);
          data.push({
            time: dayLabel,
            btc: cumulativeBtc,
            rate: dailyBtc,
            dailyBtc: dailyBtc,
            isPurchase: false,
          });
        }
      }
      break;

    case "month":
      // За месяц - от даты первого пополнения до сегодня (максимум 30 дней)
      // Правая граница - текущий день (не забегаем вперёд)
      let monthStartDate = new Date(startDate);
      let monthEndDate = new Date(now);
      monthEndDate.setHours(23, 59, 59, 999);

      let daysInMonth =
        Math.ceil((monthEndDate - monthStartDate) / (1000 * 60 * 60 * 24)) + 1;
      if (daysInMonth > 30) {
        monthStartDate = new Date(monthEndDate);
        monthStartDate.setDate(monthStartDate.getDate() - 29);
        monthStartDate.setHours(0, 0, 0, 0);
        daysInMonth = 30;
      }

      // Ограничиваем правую границу текущим днём
      if (monthEndDate > today) {
        monthEndDate.setTime(today.getTime());
        monthEndDate.setHours(23, 59, 59, 999);
      }

      // Генерируем точки для каждого дня (с учетом интервала, только до сегодня)
      const monthProcessedDates = new Set();
      const monthPointsCount = Math.ceil(daysInMonth / interval);

      for (let i = 0; i < monthPointsCount; i++) {
        const dayOffset = Math.floor((i * daysInMonth) / monthPointsCount);
        if (dayOffset >= daysInMonth) break;

        const date = new Date(monthStartDate);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

        // Не генерируем точки за будущие дни
        if (date > today) {
          break;
        }

        const dateKey = date.toISOString().split("T")[0];
        if (monthProcessedDates.has(dateKey)) continue;
        monthProcessedDates.add(dateKey);

        // Проверяем, есть ли пополнение в этот день
        const purchase = getPurchaseOnDate(date);

        if (purchase) {
          // Точка пополнения
          currentPowerTh += purchase.powerTh || 0;
          cumulativeBtc = 0; // Сбрасываем накопленную добычу в день пополнения

          const dayLabel = `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          labels.push(dayLabel);
          data.push({
            time: dayLabel,
            btc: 0,
            rate: 0,
            isPurchase: true,
            purchaseAmount: purchase.amount || 0,
            purchasePowerTh: purchase.powerTh || 0,
          });
        } else {
          // Обычный день - рассчитываем добычу
          const dayPower = getPowerOnDate(date);

          // Если мощность = 0, добыча = 0, но сохраняем накопленную сумму до этого момента
          if (dayPower <= 0) {
            // После вывода добыча становится 0, но предыдущие данные сохраняются
            const dayLabel = `${String(date.getDate()).padStart(
              2,
              "0"
            )}.${String(date.getMonth() + 1).padStart(2, "0")}`;
            labels.push(dayLabel);
            data.push({
              time: dayLabel,
              btc: cumulativeBtc, // Сохраняем накопленную сумму
              rate: 0,
              dailyBtc: 0,
              isPurchase: false,
            });
            // Не увеличиваем cumulativeBtc, так как добыча = 0
            continue;
          }

          const dailyBtc = getDailyBtc(dayPower);
          cumulativeBtc += dailyBtc;

          const dayLabel = `${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          labels.push(dayLabel);
          data.push({
            time: dayLabel,
            btc: cumulativeBtc,
            rate: dailyBtc,
            dailyBtc: dailyBtc,
            isPurchase: false,
          });
        }
      }
      break;
  }

  return { labels, data, zoomLevel: interval, purchaseInfo: purchases };
}

// Создание графика с поддержкой масштабирования
async function createChart(canvasId, period, userPowerTh, zoomLevel = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Пытаемся получить данные из API, если нет - генерируем
  const apiResult = await fetchMiningData(period, userPowerTh);
  let chartDataResult = apiResult.data || null;

  if (!chartDataResult) {
    chartDataResult = generateEmptyChartData(period, userPowerTh);
  }

  const { labels, data, zoomLevel: currentZoom } = chartDataResult;
  const datasetValues = data.map((row) => {
    if (typeof row.bucketValue === "number") {
      return row.bucketValue;
    }
    if (typeof row.dailyBtc === "number") {
      return row.dailyBtc;
    }
    if (typeof row.rate === "number") {
      return row.rate;
    }
    return row.btc || 0;
  });

  // Определяем единицу скорости для tooltip
  const rateUnit = period === "day" ? "BTC/час" : "BTC/день";

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Добыча BTC",
          data: datasetValues,
          borderColor: "#000000",
          pointBackgroundColor: "#000000",
          pointBorderColor: "#000000",
          pointRadius: 4,
          pointHoverRadius: 10,
          pointHoverBorderWidth: 3,
          pointBorderWidth: 7,
          borderWidth: 5,
          tension: 0.4,
          pointHoverBackgroundColor: "#000000",
          pointHoverBorderColor: "#000000",
          _rawData: data,
          _rateUnit: rateUnit,
          _period: period,
          _userPowerTh: userPowerTh,
          _apiStats: apiResult.stats,
          _zoomLevel: currentZoom || ZOOM_CONFIG[period].default,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      onHover: (event, activeElements) => {
        // Изменяем курсор при наведении на график
        event.native.target.style.cursor =
          activeElements.length > 0 ? "pointer" : "default";
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          titleFont: {
            size: 14,
            weight: "bold",
          },
          bodyFont: {
            size: 13,
          },
          displayColors: false,
          callbacks: {
            title: function (context) {
              const index = context[0].dataIndex;
              const rawData = context[0].dataset._rawData;
              return rawData ? rawData[index].time : context[0].label;
            },
            label: function (context) {
              const index = context.dataIndex;
              const rawData = context.dataset._rawData;
              const rateUnit = context.dataset._rateUnit;
              const btcValue = context.parsed.y;
              const dataPoint = rawData ? rawData[index] : null;

              if (dataPoint && dataPoint.isPurchase) {
                // Для точки покупки показываем сумму пополнения
                const purchaseAmount = dataPoint.purchaseAmount || 0;
                return [
                  `Сумма пополнения: ${
                    purchaseAmount > 0 ? purchaseAmount.toFixed(2) + " $" : "—"
                  }`,
                  `Добыто: 0 BTC`,
                ];
              } else {
                // Для остальных точек показываем накопленную добычу и скорость
                const rate = dataPoint ? dataPoint.rate : 0;
                const dailyBtc =
                  typeof dataPoint.bucketValue === "number"
                    ? dataPoint.bucketValue
                    : dataPoint?.dailyBtc || 0;
                return [
                  `Добыто: ${btcValue.toFixed(8)} BTC`,
                  dailyBtc > 0
                    ? `За период: ${dailyBtc.toFixed(8)} BTC`
                    : `Скорость: ${rate.toFixed(8)} ${rateUnit}`,
                ];
              }
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 12,
            },
            color: "rgba(0, 0, 0, 0.6)",
          },
          // Для категориальной оси min/max не работают, но мы гарантируем
          // что первая точка 00:00, а последняя 24:00 в generateChartData
        },
        y: {
          min: 0,
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
            lineWidth: 1,
          },
          ticks: {
            font: {
              size: 12,
            },
            color: "rgba(0, 0, 0, 0.6)",
            callback: function (value) {
              return value.toFixed(9) + " BTC";
            },
          },
        },
      },
    },
  });

  // Добавляем обработчик масштабирования при скролле
  if (chartDataResult.supportsZoom) {
    setupZoomHandler(chart, canvas, period, userPowerTh, apiResult.stats);
  }

  return chart;
}

// Настройка обработчика масштабирования для графика
function setupZoomHandler(chart, canvas, period, userPowerTh, apiStats) {
  const zoomConfig = ZOOM_CONFIG[period];
  let currentZoom = chart.data.datasets[0]._zoomLevel || zoomConfig.default;
  let isZooming = false;
  let zoomTimeout = null;

  const handleWheel = async (e) => {
    e.preventDefault();

    // Очищаем предыдущий таймер, если он есть
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
    }

    // Откладываем обновление на небольшую задержку для плавности
    zoomTimeout = setTimeout(async () => {
      if (isZooming) return;

      const delta = e.deltaY > 0 ? -zoomConfig.step : zoomConfig.step;
      const newZoom = Math.max(
        zoomConfig.min,
        Math.min(zoomConfig.max, currentZoom + delta)
      );

      if (newZoom === currentZoom) return;

      isZooming = true;
      currentZoom = newZoom;

      // Пытаемся получить данные из API с новым масштабом
      const config = getOurPoolConfig();
      let newData = null;

      if (config.account && config.token) {
        try {
          const transactions = await fetchTransactions(config);
          if (transactions) {
            const purchaseInfo = await getPurchaseInfo(); // Берем из WordPress
            const chartData = transformTransactionsToChartData(
              transactions,
              period,
              userPowerTh,
              currentZoom,
              purchaseInfo
            );
            if (chartData && chartData.data.length > 0) {
              newData = chartData;
            }
          }
        } catch (error) {
          console.warn("Failed to fetch transactions for zoom", error);
        }
      }

      // Если данных из API нет, генерируем
      if (!newData) {
        // Получаем информацию о покупках из WordPress
        const purchaseInfo = await getPurchaseInfo();

        newData = await generateChartData(
          period,
          userPowerTh,
          apiStats,
          currentZoom,
          purchaseInfo
        );
      }

      // Обновляем график с плавной анимацией
      chart.data.labels = newData.labels;
      chart.data.datasets[0].data = newData.data.map((row) => row.btc);
      chart.data.datasets[0]._rawData = newData.data;
      chart.data.datasets[0]._zoomLevel = currentZoom;

      // Используем плавную анимацию вместо "none"
      chart.update({
        duration: 300, // Длительность анимации в миллисекундах
        easing: "easeOutQuart", // Тип анимации (плавное замедление)
      });

      isZooming = false;
    }, 50); // Небольшая задержка для группировки быстрых скроллов
  };

  canvas.addEventListener("wheel", handleWheel, { passive: false });

  // Сохраняем ссылку на обработчик для возможного удаления
  chart._zoomHandler = handleWheel;
}

// Инициализация компонента графиков
export function initCharts() {
  const chartsContainer = document.querySelector(".p-main__charts");
  if (!chartsContainer) return;

  const tabInputs = chartsContainer.querySelectorAll(
    'input[name="доходность"]'
  );
  const graphs = chartsContainer.querySelectorAll(".p-main__graph");

  if (tabInputs.length === 0 || graphs.length === 0) return;

  // Получаем мощности пользователя
  const userPowerTh = getUserPower();

  // Создаем графики для каждого периода
  const charts = {
    day: null,
    week: null,
    month: null,
  };

  // Инициализируем все графики асинхронно
  const initPromise = (async () => {
    charts.day = await createChart("chart_day", "day", userPowerTh, null);
    charts.week = await createChart("chart_week", "week", userPowerTh, null);
    charts.month = await createChart("chart_month", "month", userPowerTh, null);
  })();

  // Функция переключения графиков
  function switchChart(period) {
    const graphPeriods = ["day", "week", "month"];
    graphs.forEach((graph, index) => {
      if (graphPeriods[index] === period) {
        graph.classList.remove("is_hidden");
      } else {
        graph.classList.add("is_hidden");
      }
    });
  }

  // Обработчики для табов
  tabInputs.forEach((input, index) => {
    const periods = ["day", "week", "month"];
    const period = periods[index];

    input.addEventListener("change", () => {
      if (input.checked) {
        switchChart(period);
      }
    });
  });

  // Устанавливаем активный график по умолчанию (день)
  if (tabInputs[0]) {
    tabInputs[0].checked = true;
    switchChart("day");
  }

  // Возвращаем API для обновления данных
  return {
    ready: initPromise,
    updateUserPower: async (newPowerTh) => {
      // Обновляем все графики с новыми данными
      if (charts.day) charts.day.destroy();
      if (charts.week) charts.week.destroy();
      if (charts.month) charts.month.destroy();

      charts.day = await createChart("chart_day", "day", newPowerTh, null);
      charts.week = await createChart("chart_week", "week", newPowerTh, null);
      charts.month = await createChart(
        "chart_month",
        "month",
        newPowerTh,
        null
      );

      // Восстанавливаем активный график
      const activeInput = Array.from(tabInputs).find((input) => input.checked);
      if (activeInput) {
        const index = Array.from(tabInputs).indexOf(activeInput);
        const periods = ["day", "week", "month"];
        switchChart(periods[index]);
      } else {
        if (tabInputs[0]) {
          tabInputs[0].checked = true;
          switchChart("day");
        }
      }
    },
    getCharts: () => charts,
  };
}

// Экспорт функций API для использования в других модулях
export { fetchTransactions, fetchRewardsStats, getOurPoolConfig };

// Автоматическая инициализация при загрузке DOM (если не инициализируется извне)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initCharts();
  });
} else {
  // DOM уже загружен
  initCharts();
}
