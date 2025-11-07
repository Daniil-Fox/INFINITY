// Утилиты конвертации и форматирования валют

export function convertFromUsd(amountUsd, currency, rates) {
  if (!Number.isFinite(amountUsd)) return 0;
  switch (currency) {
    case "ruble":
      return amountUsd * (rates?.RUB ?? 0);
    case "euro":
      return amountUsd * (rates?.EUR ?? 0);
    case "dollar":
    default:
      return amountUsd;
  }
}

export function formatCurrency(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const locales = { ruble: "ru-RU", dollar: "en-US", euro: "de-DE" };
  const codes = { ruble: "RUB", dollar: "USD", euro: "EUR" };
  return new Intl.NumberFormat(locales[currency] || "en-US", {
    style: "currency",
    currency: codes[currency] || "USD",
    maximumFractionDigits: currency === "ruble" ? 0 : 2,
  }).format(n);
}

export function getSelectedCurrency(formEl) {
  const checked = formEl.querySelector('input[name="currency"]:checked');
  return checked ? checked.value : "dollar";
}

export default { convertFromUsd, formatCurrency, getSelectedCurrency };
