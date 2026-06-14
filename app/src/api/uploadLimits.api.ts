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
  tripVideo: UploadLimitSlice;
  tripDoc: UploadLimitSlice;
  tripActivityPhoto: UploadLimitSlice;
  tripCreate: {
    maxPhotoBatch: number;
    maxDocBatch: number;
    maxPhotoFileBytes: number;
    maxPhotoFileMB: number;
    maxVideoFileBytes: number;
    maxVideoFileMB: number;
    maxDocFileBytes: number;
    maxDocFileMB: number;
  };
  eventPhoto: UploadLimitSlice;
  eventVideo: UploadLimitSlice;
  eventDoc: UploadLimitSlice;
  galleryPhoto: UploadLimitSlice;
  galleryVideo: UploadLimitSlice;
  avatar: UploadLimitSlice;
  promoVideo: UploadLimitSlice;
  blogImage: UploadLimitSlice;
  docMaxCount: number;
  videoMaxCount: number;
};

const MB = 1024 * 1024;

/** Fallback when offline or before first fetch — mirrors server defaults in uploadLimits.js */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  tripPhoto: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  tripVideo: { maxFileBytes: 200 * MB, maxFileMB: 200, maxBatchFiles: 20, maxFilesTotal: 2, maxModuleBytes: 400 * MB },
  tripDoc: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 10, maxFilesTotal: 50, maxModuleBytes: 50 * 15 * MB },
  tripActivityPhoto: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 5, maxFilesTotal: 5, maxModuleBytes: 5 * 15 * MB },
  tripCreate: {
    maxPhotoBatch: 10,
    maxDocBatch: 10,
    maxPhotoFileBytes: 15 * MB,
    maxPhotoFileMB: 15,
    maxVideoFileBytes: 200 * MB,
    maxVideoFileMB: 200,
    maxDocFileBytes: 15 * MB,
    maxDocFileMB: 15,
  },
  eventPhoto: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  eventVideo: { maxFileBytes: 200 * MB, maxFileMB: 200, maxBatchFiles: 20, maxFilesTotal: 2, maxModuleBytes: 400 * MB },
  eventDoc: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 10, maxFilesTotal: 50, maxModuleBytes: 50 * 15 * MB },
  galleryPhoto: { maxFileBytes: 15 * MB, maxFileMB: 15, maxBatchFiles: 20, maxFilesTotal: null, maxModuleBytes: null },
  galleryVideo: { maxFileBytes: 200 * MB, maxFileMB: 200, maxBatchFiles: 20, maxFilesTotal: 2, maxModuleBytes: 400 * MB },
  avatar: { maxFileBytes: 10 * MB, maxFileMB: 10, maxBatchFiles: 1, maxFilesTotal: 1, maxModuleBytes: 10 * MB },
  promoVideo: { maxFileBytes: 500 * MB, maxFileMB: 500, maxBatchFiles: 1, maxFilesTotal: 1, maxModuleBytes: 500 * MB },
  blogImage: { maxFileBytes: 10 * MB, maxFileMB: 10, maxBatchFiles: 1, maxFilesTotal: null, maxModuleBytes: null },
  docMaxCount: 50,
  videoMaxCount: 2,
};

export async function fetchUploadLimits(): Promise<UploadLimits> {
  const { data } = await axios.get<UploadLimits>(`${API_BASE}/config/upload-limits`, { timeout: 10000 });
  return data;
}

export function isVideoMime(type?: string | null): boolean {
  return !!type && type.startsWith('video/');
}
