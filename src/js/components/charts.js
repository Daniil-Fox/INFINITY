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

    // Chart.js автоматически обрабатывает hover, мы только улучшаем визуальные эффекты
    // Увеличение точек происходит через pointHoverRadius в конфигурации
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

// Получение данных о пополнениях из глобальной переменной или заглушки
// В WordPress эти данные будут передаваться через window.INFINITY_USER_DATA
function getPurchaseInfo() {
  // Пытаемся получить данные из глобальной переменной (WordPress)
  const userData = window.INFINITY_USER_DATA || {};

  if (
    userData.purchases &&
    Array.isArray(userData.purchases) &&
    userData.purchases.length > 0
  ) {
    // Сортируем по дате (от старых к новым)
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
      return sortedPurchases;
    }
  }

  // Заглушка: первое пополнение 06.11, 100 TH
  const currentYear = new Date().getFullYear();
  const purchaseDate = new Date(currentYear, 10, 6); // 6 ноября (месяц 10, т.к. 0-11)
  purchaseDate.setHours(0, 0, 0, 0);

  return [
    {
      date: purchaseDate,
      amount: 0, // Сумма в долларах (пока неизвестна)
      powerTh: 100, // Мощности в TH
    },
  ];
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
  if (!account || !token) return null;
  try {
    // В режиме разработки используем прокси, в продакшене - прямой запрос
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const apiPath = `/api/v1/accounts/${encodeURIComponent(
      account
    )}/btc/transactions?token=${encodeURIComponent(token)}`;
    const url = isDev ? apiPath : `${baseUrl}${apiPath}`;

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
  if (!account || !token) return null;
  try {
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
  const purchases = purchaseInfo || getPurchaseInfo();

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

// Получение данных из API (если доступно)
async function fetchMiningData(period, userPowerTh) {
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
      const purchaseInfo = getPurchaseInfo(); // Берем из WordPress, не из транзакций
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
    const purchaseInfo = getPurchaseInfo(); // Берем из WordPress
    return { data: null, stats, purchaseInfo };
  } catch (error) {
    console.warn("API недоступно, используем сгенерированные данные", error);
    const purchaseInfo = getPurchaseInfo(); // Берем из WordPress
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
  const purchases = purchaseInfo || getPurchaseInfo();
  if (!purchases || purchases.length === 0) {
    // Если нет пополнений, возвращаем пустые данные
    return { labels: [], data: [], zoomLevel: null, purchaseInfo: null };
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

  // Определяем дату начала (первое пополнение)
  const firstPurchase = purchases[0];
  const startDate = new Date(firstPurchase.date);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(23, 59, 59, 999);

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
  const getPowerOnDate = (date) => {
    let power = 0;
    for (const purchase of purchases) {
      const pDate = new Date(purchase.date);
      pDate.setHours(0, 0, 0, 0);
      if (pDate <= date) {
        power += purchase.powerTh || 0;
      }
    }
    return power;
  };

  switch (period) {
    case "day":
      // За день - всегда от 00:00 до 24:00 текущего дня
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Проверяем, есть ли пополнение сегодня
      const todayPurchase = getPurchaseOnDate(today);

      const hoursInDay = 24;
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

      // Генерируем точки равномерно распределенные от 0 до 24 часов
      const startIndex = todayPurchase ? 1 : 0;
      for (let i = startIndex; i < pointsCount; i++) {
        let hour;
        if (i === 0) {
          hour = 0;
        } else if (i === pointsCount - 1) {
          hour = 24;
        } else {
          hour = (i * hoursInDay) / (pointsCount - 1);
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
      let weekStartDate = new Date(startDate);
      const weekEndDate = new Date(now);

      let daysInWeek =
        Math.ceil((weekEndDate - weekStartDate) / (1000 * 60 * 60 * 24)) + 1;
      if (daysInWeek > 7) {
        weekStartDate = new Date(weekEndDate);
        weekStartDate.setDate(weekStartDate.getDate() - 6);
        weekStartDate.setHours(0, 0, 0, 0);
        daysInWeek = 7;
      }

      // Генерируем точки для каждого дня
      const processedDates = new Set();

      for (let dayOffset = 0; dayOffset < daysInWeek; dayOffset++) {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

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
      let monthStartDate = new Date(startDate);
      const monthEndDate = new Date(now);

      let daysInMonth =
        Math.ceil((monthEndDate - monthStartDate) / (1000 * 60 * 60 * 24)) + 1;
      if (daysInMonth > 30) {
        monthStartDate = new Date(monthEndDate);
        monthStartDate.setDate(monthStartDate.getDate() - 29);
        monthStartDate.setHours(0, 0, 0, 0);
        daysInMonth = 30;
      }

      // Генерируем точки для каждого дня (с учетом интервала)
      const monthProcessedDates = new Set();
      const monthPointsCount = Math.ceil(daysInMonth / interval);

      for (let i = 0; i < monthPointsCount; i++) {
        const dayOffset = Math.floor((i * daysInMonth) / monthPointsCount);
        if (dayOffset >= daysInMonth) break;

        const date = new Date(monthStartDate);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

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
  let chartDataResult = apiResult.data
    ? {
        labels: apiResult.data.labels,
        data: apiResult.data.data,
        zoomLevel: null,
        purchaseInfo: apiResult.purchaseInfo,
      }
    : await generateChartData(
        period,
        userPowerTh,
        apiResult.stats,
        zoomLevel,
        apiResult.purchaseInfo
      );

  const { labels, data, zoomLevel: currentZoom } = chartDataResult;

  // Определяем единицу скорости для tooltip
  const rateUnit = period === "day" ? "BTC/час" : "BTC/день";

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Добыча BTC",
          data: data.map((row) => row.btc),
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
                const dailyBtc = dataPoint ? dataPoint.dailyBtc : 0;
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
              return value.toFixed(6) + " BTC";
            },
          },
        },
      },
    },
  });

  // Добавляем обработчик масштабирования при скролле
  setupZoomHandler(chart, canvas, period, userPowerTh, apiResult.stats);

  return chart;
}

// Настройка обработчика масштабирования для графика
function setupZoomHandler(chart, canvas, period, userPowerTh, apiStats) {
  const zoomConfig = ZOOM_CONFIG[period];
  let currentZoom = chart.data.datasets[0]._zoomLevel || zoomConfig.default;
  let isZooming = false;

  const handleWheel = async (e) => {
    if (isZooming) return;

    e.preventDefault();
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
          const purchaseInfo = getPurchaseInfo(); // Берем из WordPress
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
      const purchaseInfo = getPurchaseInfo();

      newData = await generateChartData(
        period,
        userPowerTh,
        apiStats,
        currentZoom,
        purchaseInfo
      );
    }

    // Обновляем график
    chart.data.labels = newData.labels;
    chart.data.datasets[0].data = newData.data.map((row) => row.btc);
    chart.data.datasets[0]._rawData = newData.data;
    chart.data.datasets[0]._zoomLevel = currentZoom;

    chart.update("none"); // Обновляем без анимации
    isZooming = false;
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
    graphs.forEach((graph, index) => {
      const graphPeriods = ["day", "week", "month"];
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
