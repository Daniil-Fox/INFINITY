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

const MARKET_PROXY_DEFAULT =
  "/wp-content/themes/infinity/assets/market-proxy.php";
const FALLBACK_RATES = { EUR: 0.92, RUB: 92, USD: 1 };

const cache = new Map();

function isLocalhostHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

function shouldUseProxy(overrides = {}) {
  if (typeof overrides.useProxy === "boolean") return overrides.useProxy;
  if (typeof window === "undefined") return false;
  return !isLocalhostHost(window.location.hostname);
}

function resolveMarketProxyUrl(overrides = {}) {
  if (overrides.marketProxyUrl) return overrides.marketProxyUrl;
  if (typeof window !== "undefined") {
    const envUrl = window.INFINITY_ENV?.MARKET_PROXY_URL;
    if (envUrl) return envUrl;
    const meta =
      typeof document !== "undefined"
        ? document
            .querySelector('meta[name="market-proxy-url"]')
            ?.getAttribute("content")
        : null;
    if (meta) return meta;
  }
  return MARKET_PROXY_DEFAULT;
}

function buildProxyUrl(params = {}, overrides = {}) {
  const base = resolveMarketProxyUrl(overrides);
  const usp = new URLSearchParams(params);
  return `${base}?${usp.toString()}`;
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.t > (item.ttl ?? DEFAULTS.cacheTtlMs)) return null;
  return item.v;
}

function setCache(key, value, ttl) {
  cache.set(key, { v: value, t: Date.now(), ttl });
}

function normalizeRatesPayload(data) {
  // exchangerate-api.com: { rates: { ... } }
  if (data?.rates && typeof data.rates === "object") {
    return data.rates;
  }
  // exchangerate.host: { result: { rates: { ... } } }
  if (data?.result?.rates && typeof data.result.rates === "object") {
    return data.result.rates;
  }
  // frankfurter.app: { rates: { ... } }
  if (
    data?.rates &&
    typeof data.rates === "object" &&
    (data.rates.EUR || data.rates.RUB)
  ) {
    return data.rates;
  }
  // иногда приходит в корне
  if ((data?.EUR || data?.RUB) && !data?.rates) {
    return data;
  }
  return null;
}

function extractRates(data) {
  const ratesObj = normalizeRatesPayload(data);
  if (!ratesObj) {
    throw new Error("Unknown API format");
  }
  const eur = Number(ratesObj.EUR);
  const rub = Number(ratesObj.RUB);
  if (!Number.isFinite(eur) || !Number.isFinite(rub)) {
    throw new Error("Invalid exchange rates: non-finite values");
  }
  if (eur < 0.5 || eur > 1.5) {
    throw new Error(`EUR rate out of range: ${eur}`);
  }
  if (rub < 30 || rub > 200) {
    throw new Error(`RUB rate out of range: ${rub}`);
  }
  return { EUR: eur, RUB: rub, USD: 1 };
}

export async function fetchBtcUsdPrice(overrides = {}) {
  const useProxy = shouldUseProxy(overrides);
  const url = useProxy
    ? buildProxyUrl({ type: "btc" }, overrides)
    : overrides.coinpaprikaTickerUrl || DEFAULTS.coinpaprikaTickerUrl;
  const cached = getCache(url);
  if (cached) return cached;
  const res = await fetch(url, {
    credentials: useProxy ? "same-origin" : "omit",
  });
  if (!res.ok) throw new Error("BTC price fetch failed");
  const data = await res.json();
  const price = Number(data?.quotes?.USD?.price);
  if (!Number.isFinite(price)) throw new Error("Invalid BTC price");
  setCache(url, price);
  return price;
}

// Попытка получить курсы из одного источника
async function tryFetchRates(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      credentials: "omit",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return extractRates(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutError = new Error("Request timeout");
      timeoutError.url = url;
      throw timeoutError;
    }
    error.url = url;
    throw error;
  }
}

export async function fetchUsdRates(overrides = {}) {
  const useProxy = shouldUseProxy(overrides);
  if (useProxy) {
    const url = buildProxyUrl({ type: "fiat" }, overrides);
    const cached = getCache(url);
    if (cached) return cached;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Fiat rates fetch via proxy failed");
    const data = await res.json();
    const rates = extractRates(data);
    setCache(url, rates);
    return rates;
  }

  const urls =
    overrides.fiatRatesUrls || overrides.fiatRatesUrl
      ? [overrides.fiatRatesUrl || overrides.fiatRatesUrls].flat()
      : DEFAULTS.fiatRatesUrls;

  const cacheKey = urls[0];
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let lastError = null;
  for (const url of urls) {
    try {
      const rates = await tryFetchRates(url);
      setCache(cacheKey, rates);
      return rates;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to fetch from ${url}:`, error.message);
      continue;
    }
  }

  console.error("All exchange rate APIs failed, using fallback rates");
  console.error("Last error:", lastError);
  return FALLBACK_RATES;
}

export default { fetchBtcUsdPrice, fetchUsdRates };
