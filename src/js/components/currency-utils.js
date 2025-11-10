// Утилиты конвертации и форматирования валют

export function convertFromUsd(amountUsd, currency, rates) {
  if (!Number.isFinite(amountUsd)) return 0;
  switch (currency) {
    case "ruble":
      // Если курс не загружен, возвращаем исходное значение
      if (!rates || !rates.RUB || rates.RUB === 0) return amountUsd;
      return amountUsd * rates.RUB;
    case "euro":
      // Если курс не загружен, возвращаем исходное значение
      if (!rates || !rates.EUR || rates.EUR === 0) return amountUsd;
      return amountUsd * rates.EUR;
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
