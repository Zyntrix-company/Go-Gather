/** Max photos selectable in one Drive import batch, respecting total album cap. */
export function drivePhotoSelectCap(
  batchMax: number,
  currentCount: number,
  totalMax: number | null,
): number {
  const remaining = totalMax != null ? Math.max(0, totalMax - currentCount) : batchMax;
  return Math.max(0, Math.min(batchMax, remaining));
}

export function toggleDriveFileSelection(
  prev: Set<string>,
  fileId: string,
  maxSelectable: number,
): Set<string> {
  const next = new Set(prev);
  if (next.has(fileId)) {
    next.delete(fileId);
  } else if (next.size < maxSelectable) {
    next.add(fileId);
  }
  return next;
}
