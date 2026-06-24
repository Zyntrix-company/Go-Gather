/**
 * GatherGo typography scale — semantic tokens only.
 * Use typeStyle() instead of inline fontSize/fontWeight across screens.
 *
 * Scale groups:
 *   DISPLAY   — hero/splash text (20–40px)
 *   TITLE     — headers, nav bars, section titles (14–18px)
 *   BODY      — readable copy (10–15px)
 *   LABEL     — form labels, tags (10–13px)
 *   BUTTON    — interactive text (13–16px)
 *   CAPTION   — badges, timestamps (9–11px)
 *   EXPENSE   — expense-tab specific tokens
 */
import { TextStyle } from 'react-native';

const scale = {
  // ─── DISPLAY ────────────────────────────────────────────────────────────────
  /** Splash / welcome screen hero text */
  displayXl: { fontSize: 40, fontWeight: '700' as const, lineHeight: 48 },

  /** Large hero — deal headers, empty-state art text */
  displayLg: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },

  /** Sub-hero — onboarding section titles */
  displayMd: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },

  /** Screen-level sub-display — stats callouts, trip date ranges */
  displaySm: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },

  /** Tab screen / gallery title — e.g. Home, Gallery header */
  display: { fontSize: 24, fontWeight: '500' as const, lineHeight: 32 },

  // ─── TITLE ──────────────────────────────────────────────────────────────────
  /** Modal / bottom-sheet title — e.g. Create Trip, Edit Profile */
  titleLg: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },

  /** Navigation bar / screen header — AppHeader, SubScreenHeader */
  navTitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },

  /** Prominent modal section or picker header (17px) */
  titleXl: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },

  /** Section heading — e.g. Description, Photos, Activities */
  titleMd: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },

  /** Sub-section / card title — e.g. deal name, trip card name */
  titleSm: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },

  // ─── BODY ───────────────────────────────────────────────────────────────────
  /** Primary body / prominent list item */
  bodyLg: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },

  /** Default body — messages, card copy, descriptions */
  body: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },

  /** Secondary / meta — timestamps, subtitles, helper text */
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },

  /** Extra-small body — fine-print, supplementary info */
  bodyXs: { fontSize: 10, fontWeight: '400' as const, lineHeight: 14 },

  // ─── LABEL ──────────────────────────────────────────────────────────────────
  /** Form label / settings row label */
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  /** Small label — tag chip text, dropdown option meta */
  labelSm: { fontSize: 10, fontWeight: '500' as const, lineHeight: 14 },

  // ─── BUTTON ─────────────────────────────────────────────────────────────────
  /** Full-size / primary action button */
  buttonLg: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },

  /** Standard button */
  button: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },

  /** Compact button / text link */
  buttonSm: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  // ─── CAPTION / MICRO ────────────────────────────────────────────────────────
  /** Badge / chip / tab-bar indicator text */
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },

  /** Tiny counters only — avatar +N, notification dot */
  micro: { fontSize: 9, fontWeight: '600' as const, lineHeight: 12 },

  // ─── EXPENSE-SPECIFIC ───────────────────────────────────────────────────────
  /** Expense list — Edit / Delete action links */
  expAction: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },

  /** Expense form field label */
  expFieldLabel: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  /** Expense totals — currency code & amount */
  expTotalValue: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },

  /** Expense totals — subsection heading e.g. Individual breakdown */
  expSectionHeading: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  /** Expense totals — breakdown row text */
  expBreakdownRow: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof scale;

export const typography = scale;

/** Spread a token and optionally override color, alignment, or other TextStyle props. */
export function typeStyle(token: TypographyToken, overrides?: TextStyle): TextStyle {
  return overrides ? { ...scale[token], ...overrides } : scale[token];
}

export default typography;
