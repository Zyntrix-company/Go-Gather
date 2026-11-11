import axios from 'axios';
import { API_BASE } from './client';

export type AppLimits = {
  galleryCommentMax: number;
  galleryAlbumDescriptionMax: number;
  tripNameMax: number;
  eventNameMax: number;
  bioMax: number;
  sweeMessageMax: number;
  reportReasonMax: number;
  maxLocations: number;
  sweeTravelFocusMax: number;
};

/** Fallback when offline or before first fetch — mirrors server defaults in appLimits.js */
export const DEFAULT_APP_LIMITS: AppLimits = {
  galleryCommentMax: 100,
  galleryAlbumDescriptionMax: 80,
  tripNameMax: 40,
  eventNameMax: 40,
  bioMax: 150,
  sweeMessageMax: 1000,
  reportReasonMax: 500,
  maxLocations: 10,
  sweeTravelFocusMax: 3,
};

export async function fetchAppLimits(): Promise<AppLimits> {
  const { data } = await axios.get<AppLimits>(`${API_BASE}/config/app-limits`, { timeout: 10000 });
  return data;
}
