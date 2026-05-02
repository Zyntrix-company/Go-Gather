'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function HealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    await apiJSON('/admin/health').then(setData).catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Checking services…</div>;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>Health</h1>
        <button
          onClick={load}
          disabled={refreshing}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ServiceCard label="API" status={data.api} />
            <ServiceCard label="Database" status={data.db} />
            <ServiceCard label="Frontend" status={data.frontend} />
            <ServiceCard label="Admin Panel" status={data.adminPanel} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Load</h2>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600">Requests in last 30 min</span>
                  <span className="font-bold text-slate-900">{data.requests30m.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${Math.min((data.requests30m / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              In-process counter — resets on server restart. Checked at{' '}
              {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
            </p>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
          Failed to load health data
        </div>
      )}
    </div>
  );
}

function ServiceCard({ label, status }) {
  const config = {
    ok: { color: 'teal', text: 'OK', dot: 'bg-teal-500' },
    error: { color: 'red', text: 'Error', dot: 'bg-red-500' },
    not_configured: { color: 'slate', text: 'N/A', dot: 'bg-slate-300' },
    unknown: { color: 'amber', text: 'Unknown', dot: 'bg-amber-400' },
  };
  const isHttp = status?.startsWith('http_');
  const cfg = config[status] ?? (isHttp ? { color: 'amber', text: status, dot: 'bg-amber-400' } : config.unknown);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${cfg.color === 'teal' ? 'text-teal-600' : cfg.color === 'red' ? 'text-red-600' : cfg.color === 'amber' ? 'text-amber-600' : 'text-slate-500'}`}>
        {cfg.text}
      </p>
    </div>
  );
}
