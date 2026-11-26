/**
 * Home feed ("Get Inspired" blogs + "Explore Amazing Deals").
 *
 * - The last good copy is saved on the device, so the next open (even offline) shows content
 *   immediately instead of grey boxes.
 * - A refresh runs in the background (started when the app starts, so it is usually done by the
 *   time Home draws); anything that changed replaces the saved copy, a failed refresh keeps it.
 * - The first few images are pre-downloaded as soon as the lists arrive.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from '@d11/react-native-fast-image';
import { API_BASE } from '../api/client';

export type HomeFeed = { blogs: any[]; deals: any[] };

const STORAGE_KEY = 'home_feed_v1';
const FETCH_TIMEOUT_MS = 8000;
/** A refresh finished less than this long ago is reused instead of fetching again. */
const FRESH_FOR_MS = 60_000;
const PRELOAD_BLOGS = 3;
const PRELOAD_DEALS = 4;
/** Blog cards are ~180 dp wide; ~640 px is sharp enough on phones and much lighter than 800 px. */
const CARD_IMAGE_WIDTH = 640;

let memory: HomeFeed | null = null;
let inFlight: Promise<HomeFeed | null> | null = null;
let lastRefreshAt = 0;

/** The image field of a blog/deal row (the API has used several names over time). */
export function imageUriOf(item: any): string | undefined {
  return item?.imageUrl ?? item?.image_url ?? item?.coverImage ?? item?.thumbnail ?? item?.image ?? undefined;
}

/** Ask Unsplash for a card-sized, lighter version; every other host is left untouched. */
export function sizedImageUri(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    const url = new URL(uri);
    if (url.hostname !== 'images.unsplash.com') return uri;
    url.searchParams.set('w', String(CARD_IMAGE_WIDTH));
    url.searchParams.set('q', '70');
    return url.toString();
  } catch {
    return uri;
  }
}

/** True when two lists are identical — lets the screen keep its state (and the carousel position). */
export function sameList(a: unknown[], b: unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function parseSaved(raw: string | null): HomeFeed | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data?.blogs) && Array.isArray(data?.deals)) {
      return { blogs: data.blogs, deals: data.deals };
    }
  } catch { /* corrupt entry — ignore */ }
  return null;
}

/** The saved copy (memory first, then the device), or null on a first-ever launch. */
export async function loadCachedHomeFeed(): Promise<HomeFeed | null> {
  if (memory) return memory;
  try {
    memory = parseSaved(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    memory = null;
  }
  return memory;
}

async function fetchList(path: string): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null; // offline / timeout / bad JSON — the caller keeps the saved copy
  } finally {
    clearTimeout(timer);
  }
}

function preloadImages(feed: HomeFeed) {
  try {
    const uris = [
      ...feed.blogs.slice(0, PRELOAD_BLOGS).map(b => sizedImageUri(imageUriOf(b))),
      ...feed.deals.slice(0, PRELOAD_DEALS).map(d => sizedImageUri(imageUriOf(d))),
    ].filter((u): u is string => !!u);
    if (uris.length === 0) return;
    FastImage.preload(
      uris.map(uri => ({ uri, priority: FastImage.priority.high, cache: FastImage.cacheControl.web })),
    );
  } catch { /* preloading is only an optimisation */ }
}

/**
 * Fetch blogs and deals in parallel and update the saved copy. Each list is kept from the saved
 * copy if its own fetch fails, so being offline never blanks the screen. Calls made while a
 * refresh is running (or just finished) share its result.
 */
export function refreshHomeFeed(): Promise<HomeFeed | null> {
  if (inFlight) return inFlight;
  if (memory && Date.now() - lastRefreshAt < FRESH_FOR_MS) return Promise.resolve(memory);

  inFlight = (async () => {
    const saved = await loadCachedHomeFeed();
    const [blogs, deals] = await Promise.all([fetchList('/blogs?client=app'), fetchList('/deals')]);
    if (blogs === null && deals === null) return saved; // nothing new: keep what we had

    lastRefreshAt = Date.now();
    const next: HomeFeed = { blogs: blogs ?? saved?.blogs ?? [], deals: deals ?? saved?.deals ?? [] };
    const changed = !saved || !sameList(saved.blogs, next.blogs) || !sameList(saved.deals, next.deals);
    memory = next;
    if (changed) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => { /* non-critical */ });
    }
    preloadImages(next);
    return next;
  })().finally(() => { inFlight = null; });

  return inFlight;
}

/** Start everything as early as possible (called when the app starts). Never throws. */
export function prefetchHomeFeed(): void {
  loadCachedHomeFeed()
    .then(saved => { if (saved) preloadImages(saved); })
    .catch(() => {});
  refreshHomeFeed().catch(() => {});
}

/** For tests only. */
export function __resetHomeFeedForTests() {
  memory = null;
  inFlight = null;
  lastRefreshAt = 0;
}
