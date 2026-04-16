import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import SEO from '../components/SEO';
import {
  fetchBlogByIdOrSlug,
  formatBlogDate,
  type BlogDetail as BlogDetailType,
} from '../lib/blogsApi';

function renderContentBlocks(content: string): React.ReactNode[] {
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
        <h2
          key={idx}
          className="text-lg md:text-xl font-bold text-[#1a1a1a] mt-10 mb-3 first:mt-0"
        >
          {first}
        </h2>
      );
    }

    return (
      <p
        key={idx}
        className="text-[#1a1a1a]/90 text-base leading-[1.75] mb-6 whitespace-pre-line"
      >
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

        <div className="font-sans text-left max-w-none">{renderContentBlocks(blog.content)}</div>
      </div>
    </article>
  );
}
