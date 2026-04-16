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
  const res = await fetch(`${apiRoot()}/blogs`);
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

export function formatBlogDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
