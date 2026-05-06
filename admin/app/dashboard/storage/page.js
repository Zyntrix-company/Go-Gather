'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function StoragePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJSON('/admin/storage').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-sm text-slate-400 animate-pulse">Loading…</div>;
  if (!data)   return null;

  const usedPct  = data.quota ? parseFloat(data.quota.usedPercent) : null;
  const totalDoc = data.docs.totalBytes;
  const totalImg = data.images.totalBytes;
  const grand    = data.summary.totalBytes;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
          Storage &amp; Capacity
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{data.users.toLocaleString()} users · {fmtBytes(grand)} total</p>
      </div>

      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total consumed"     value={fmtBytes(grand)}              sub={`${data.summary.totalGB} GB`} />
        <KpiCard label="Docs stored"        value={data.docs.count.toLocaleString()}    sub={`${data.docs.totalMB} MB`} />
        <KpiCard label="Images stored"      value={data.images.count.toLocaleString()}  sub={`${data.images.totalMB} MB`} />
        <KpiCard label="Avg / user"         value={fmtBytes(data.averageBytesPerUser)} sub={`${data.averageMBPerUser} MB`} />
      </div>

      {/* Quota bar */}
      {data.quota ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Quota</h2>
            <span className="text-sm text-slate-500">{fmtBytes(data.quota.usedBytes)} / {data.quota.totalGB} GB</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{usedPct}% used</span>
            <span>{fmtBytes(data.quota.availableBytes)} available</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Quota not configured</p>
          <p className="text-xs text-amber-600">Set <code className="bg-amber-100 px-1 rounded">STORAGE_QUOTA_BYTES</code> on the backend to enable quota tracking.</p>
        </div>
      )}

      {/* Breakdown grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="Images by type"
          rows={data.images.breakdown}
          total={totalImg}
          note={data.images.note}
        />
        <BreakdownCard
          title="Documents by type"
          rows={data.docs.breakdown}
          total={totalDoc}
        />
      </div>
    </div>
  );
}

/* ── Breakdown card ────────────────────────────────────────────── */
function BreakdownCard({ title, rows, total, note }) {
  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-3">{title}</h2>
        <p className="text-sm text-slate-400">No files uploaded yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">{fmtBytes(total)} total</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.mimeType || 'unknown'}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono text-slate-600 truncate max-w-[160px]" title={r.mimeType}>
                {r.mimeType ? friendlyMime(r.mimeType) : 'unknown'}
              </span>
              <span className="flex gap-3 text-slate-500 shrink-0 ml-2">
                <span className="font-semibold text-slate-700">{r.count.toLocaleString()} files</span>
                <span>{fmtBytes(r.bytes)}</span>
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full"
                style={{ width: `${Math.round((r.count / maxCount) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-slate-400 mt-4 leading-relaxed">{note}</p>}
    </div>
  );
}

/* ── KPI ───────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */
function fmtBytes(b) {
  b = Number(b);
  if (!b) return '0 B';
  if (b < 1024)     return `${b} B`;
  if (b < 1024**2)  return `${(b/1024).toFixed(1)} KB`;
  if (b < 1024**3)  return `${(b/1024**2).toFixed(2)} MB`;
  return `${(b/1024**3).toFixed(2)} GB`;
}

function friendlyMime(mime) {
  const map = {
    'image/jpeg': 'JPEG', 'image/jpg': 'JPG', 'image/png': 'PNG',
    'image/webp': 'WebP', 'image/gif': 'GIF', 'image/svg+xml': 'SVG',
    'video/mp4': 'MP4', 'video/quicktime': 'MOV', 'video/webm': 'WebM',
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'text/plain': 'TXT', 'text/csv': 'CSV',
  };
  return map[mime] || mime.split('/')[1]?.toUpperCase() || mime;
}
