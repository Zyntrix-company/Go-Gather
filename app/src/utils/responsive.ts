import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Base design canvas (iPhone 14 / common 390-wide design)
const BASE_W = 390;
const BASE_H = 844;

/**
 * Scale a size horizontally relative to screen width.
 * Use for widths, horizontal margins/padding, icon sizes.
 */
export const s = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel((W / BASE_W) * size));

/**
 * Scale a size vertically relative to screen height.
 * Use for heights, vertical margins/padding.
 */
export const vs = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel((H / BASE_H) * size));

/**
 * Moderate scale — scales less aggressively.
 * Use for font sizes and values that shouldn't stretch as much.
 * factor 0 = no scaling, factor 1 = full scaling (same as s())
 */
export const ms = (size: number, factor = 0.45): number =>
  Math.round(PixelRatio.roundToNearestPixel(size + (s(size) - size) * factor));

/** Raw screen dimensions for layouts that need exact values */
export const SCREEN_W = W;
export const SCREEN_H = H;
