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
 * Compact display: ₹24400 → ₹24.4k, $500 → $500 (drops .00 when whole).
 */
export function formatCurrencyCompact(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const abs = Math.abs(amount);
  const decimals = getCurrencyDecimals(currency);

  if (abs >= 1000) {
    const k = abs / 1000;
    const kStr = k >= 100 ? `${Math.round(k)}K` : `${parseFloat(k.toFixed(1))}K`;
    return `${symbol}${kStr}`;
  }

  if (decimals === 0) return `${symbol}${Math.round(abs)}`;

  const rounded = Math.round(abs * 100) / 100;
  if (rounded % 1 === 0) return `${symbol}${rounded.toFixed(0)}`;
  return `${symbol}${rounded.toFixed(decimals)}`;
}

/** e.g. +₹11.9k or −€220 */
export function formatSignedCurrencyCompact(amount: number, currency: string): string {
  if (Math.abs(amount) < 0.005) return formatCurrencyCompact(0, currency);
  const sign = amount > 0 ? '+' : '−';
  return `${sign}${formatCurrencyCompact(Math.abs(amount), currency)}`;
}

const EXPENSE_LABEL_MAX_CURRENCIES = 4;

/**
 * Build expense label for hero/stats — up to 4 currencies, then +N for the rest.
 * e.g. '₹48K' | '₹48K | $320 | €180' | '₹48K | $320 | €180 | £50 +2'
 */
export function buildExpenseLabel(byCurrency: Record<string, string> | undefined): string | null {
  if (!byCurrency) return null;
  const entries = Object.entries(byCurrency)
    .filter(([, v]) => parseFloat(v) > 0)
    .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
  if (entries.length === 0) return null;
  const visible = entries.slice(0, EXPENSE_LABEL_MAX_CURRENCIES);
  const label = visible
    .map(([code, amount]) => formatCurrencyCompact(parseFloat(amount), code))
    .join(' | ');
  const extra = entries.length - visible.length;
  return extra > 0 ? `${label} +${extra}` : label;
}
