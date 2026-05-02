'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function StoragePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJSON('/admin/storage').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading…</div>;
  if (!data) return null;

  const usedPct = data.quota ? parseFloat(data.quota.usedPercent) : null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>Storage</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Documents" value={data.docs.count.toLocaleString()} sub={`${data.docs.totalMB} MB stored`} />
        <StatCard label="Photos" value={data.photos.count.toLocaleString()} sub="count only (no byte totals yet)" />
        <StatCard label="Users" value={data.users.toLocaleString()} sub={`~${fmtBytes(data.averageBytesPerUser)} avg per user`} />
      </div>

      {data.quota ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Quota</h2>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">{fmtBytes(data.quota.usedBytes)} used</span>
              <span className="text-slate-500">{data.quota.totalGB} GB total</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-teal-500'}`}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{usedPct}% used — {fmtBytes(data.quota.availableBytes)} available</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-sm text-slate-500">
            Set <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">STORAGE_QUOTA_BYTES</code> env var on the backend to enable quota tracking.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
