export type CurrencyDef = {
  code: string;
  symbol: string;
  name: string;
};

export const SUPPORTED_CURRENCIES: CurrencyDef[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map(c => [c.code, c.symbol]),
);

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Format an amount with its currency symbol, e.g. formatCurrency(50, 'USD') → '$50.00'
 * JPY has no decimal places; all others use 2.
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const decimals = currency === 'JPY' ? 0 : 2;
  return `${symbol}${amount.toFixed(decimals)}`;
}

/**
 * Build a compact expense label for summary stats bars.
 * Shows the largest currency total; appends "+N" if multiple currencies are present.
 * e.g. { INR: '1200', USD: '50' } → '₹1,200 +1'
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
