export type BlogListItem = {
  id: number;
  slug: string;
  image: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
};

export type BlogDetail = BlogListItem & {
  content: string;
};

function apiRoot(): string {
  const base = import.meta.env.VITE_API_URL;
  if (!base || typeof base !== 'string') {
    throw new Error('VITE_API_URL is not set');
  }
  return base.replace(/\/$/, '');
}

export async function fetchBlogs(): Promise<BlogListItem[]> {
  const res = await fetch(`${apiRoot()}/blogs?client=web`);
  if (!res.ok) {
    throw new Error(`Failed to load blogs (${res.status})`);
  }
  return res.json();
}

export async function fetchBlogByIdOrSlug(idOrSlug: string): Promise<BlogDetail> {
  const enc = encodeURIComponent(idOrSlug);
  const res = await fetch(`${apiRoot()}/blogs/${enc}`);
  if (res.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!res.ok) {
    throw new Error(`Failed to load blog (${res.status})`);
  }
  return res.json();
}

/**
 * Formats blog publish dates from the API. Values may be:
 * - Plain calendar dates: `YYYY-MM-DD` (Postgres DATE as string)
 * - Full ISO datetimes: `2025-05-10T00:00:00.000Z` (DATE serialized to JSON via node-pg)
 * Appending `T12:00:00Z` to an ISO string produces an invalid Date ("Invalid Date" in the UI).
 */
export function formatBlogDate(isoDate: string | null | undefined): string {
  if (isoDate == null) return '';
  const s = String(isoDate).trim();
  if (!s) return '';

  const hasTime =
    /[Tt]\d/.test(s) || // ISO time part
    /^\d{4}-\d{2}-\d{2}\s+\d/.test(s); // "YYYY-MM-DD HH:mm..." (Postgres text style)

  const d = hasTime ? new Date(s) : new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
