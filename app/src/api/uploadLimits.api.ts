import axios from 'axios';
import { API_BASE } from './client';

export type UploadLimitSlice = {
  maxFileBytes: number;
  maxFileMB: number;
  maxBatchFiles: number;
  maxFilesTotal: number | null;
  maxModuleBytes: number | null;
};

export type UploadLimits = {
  tripPhoto: UploadLimitSlice;
  tripDoc: UploadLimitSlice;
  tripActivityPhoto: UploadLimitSlice;
  tripCreate: {
    maxPhotoBatch: number;
    maxDocBatch: number;
    maxPhotoFileBytes: number;
    maxPhotoFileMB: number;
    maxDocFileBytes: number;
    maxDocFileMB: number;
  };
  eventPhoto: UploadLimitSlice;
  eventDoc: UploadLimitSlice;
  galleryPhoto: UploadLimitSlice;
  avatar: UploadLimitSlice;
  promoVideo: UploadLimitSlice;
  blogImage: UploadLimitSlice;
  docMaxCount: number;
};

/** Fallback when offline or before first fetch — mirrors server defaults in uploadLimits.js */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  tripPhoto: { maxFileBytes: 100 * 1024 * 1024, maxFileMB: 100, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  tripDoc: { maxFileBytes: 50 * 1024 * 1024, maxFileMB: 50, maxBatchFiles: 1, maxFilesTotal: 50, maxModuleBytes: 50 * 50 * 1024 * 1024 },
  tripActivityPhoto: { maxFileBytes: 100 * 1024 * 1024, maxFileMB: 100, maxBatchFiles: 5, maxFilesTotal: 5, maxModuleBytes: 5 * 100 * 1024 * 1024 },
  tripCreate: { maxPhotoBatch: 10, maxDocBatch: 10, maxPhotoFileBytes: 100 * 1024 * 1024, maxPhotoFileMB: 100, maxDocFileBytes: 50 * 1024 * 1024, maxDocFileMB: 50 },
  eventPhoto: { maxFileBytes: 100 * 1024 * 1024, maxFileMB: 100, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  eventDoc: { maxFileBytes: 50 * 1024 * 1024, maxFileMB: 50, maxBatchFiles: 1, maxFilesTotal: 50, maxModuleBytes: 50 * 50 * 1024 * 1024 },
  galleryPhoto: { maxFileBytes: 100 * 1024 * 1024, maxFileMB: 100, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  avatar: { maxFileBytes: 10 * 1024 * 1024, maxFileMB: 10, maxBatchFiles: 1, maxFilesTotal: 1, maxModuleBytes: 10 * 1024 * 1024 },
  promoVideo: { maxFileBytes: 500 * 1024 * 1024, maxFileMB: 500, maxBatchFiles: 1, maxFilesTotal: 1, maxModuleBytes: 500 * 1024 * 1024 },
  blogImage: { maxFileBytes: 10 * 1024 * 1024, maxFileMB: 10, maxBatchFiles: 1, maxFilesTotal: null, maxModuleBytes: null },
  docMaxCount: 50,
};

export async function fetchUploadLimits(): Promise<UploadLimits> {
  const { data } = await axios.get<UploadLimits>(`${API_BASE}/config/upload-limits`, { timeout: 10000 });
  return data;
}
