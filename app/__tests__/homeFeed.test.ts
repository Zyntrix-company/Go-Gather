/**
 * Home feed: saved copy on the device, background refresh that never blanks the screen,
 * and image preloading.
 */
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
    setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  },
}));
jest.mock('@d11/react-native-fast-image', () => ({
  __esModule: true,
  default: {
    preload: jest.fn(),
    priority: { high: 'high' },
    cacheControl: { web: 'web' },
  },
}));
jest.mock('../src/api/client', () => ({ API_BASE: 'https://api.test' }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from '@d11/react-native-fast-image';
import {
  sizedImageUri,
  sameList,
  imageUriOf,
  loadCachedHomeFeed,
  refreshHomeFeed,
  __resetHomeFeedForTests,
} from '../src/utils/homeFeed';

const KEY = 'home_feed_v1';
const blog = (n: number) => ({ id: n, title: `b${n}`, image: `https://images.unsplash.com/photo-${n}?w=800&auto=format&fit=crop` });
const deal = (n: number) => ({ id: n, title: `d${n}`, image_url: `https://cdn.test/deal-${n}.webp` });

let fetchMock: jest.Mock;
function respond(map: Record<string, unknown | 'fail'>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.replace('https://api.test', '');
    const v = map[path];
    if (v === 'fail' || v === undefined) throw new Error('offline');
    return { ok: true, json: async () => v };
  });
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  (AsyncStorage.setItem as jest.Mock).mockClear();
  (FastImage.preload as jest.Mock).mockClear();
  __resetHomeFeedForTests();
  fetchMock = jest.fn();
  (globalThis as any).fetch = fetchMock;
});

describe('helpers', () => {
  it('asks Unsplash for a card-sized, lighter image and leaves other hosts alone', () => {
    const u = new URL(sizedImageUri('https://images.unsplash.com/photo-1?w=800&auto=format')!);
    expect(u.searchParams.get('w')).toBe('640');
    expect(u.searchParams.get('q')).toBe('70');
    expect(u.searchParams.get('auto')).toBe('format');
    expect(sizedImageUri('https://d1.cloudfront.net/x.webp')).toBe('https://d1.cloudfront.net/x.webp');
    expect(sizedImageUri(undefined)).toBeUndefined();
    expect(sizedImageUri('not a url')).toBe('not a url');
  });

  it('imageUriOf reads whichever image field the API row has', () => {
    expect(imageUriOf({ image: 'a' })).toBe('a');
    expect(imageUriOf({ image_url: 'b' })).toBe('b');
    expect(imageUriOf({ imageUrl: 'c', image: 'a' })).toBe('c');
    expect(imageUriOf({})).toBeUndefined();
  });

  it('sameList compares by content', () => {
    expect(sameList([blog(1)], [blog(1)])).toBe(true);
    expect(sameList([blog(1)], [blog(2)])).toBe(false);
    expect(sameList([blog(1)], [])).toBe(false);
  });
});

describe('saved copy', () => {
  it('returns what was saved last time', async () => {
    store[KEY] = JSON.stringify({ blogs: [blog(1)], deals: [deal(1)] });
    expect(await loadCachedHomeFeed()).toEqual({ blogs: [blog(1)], deals: [deal(1)] });
  });

  it('first launch / corrupt entry → null', async () => {
    expect(await loadCachedHomeFeed()).toBeNull();
    __resetHomeFeedForTests();
    store[KEY] = '{not json';
    expect(await loadCachedHomeFeed()).toBeNull();
  });
});

describe('refreshHomeFeed', () => {
  it('fetches both lists in parallel, saves them and preloads the first images', async () => {
    respond({ '/blogs?client=app': [blog(1), blog(2), blog(3), blog(4)], '/deals': [deal(1), deal(2)] });
    const feed = await refreshHomeFeed();
    expect(feed!.blogs).toHaveLength(4);
    expect(JSON.parse(store[KEY]).deals).toHaveLength(2);
    const preloaded = (FastImage.preload as jest.Mock).mock.calls[0][0].map((s: any) => s.uri);
    expect(preloaded).toHaveLength(5); // 3 blogs + 2 deals
    expect(preloaded[0]).toContain('w=640');
    expect(preloaded[3]).toBe('https://cdn.test/deal-1.webp');
  });

  it('offline: keeps the saved copy and writes nothing', async () => {
    store[KEY] = JSON.stringify({ blogs: [blog(1)], deals: [deal(1)] });
    respond({}); // every fetch fails
    const feed = await refreshHomeFeed();
    expect(feed).toEqual({ blogs: [blog(1)], deals: [deal(1)] });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('offline on a first-ever launch: nothing to show, no crash', async () => {
    respond({});
    expect(await refreshHomeFeed()).toBeNull();
  });

  it('if only one list fails, the other updates and the failed one keeps its saved copy', async () => {
    store[KEY] = JSON.stringify({ blogs: [blog(1)], deals: [deal(1)] });
    respond({ '/blogs?client=app': 'fail', '/deals': [deal(1), deal(9)] });
    const feed = await refreshHomeFeed();
    expect(feed!.blogs).toEqual([blog(1)]);
    expect(feed!.deals).toHaveLength(2);
    expect(JSON.parse(store[KEY]).deals).toHaveLength(2);
  });

  it('unchanged content is not rewritten to storage', async () => {
    store[KEY] = JSON.stringify({ blogs: [blog(1)], deals: [deal(1)] });
    respond({ '/blogs?client=app': [blog(1)], '/deals': [deal(1)] });
    await refreshHomeFeed();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('a non-array response is ignored (treated as a failed fetch)', async () => {
    store[KEY] = JSON.stringify({ blogs: [blog(1)], deals: [deal(1)] });
    respond({ '/blogs?client=app': { error: 'x' }, '/deals': { error: 'x' } });
    const feed = await refreshHomeFeed();
    expect(feed).toEqual({ blogs: [blog(1)], deals: [deal(1)] });
  });

  it('callers share one in-flight refresh and a just-finished one (no duplicate requests)', async () => {
    respond({ '/blogs?client=app': [blog(1)], '/deals': [deal(1)] });
    const [a, b] = await Promise.all([refreshHomeFeed(), refreshHomeFeed()]);
    expect(a).toBe(b);
    await refreshHomeFeed(); // within the freshness window
    expect(fetchMock).toHaveBeenCalledTimes(2); // blogs + deals, once
  });
});
