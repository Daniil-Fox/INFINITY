// Получение курсов: BTC (в USD) и фиатных курсов USD→EUR,RUB

const DEFAULTS = {
  coinpaprikaTickerUrl: "https://api.coinpaprika.com/v1/tickers/btc-bitcoin",
  // Используем несколько источников для надежности
  fiatRatesUrls: [
    "https://api.exchangerate-api.com/v4/latest/USD",
    "https://api.frankfurter.app/latest?from=USD&to=EUR,RUB",
    "https://api.exchangerate.host/latest?base=USD&symbols=EUR,RUB",
  ],
  // Уменьшаем время кеширования для более актуальных курсов (30 секунд)
  cacheTtlMs: 30_000,
};

const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.t > (item.ttl ?? DEFAULTS.cacheTtlMs)) return null;
  return item.v;
}

function setCache(key, value, ttl) {
  cache.set(key, { v: value, t: Date.now(), ttl });
}

export async function fetchBtcUsdPrice(overrides = {}) {
  const url = overrides.coinpaprikaTickerUrl || DEFAULTS.coinpaprikaTickerUrl;
  const cached = getCache(url);
  if (cached) return cached;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("BTC price fetch failed");
  const data = await res.json();
  const price = Number(data?.quotes?.USD?.price);
  if (!Number.isFinite(price)) throw new Error("Invalid BTC price");
  setCache(url, price);
  return price;
}

// Попытка получить курсы из одного источника
async function tryFetchRates(url) {
  // Создаем AbortController для таймаута (совместимость со старыми браузерами)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch(url, { 
      credentials: "omit",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    // Поддержка разных форматов API
    let ratesObj = null;
    
    // exchangerate-api.com: { rates: { EUR: 0.92, RUB: 92 } }
    if (data?.rates && typeof data.rates === 'object') {
      ratesObj = data.rates;
    } 
    // exchangerate.host: { rates: { EUR: 0.92, RUB: 92 } }
    else if (data?.result?.rates && typeof data.result.rates === 'object') {
      ratesObj = data.result.rates;
    }
    // frankfurter.app: { rates: { EUR: 0.92, RUB: 92 } }
    else if (data?.rates && typeof data.rates === 'object' && (data.rates.EUR || data.rates.RUB)) {
      ratesObj = data.rates;
    }
    // Некоторые API могут возвращать напрямую в корне
    else if ((data?.EUR || data?.RUB) && !data.rates) {
      ratesObj = data;
    }
    
    if (!ratesObj) {
      console.warn("Unknown API format:", url, data);
      throw new Error("Unknown API format");
    }
    
    const eur = Number(ratesObj.EUR);
    const rub = Number(ratesObj.RUB);
    
    // Проверяем, что курсы валидны
    if (!Number.isFinite(eur) || !Number.isFinite(rub)) {
      throw new Error("Invalid exchange rates: non-finite values");
    }
    
    // Проверка разумности курсов (EUR обычно 0.8-1.2, RUB обычно 50-150)
    // Эти проверки помогают отсеять неактуальные данные
    if (eur < 0.5 || eur > 1.5) {
      throw new Error(`EUR rate out of range: ${eur}`);
    }
    if (rub < 30 || rub > 200) {
      throw new Error(`RUB rate out of range: ${rub}`);
    }
    
    return { EUR: eur, RUB: rub, USD: 1 };
  } catch (error) {
    clearTimeout(timeoutId);
    // Прокидываем ошибку дальше, но добавляем информацию об URL
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.url = url;
      throw timeoutError;
    }
    error.url = url;
    throw error;
  }
}

export async function fetchUsdRates(overrides = {}) {
  const urls = overrides.fiatRatesUrls || overrides.fiatRatesUrl 
    ? [overrides.fiatRatesUrl || overrides.fiatRatesUrls].flat()
    : DEFAULTS.fiatRatesUrls;
  
  // Проверяем кеш по первому URL
  const cacheKey = urls[0];
  const cached = getCache(cacheKey);
  if (cached) return cached;
  
  // Пробуем получить курсы из разных источников по очереди
  let lastError = null;
  for (const url of urls) {
    try {
      const rates = await tryFetchRates(url);
      // Кешируем успешный результат
      setCache(cacheKey, rates);
      return rates;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to fetch from ${url}:`, error.message);
      // Продолжаем пробовать следующие источники
      continue;
    }
  }
  
  // Если все источники не сработали
  console.error("All exchange rate APIs failed, using fallback rates");
  console.error("Last error:", lastError);
  
  // Возвращаем fallback с более актуальными значениями (обновить при необходимости)
  // По состоянию на ноябрь 2024: EUR ~0.92, RUB ~92
  const fallbackRates = { EUR: 0.92, RUB: 92, USD: 1 };
  // Не кешируем fallback, чтобы при следующей попытке снова попробовать API
  return fallbackRates;
}

export default { fetchBtcUsdPrice, fetchUsdRates };
