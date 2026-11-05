import {
  GALLERY_FILL_MAX_CROP,
  fitFillCropBox,
  fitPortraitFrame,
} from '../src/constants/albumPhotosLayout';

// A trip album with the Members row: page-wide frame, but shorter than a 3:4 portrait.
const W = 360;
const H = 398;

describe('fitFillCropBox', () => {
  it('3:4 portrait photo reaches both side borders with a small crop', () => {
    const box = fitFillCropBox(W, H, 3 / 4)!;
    expect(box.w).toBeCloseTo(W, 5);
    expect(box.h).toBe(H);
    expect(box.cover).toBe(true);
    // crop = how much of the photo's height is cut to fill the box
    const boxAspect = box.w / box.h;
    expect(1 - (3 / 4) / boxAspect).toBeLessThanOrEqual(GALLERY_FILL_MAX_CROP + 1e-9);
  });

  it('is wider than the old 3:4 frame for the same photo (the extra side space is reclaimed)', () => {
    const old = fitPortraitFrame(W, H);
    const box = fitFillCropBox(W, H, 3 / 4)!;
    expect(old.width).toBeCloseTo(H * 0.75, 5);
    expect(box.w).toBeGreaterThan(old.width);
  });

  it('very tall photo (9:16): crop is capped, box is wider than before but not full width', () => {
    const box = fitFillCropBox(W, H, 9 / 16)!;
    expect(box.cover).toBe(true);
    expect(box.h).toBe(H);
    expect(box.w).toBeLessThan(W);
    expect(box.w).toBeGreaterThan(H * (9 / 16)); // wider than contain
    const boxAspect = box.w / box.h;
    expect(1 - (9 / 16) / boxAspect).toBeCloseTo(GALLERY_FILL_MAX_CROP, 5);
  });

  it('landscape photo fills the width with no crop and keeps its shape', () => {
    const box = fitFillCropBox(W, H, 3 / 2)!;
    expect(box).toEqual({ w: W, h: W / 1.5, cover: false });
  });

  it('square photo (wider than the frame aspect) is fitted to the width, uncropped', () => {
    const box = fitFillCropBox(W, H, 1)!;
    expect(box).toEqual({ w: W, h: W, cover: false });
  });

  it('a photo exactly as wide as the frame is not cropped', () => {
    const box = fitFillCropBox(W, H, W / H)!;
    expect(box.w).toBeCloseTo(W, 5);
    expect(box.h).toBeCloseTo(H, 5);
    expect(box.cover).toBe(false);
  });

  it('never exceeds the frame, for any aspect', () => {
    for (const a of [0.2, 0.4, 0.5625, 0.66, 0.75, 0.8, 0.9, 1, 1.33, 1.78, 2.4, 4]) {
      const box = fitFillCropBox(W, H, a)!;
      expect(box.w).toBeLessThanOrEqual(W + 1e-9);
      expect(box.h).toBeLessThanOrEqual(H + 1e-9);
      expect(box.w).toBeGreaterThan(0);
    }
  });

  it('crop is monotonic: narrower photos never get a larger crop than the cap', () => {
    for (const a of [0.1, 0.3, 0.5, 0.7, 0.8]) {
      const box = fitFillCropBox(W, H, a)!;
      const crop = Math.max(0, 1 - a / (box.w / box.h));
      expect(crop).toBeLessThanOrEqual(GALLERY_FILL_MAX_CROP + 1e-9);
    }
  });

  it('returns null for unusable sizes or aspect', () => {
    expect(fitFillCropBox(0, H, 0.75)).toBeNull();
    expect(fitFillCropBox(W, 0, 0.75)).toBeNull();
    expect(fitFillCropBox(W, H, 0)).toBeNull();
    expect(fitFillCropBox(W, H, NaN)).toBeNull();
  });

  it('honours a custom crop cap', () => {
    const none = fitFillCropBox(W, H, 3 / 4, 0)!;
    expect(none.cover).toBe(false);
    expect(none.w).toBeCloseTo(H * 0.75, 5); // 0 crop == plain contain
  });
});
