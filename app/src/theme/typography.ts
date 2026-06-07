/**
 * GatherGo typography scale — semantic tokens only.
 * Use these instead of inline fontSize/fontWeight across screens.
 *
 * Audit chart: canvases/typography-audit.canvas.tsx
 * Re-scan: node app/scripts/analyze-typography.mjs
 */
import { TextStyle } from 'react-native';

const scale = {
  /** Hero / tab screen title — e.g. Gallery, Home tab headers */
  display: { fontSize: 24, fontWeight: '500' as const, lineHeight: 32 },

  /** Modal / page title — e.g. Create trip, profile header */
  titleLg: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },

  /** Section heading — e.g. Description, Photos, Activities */
  titleMd: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },

  /** Sub-section / card title — e.g. Get Inspired, deal names */
  titleSm: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },

  /** Primary body / list item — e.g. trip card name, profile name */
  bodyLg: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },

  /** Default body / description — e.g. messages, card body */
  body: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },

  /** Secondary / meta — e.g. timestamps, subtitles */
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },

  /** Form label / settings row label */
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  /** Primary button */
  button: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },

  /** Compact button / text link */
  buttonSm: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  /** Badge / chip / tab bar */
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },

  /** Tiny counters only — avatar +N, nav dots */
  micro: { fontSize: 9, fontWeight: '600' as const, lineHeight: 12 },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof scale;

export const typography = scale;

/** Spread a token and optionally override color or alignment. */
export function typeStyle(token: TypographyToken, overrides?: TextStyle): TextStyle {
  return overrides ? { ...scale[token], ...overrides } : scale[token];
}

export default typography;
