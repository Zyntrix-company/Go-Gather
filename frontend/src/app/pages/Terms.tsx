import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Scale } from 'lucide-react';
import SEO from '../components/SEO';
import { fetchLegalDocument, type LegalDocumentResponse } from '../lib/legalApi';

function formatEffective(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function Terms() {
  const [doc, setDoc] = useState<LegalDocumentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLegalDocument('terms')
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 md:pt-28 pb-20">
      <SEO
        title="Terms & Conditions — GatherrGo"
        description="Review GatherrGo's Terms and Conditions. Understand your rights and responsibilities when using our group travel planning platform."
        canonical="/terms"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-3 md:gap-4 mb-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
            <Scale className="w-6 h-6 md:w-8 md:h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-900 whitespace-nowrap">
            Terms & <span className="text-teal-600">Conditions</span>
          </h1>
        </div>
        <p className="text-base text-slate-600 font-normal">
          {loading && 'Loading…'}
          {!loading && doc && (
            <>
              Version <span className="font-semibold text-slate-800">{doc.version}</span>
              {' · '}
              Effective {formatEffective(doc.effectiveAt)}
            </>
          )}
          {!loading && error && <span className="text-red-600">{error}</span>}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-8 md:p-12 rounded-3xl bg-white/70 backdrop-blur-md border border-white/60 shadow-xl shadow-teal-900/5"
      >
        {loading && <p className="text-slate-500 text-center py-12">Loading terms…</p>}
        {error && !loading && (
          <p className="text-red-600 text-center py-8">
            {error}
          </p>
        )}
        {doc && !loading && (
          <div
            className="legal-html prose prose-slate max-w-none text-base text-slate-600 [&_a]:text-teal-600 [&_a:hover]:text-teal-700 [&_p]:mb-3 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1,&_h2,&_h3]:font-bold [&_h1,&_h2,&_h3]:text-slate-900"
            dangerouslySetInnerHTML={{ __html: doc.contentHtml }}
          />
        )}
      </motion.div>
    </div>
  );
}
