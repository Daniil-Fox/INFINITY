// Получение курсов: BTC (в USD) и фиатных курсов USD→EUR,RUB

const DEFAULTS = {
  coinpaprikaTickerUrl: "https://api.coinpaprika.com/v1/tickers/btc-bitcoin",
  fiatRatesUrl: "https://api.exchangerate.host/latest?base=USD&symbols=EUR,RUB",
  cacheTtlMs: 60_000,
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

export async function fetchUsdRates(overrides = {}) {
  const url = overrides.fiatRatesUrl || DEFAULTS.fiatRatesUrl;
  const cached = getCache(url);
  if (cached) return cached;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("Fiat rates fetch failed");
  const data = await res.json();
  const eur = Number(data?.rates?.EUR);
  const rub = Number(data?.rates?.RUB);
  const rates = { EUR: eur, RUB: rub, USD: 1 };
  setCache(url, rates);
  return rates;
}

export default { fetchBtcUsdPrice, fetchUsdRates };
