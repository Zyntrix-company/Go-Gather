import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const posts = [
  {
    slug: 'how-to-plan-a-group-trip',
    title: 'How to Plan a Group Trip Without the Chaos',
    excerpt: 'Planning a trip with friends can feel overwhelming — different preferences, budgets, and schedules. Here\'s how to keep everyone on the same page from day one.',
    date: '10 April 2026',
    readTime: '5 min read',
    category: 'Travel Tips',
  },
  {
    slug: 'split-expenses-fairly',
    title: 'The Right Way to Split Travel Expenses with Friends',
    excerpt: 'Money conversations can get awkward on group trips. We break down the fairest methods for splitting costs and how GatherrGo makes it effortless.',
    date: '3 April 2026',
    readTime: '4 min read',
    category: 'Finance',
  },
  {
    slug: 'group-travel-memories',
    title: 'Why Shared Memories Make Group Travel Worth It',
    excerpt: 'Beyond the itinerary and the expenses, the photos and moments you capture together are what last. Here\'s why we built a dedicated space for them.',
    date: '25 March 2026',
    readTime: '3 min read',
    category: 'Product',
  },
];

const categoryColors: Record<string, string> = {
  'Travel Tips': 'bg-teal-100 text-teal-700',
  'Finance': 'bg-blue-100 text-blue-700',
  'Product': 'bg-violet-100 text-violet-700',
};

export default function Blogs() {
  return (
    <div className="pt-8 md:pt-16 pb-20 px-6 max-w-4xl mx-auto">
      <SEO
        title="Blog — GatherrGo | Group Travel Tips & Insights"
        description="Travel tips, expense-splitting guides, and product insights from the GatherrGo team. Everything you need to plan better group trips."
        canonical="/blogs"
      />

      {/* Header */}
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

      {/* Posts */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {posts.map((post, i) => (
          <motion.article
            key={post.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="group relative rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-teal-900/5 p-8 hover:shadow-xl hover:shadow-teal-900/10 transition-all"
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${categoryColors[post.category] ?? 'bg-slate-100 text-slate-600'}`}>
                {post.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                {post.date}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                {post.readTime}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 group-hover:text-teal-700 transition-colors">
              {post.title}
            </h2>
            <p className="text-slate-600 text-base leading-relaxed mb-6">
              {post.excerpt}
            </p>

            <Link
              to={`/blogs/${post.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Read more
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.article>
        ))}
      </motion.div>
    </div>
  );
}
