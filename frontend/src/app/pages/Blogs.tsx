import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { fetchBlogs, formatBlogDate, type BlogListItem } from '../lib/blogsApi';

export default function Blogs() {
  const [posts, setPosts] = React.useState<BlogListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBlogs()
      .then((list) => {
        if (!cancelled) {
          setPosts(list);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setPosts([]);
          setError(
            e.message.includes('VITE_API_URL')
              ? 'Blog feed is not configured (missing VITE_API_URL).'
              : e.message || 'Could not load blogs.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-8 md:pt-16 pb-20 px-6 max-w-4xl mx-auto">
      <SEO
        title="Blog — GatherrGo | Group Travel Tips & Insights"
        description="Travel tips, expense-splitting guides, and product insights from the GatherrGo team. Everything you need to plan better group trips."
        canonical="/blogs"
      />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
            <BookOpen className="w-6 h-6 text-teal-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
            Our <span className="text-teal-600">Blog</span>
          </h1>
        </div>
        <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
          Travel tips, product updates, and stories from the GatherrGo team.
        </p>
      </motion.section>

      {loading && (
        <p className="text-center text-slate-500 text-sm py-12">Loading posts…</p>
      )}

      {error && !loading && (
        <p className="text-center text-red-600 text-sm py-12 max-w-lg mx-auto">{error}</p>
      )}

      {!loading && !error && posts.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-12">No posts yet.</p>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {posts.map((post, i) => (
          <motion.article
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="group relative rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-teal-900/5 overflow-hidden hover:shadow-xl hover:shadow-teal-900/10 transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-stretch gap-0">
              <div className="md:w-2/5 shrink-0">
                <img
                  src={post.image}
                  alt=""
                  className="h-48 md:h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#008080]/10 text-[#008080] uppercase tracking-wide">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatBlogDate(post.publishedAt)}
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 group-hover:text-teal-700 transition-colors">
                  {post.title}
                </h2>
                <p className="text-slate-600 text-base leading-relaxed mb-6 flex-1">
                  {post.excerpt}
                </p>

                <Link
                  to={`/blogs/${post.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors mt-auto"
                >
                  Read more
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </div>
  );
}
