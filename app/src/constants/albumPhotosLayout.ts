import { Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** @deprecated Use flex hero (AlbumPhotosHeroCarousel) — kept for previews only */
export const ALBUM_HERO_H = Math.round(SCREEN_H * 0.46);

export const ALBUM_THUMB_W = 64;
export const ALBUM_THUMB_H = 50;

/** Fixed hero height inside trip/event photos dialog. */
export const ALBUM_DIALOG_HERO_H = 248;

/** Rounded hero frame in photos dialog and gallery album hero. */
export const ALBUM_HERO_RADIUS = 18;
export const ALBUM_HERO_H_PAD = 16;

/** Square hero content width for full-screen gallery album detail (static fallback). */
export const GALLERY_ALBUM_HERO_CONTENT = Math.min(SCREEN_W - ALBUM_HERO_H_PAD * 2, 300);
/** Slot height: square frame + vertical slide padding (4 + 6). */
export const GALLERY_ALBUM_HERO_H = GALLERY_ALBUM_HERO_CONTENT + 10;

/** Gallery viewport layout — comment list and hero sizing. */
export const GALLERY_COMMENT_ROW_H = 76;
export const GALLERY_ALBUM_DESCRIPTION_PLACEHOLDER = 'Add a short caption for this album…';
export const GALLERY_MAX_VISIBLE_COMMENTS = 3;
export const GALLERY_HERO_CONTENT_MAX = 320;
export const GALLERY_HERO_CONTENT_MIN = 200;
export const GALLERY_HERO_SLIDE_V_PAD = 10;

/** Phone-portrait frame (width / height) used by the gallery album hero. */
export const GALLERY_HERO_PORTRAIT_ASPECT = 3 / 4;

/**
 * Largest 3:4 rectangle that fits in the hero slot. The slot height is unchanged;
 * the frame is centered by the caller.
 */
export function fitPortraitFrame(slotW: number, slotH: number): { width: number; height: number } {
  const w = Math.max(0, slotW);
  const h = Math.max(0, slotH);
  if (w === 0 || h === 0) return { width: 0, height: 0 };
  let height = h;
  let width = height * GALLERY_HERO_PORTRAIT_ASPECT;
  if (width > w) {
    width = w;
    height = width / GALLERY_HERO_PORTRAIT_ASPECT;
  }
  return { width, height };
}

/**
 * Most of a photo's height that "fill" mode may crop away (top + bottom combined) to make the
 * photo reach the frame's side borders. Beyond this the photo is kept uncropped and just gets as
 * wide as the cap allows, so tall/narrow photos are never butchered.
 */
export const GALLERY_FILL_MAX_CROP = 0.18;

/**
 * Box a photo is drawn in inside a frame, for "fill" mode (trip/event albums that show the
 * Members row, where the frame is as wide as the page but shorter than a 3:4 portrait).
 *
 * - Photo as wide as the frame (or wider): fitted to the frame width, no crop.
 * - Narrower photo: the box is made wider than the photo, up to the full frame width, by
 *   cropping at most `maxCrop` of its height. `cover` is true when any crop happens.
 *
 * The box always has the frame's height unless the photo is wide, and is never wider than the frame.
 */
export function fitFillCropBox(
  frameW: number,
  frameH: number,
  aspect: number,
  maxCrop: number = GALLERY_FILL_MAX_CROP,
): { w: number; h: number; cover: boolean } | null {
  if (!(frameW > 0) || !(frameH > 0) || !(aspect > 0)) return null;
  const frameAspect = frameW / frameH;
  if (aspect >= frameAspect) {
    return { w: frameW, h: frameW / aspect, cover: false };
  }
  const crop = Math.min(Math.max(0, maxCrop), 1 - aspect / frameAspect);
  const w = Math.min(frameW, (frameH * aspect) / (1 - crop));
  return { w, h: frameH, cover: crop > 0 };
}

/** Fixed chrome heights used by useGalleryViewportHeroHeight. */
export const GALLERY_CHROME = {
  appHeader: 56,
  subHeader: 40,
  subHeaderEdit: 48,
  thumbStrip: 58,
  description: 36,
  travelers: 82,
  stats: 44,
  composeGhost: 0,
  footer: 60,
  metaCard: 52,
  gaps: 16,
} as const;

export const albumChromeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackGallery: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroOverlayBtnLight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
    flexShrink: 0,
  },
  footerGallery: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
    flexShrink: 0,
  },
  metaCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    flexShrink: 0,
  },
  metaCardTransparent: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    flexShrink: 0,
  },
  metaTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', letterSpacing: -0.2, marginBottom: 4 },
  metaTitleLight: { fontSize: 15, fontWeight: '600', color: '#f8fafc', letterSpacing: -0.2, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  metaText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  metaTextAccent: { fontSize: 12, color: '#0d9488', fontWeight: '500' },
  metaMembers: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e2e8f0',
  },
  metaCount: { fontSize: 11, color: '#0d9488', fontWeight: '600' },
  metaCountLight: { fontSize: 11, color: '#5eead4', fontWeight: '600' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnFull: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#0d9488' },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220,38,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGallery: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(13,148,136,0.35)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnOutlineGallery: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(13,148,136,0.45)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnFullGallery: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(13,148,136,0.35)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  thumbStrip: {
    backgroundColor: '#fff',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    flexShrink: 0,
  },
  thumbStripTransparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingVertical: 5,
    flexShrink: 0,
  },
  albumSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    flexShrink: 0,
  },
  albumSubHeaderGallery: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  albumSubHeaderSide: { width: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
});
