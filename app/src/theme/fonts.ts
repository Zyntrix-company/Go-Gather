/**
 * GatherGo font system.
 * All text uses Inter. fontWeight controls visual weight.
 */
export const fonts = {
  primary: 'Inter',
} as const;

export type FontFamily = typeof fonts[keyof typeof fonts];

/** Standard font weights used in the design system */
export const fontWeights = {
  regular:   '400' as const,
  medium:    '500' as const,
  semiBold:  '600' as const,
  bold:      '700' as const,
} satisfies Record<string, string>;
