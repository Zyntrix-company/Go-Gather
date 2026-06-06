import cc from 'currency-codes';
import getSymbolFromCurrency from 'currency-symbol-map';

export type CurrencyDef = {
  code: string;
  symbol: string;
  name: string;
  digits: number;
};

/** Common trip / expense currencies — shown first in the picker. */
export const POPULAR_CURRENCY_CODES = [
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'JPY', 'CHF',
] as const;

function buildCurrencyDef(record: (typeof cc.data)[number]): CurrencyDef {
  const code = record.code;
  return {
    code,
    name: record.currency,
    symbol: getSymbolFromCurrency(code) ?? code,
    digits: typeof record.digits === 'number' ? record.digits : 2,
  };
}

/** Full ISO 4217 list (active currencies with at least one country). */
export const ALL_CURRENCIES: CurrencyDef[] = cc.data
  .filter(r => r.countries.length > 0)
  .map(buildCurrencyDef)
  .sort((a, b) => a.name.localeCompare(b.name));

const currencyByCode = new Map(ALL_CURRENCIES.map(c => [c.code, c]));

export const POPULAR_CURRENCIES: CurrencyDef[] = POPULAR_CURRENCY_CODES
  .map(code => currencyByCode.get(code))
  .filter((c): c is CurrencyDef => c != null);

/** @deprecated Use POPULAR_CURRENCIES or ALL_CURRENCIES */
export const SUPPORTED_CURRENCIES = POPULAR_CURRENCIES;

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  ALL_CURRENCIES.map(c => [c.code, c.symbol]),
);

const CURRENCY_DECIMALS: Record<string, number> = Object.fromEntries(
  ALL_CURRENCIES.map(c => [c.code, c.digits]),
);

export function getCurrencyDef(code: string): CurrencyDef | undefined {
  return currencyByCode.get(code);
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

export function filterCurrencies(query: string): { popular: CurrencyDef[]; others: CurrencyDef[] } {
  const q = query.trim().toLowerCase();
  const matches = (c: CurrencyDef) =>
    !q
    || c.code.toLowerCase().includes(q)
    || c.name.toLowerCase().includes(q)
    || c.symbol.toLowerCase().includes(q);

  const popularCodes = new Set(POPULAR_CURRENCIES.map(c => c.code));
  const popular = POPULAR_CURRENCIES.filter(matches);
  const others = ALL_CURRENCIES.filter(c => !popularCodes.has(c.code) && matches(c));
  return { popular, others };
}

/**
 * Format an amount with its currency symbol, e.g. formatCurrency(50, 'USD') → '$50.00'
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const decimals = getCurrencyDecimals(currency);
  return `${symbol}${amount.toFixed(decimals)}`;
}

/**
 * Build a compact expense label for summary stats bars.
 * Shows the largest currency total; appends "+N" if multiple currencies are present.
 */
export function buildExpenseLabel(byCurrency: Record<string, string> | undefined): string {
  if (!byCurrency) return '0';
  const entries = Object.entries(byCurrency).filter(([, v]) => parseFloat(v) > 0);
  if (entries.length === 0) return '0';
  const sorted = [...entries].sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
  const [primaryCode, primaryAmount] = sorted[0];
  const sym = getCurrencySymbol(primaryCode);
  const formatted = `${sym}${parseFloat(primaryAmount).toLocaleString()}`;
  return sorted.length > 1 ? `${formatted} +${sorted.length - 1}` : formatted;
}
