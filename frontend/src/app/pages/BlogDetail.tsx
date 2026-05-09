import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import SEO from '../components/SEO';
import {
  fetchBlogByIdOrSlug,
  formatBlogDate,
  type BlogDetail as BlogDetailType,
} from '../lib/blogsApi';

/** Detect whether a string contains HTML tags (rich-text from admin editor). */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

/**
 * Legacy plain-text renderer — used for older posts that were saved as plain text
 * (double-newline paragraphs, numbered headings like "1. Section Title").
 */
function renderPlainTextBlocks(content: string): React.ReactNode[] {
  const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, idx) => {
    const lines = block.split('\n');
    const first = lines[0]?.trim() ?? '';
    const rest = lines.slice(1).join('\n').trim();
    const numberedHeading = /^\d+\.\s/.test(first);

    if (numberedHeading && rest) {
      return (
        <React.Fragment key={idx}>
          <h2 className="text-lg md:text-xl font-bold text-[#1a1a1a] mt-10 mb-3 first:mt-0">
            {first}
          </h2>
          <p className="text-[#1a1a1a]/90 text-base leading-[1.75] mb-6 whitespace-pre-line">
            {rest}
          </p>
        </React.Fragment>
      );
    }
    if (numberedHeading && !rest) {
      return (
        <h2 key={idx} className="text-lg md:text-xl font-bold text-[#1a1a1a] mt-10 mb-3 first:mt-0">
          {first}
        </h2>
      );
    }
    return (
      <p key={idx} className="text-[#1a1a1a]/90 text-base leading-[1.75] mb-6 whitespace-pre-line">
        {block}
      </p>
    );
  });
}

export default function BlogDetail() {
  const { id: idOrSlug } = useParams<{ id: string }>();
  const [blog, setBlog] = React.useState<BlogDetailType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!idOrSlug) {
      setError('Missing blog link');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBlogByIdOrSlug(idOrSlug)
      .then((data) => {
        if (!cancelled) setBlog(data);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setBlog(null);
          setError(e.message === 'NOT_FOUND' ? 'not_found' : e.message || 'load_failed');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idOrSlug]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-white text-[#666] text-sm">
        Loading article…
      </div>
    );
  }

  if (error === 'not_found' || !blog) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-[#1a1a1a]">We could not find that article.</p>
        <Link
          to="/blogs"
          className="text-sm font-semibold text-[#008080] hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to blog
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[#1a1a1a] max-w-md">{error}</p>
        <Link to="/blogs" className="text-sm font-semibold text-[#008080] hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  const canonicalPath = `/blogs/${blog.slug}`;

  return (
    <article className="bg-white min-h-screen pb-20">
      <SEO
        title={`${blog.title} — GatherrGo Blog`}
        description={blog.excerpt}
        canonical={canonicalPath}
        ogImage={blog.image}
      />

      <div className="max-w-[880px] mx-auto px-6 pt-8 md:pt-12">
        <Link
          to="/blogs"
          className="inline-flex items-center gap-1.5 text-sm text-[#666666] hover:text-[#008080] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All posts
        </Link>

        <header className="text-left mb-8">
          <span className="inline-block bg-[#008080] text-white text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-sm mb-6">
            {blog.category}
          </span>
          <h1 className="text-3xl md:text-[2.25rem] md:leading-tight font-bold text-black mb-6">
            {blog.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#666666]">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              {blog.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              {formatBlogDate(blog.publishedAt)}
            </span>
          </div>
        </header>

        <img
          src={blog.image}
          alt=""
          className="w-full rounded-md object-cover aspect-[16/9] mb-10 md:mb-12 shadow-sm"
          loading="eager"
        />

        {isHtml(blog.content) ? (
          <div
            className="blog-prose"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />
        ) : (
          <div className="font-sans text-left max-w-none">
            {renderPlainTextBlocks(blog.content)}
          </div>
        )}
      </div>

      {/* App Download Banner */}
      <div className="max-w-[880px] mx-auto px-6 mt-16 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#e8f5f5] to-[#d0eded] px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#008080] mb-2">
              Travel smarter
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] leading-snug mb-3">
              Get the GatherrGo app
            </h2>
            <p className="text-[#555] text-sm max-w-xs">
              Discover trips, events &amp; experiences — all in one place. Download now and start exploring.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {/* App Store */}
            <a
              href="#"
              aria-label="Download on the App Store"
              className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl px-5 py-3 transition-colors w-48"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0 fill-white" aria-hidden>
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="leading-tight">
                <span className="block text-[10px] text-white/70 font-medium">Download on the</span>
                <span className="block text-base font-semibold">App Store</span>
              </div>
            </a>

            {/* Google Play */}
            <a
              href="#"
              aria-label="Get it on Google Play"
              className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl px-5 py-3 transition-colors w-48"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" aria-hidden>
                <path fill="#ea4335" d="M3.18 23.76a2 2 0 0 1-.97-1.76V2a2 2 0 0 1 .97-1.76l.11-.06 11.67 11.67v.27L3.29 23.82z" />
                <path fill="#fbbc04" d="M18.82 15.87l-3.88-3.87v-.27l3.88-3.87.09.05 4.6 2.61a2.02 2.02 0 0 1 0 3.52l-4.6 2.61z" />
                <path fill="#34a853" d="M18.91 15.82L7.13 24c-.5.35-1.14.4-1.68.14l12.57-12.57z" />
                <path fill="#4285f4" d="M5.45-.14c.54-.26 1.18-.21 1.68.14L18.91 8.18 6.34 20.75z" />
              </svg>
              <div className="leading-tight">
                <span className="block text-[10px] text-white/70 font-medium">Get it on</span>
                <span className="block text-base font-semibold">Google Play</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
