import useUploadLimitsStore from '../store/uploadLimitsStore';
import { DEFAULT_UPLOAD_LIMITS } from '../api/uploadLimits.api';

/** Server-driven upload caps; falls back to DEFAULT_UPLOAD_LIMITS until loaded. */
export default function useUploadLimits() {
  return useUploadLimitsStore((s) => s.limits) ?? DEFAULT_UPLOAD_LIMITS;
}

export function useUploadLimitsLoaded() {
  return useUploadLimitsStore((s) => s.loaded);
}

export { loadUploadLimits } from '../utils/uploadLimits';
