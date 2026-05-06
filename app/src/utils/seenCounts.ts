import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dispatch, SetStateAction } from 'react';

export type SectionKey = 'docs' | 'members' | 'photos' | 'expenses' | 'polls' | 'notes';
export type SeenCounts = Partial<Record<SectionKey, number>>;

const storageKey = (type: 'trip' | 'event', id: string) => `@gg:seen:${type}:${id}`;

export async function loadSeenCounts(type: 'trip' | 'event', id: string): Promise<SeenCounts> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(type, id));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function markSeen(
  type: 'trip' | 'event',
  id: string,
  section: SectionKey,
  count: number,
  setLocal: Dispatch<SetStateAction<SeenCounts>>,
): Promise<void> {
  setLocal(prev => ({ ...prev, [section]: count }));
  try {
    const key = storageKey(type, id);
    const raw = await AsyncStorage.getItem(key);
    const existing: SeenCounts = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(key, JSON.stringify({ ...existing, [section]: count }));
  } catch { /* noop */ }
}

// Returns 0 when section was never opened (no baseline = no false alert).
// Once opened, returns max(0, current − seen) so only truly new items show.
export function badgeCount(current: number, seen: number | undefined): number {
  if (seen === undefined) return 0;
  return Math.max(0, current - seen);
}
