import useUploadLimitsStore from '../store/uploadLimitsStore';

export async function loadUploadLimits() {
  return useUploadLimitsStore.getState().loadLimits();
}

export function rejectOversizedFile(
  fileSizeBytes: number | undefined | null,
  maxFileBytes: number,
): string | null {
  if (!fileSizeBytes || fileSizeBytes <= maxFileBytes) return null;
  const mb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
  const maxMb = Math.round(maxFileBytes / (1024 * 1024));
  return `File is too large (${mb} MB). Maximum allowed is ${maxMb} MB.`;
}
