'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiJSON } from '../../../lib/api';

export default function ContactPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20, unread: unreadOnly });
    apiJSON(`/admin/contact-submissions?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id) {
    await apiJSON(`/admin/contact-submissions/${id}/read`, { method: 'PATCH' });
    load();
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>Feedback & Support</h1>
          {data && <p className="text-sm text-slate-500 mt-0.5">{data.total} submissions</p>}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded accent-teal-600"
          />
          <span className="text-sm font-semibold text-slate-700">Unread only</span>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : !data?.submissions.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">No submissions</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.submissions.map((s) => (
              <div key={s.id} className={`transition-colors ${!s.read_at ? 'bg-teal-50/30' : ''}`}>
                {/* Row header */}
                <button
                  className="w-full text-left px-5 py-4 hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!s.read_at && (
                          <span className="inline-flex w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800 text-sm">{s.name}</span>
                        <span className="text-slate-400 text-sm">&lt;{s.email}&gt;</span>
                        <span className="text-xs text-slate-400">{s.country}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 truncate">{s.subject}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {expanded === s.id && (
                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">
                      {s.message}
                    </p>
                    <div className="flex gap-3">
                      {!s.read_at && (
                        <button
                          onClick={() => markRead(s.id)}
                          className="text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                      <a
                        href={`mailto:${s.email}?subject=Re: ${encodeURIComponent(s.subject)}`}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        Reply via email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Prev
            </button>
            <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
