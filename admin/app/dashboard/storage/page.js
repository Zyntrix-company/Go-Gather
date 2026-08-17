'use client';

import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { apiJSON } from '../../../lib/api';

const HISTORY_PRESETS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '180', label: 'Last 180 days', days: 180 },
  { key: '365', label: 'Last year', days: 365 },
];

export default function StoragePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyDays, setHistoryDays] = useState('30');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    apiJSON('/admin/storage').then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const days = HISTORY_PRESETS.find((p) => p.key === historyDays)?.days ?? 30;
    setHistoryLoading(true);
    apiJSON(`/admin/storage/history?days=${days}`).then(setHistory).finally(() => setHistoryLoading(false));
  }, [historyDays]);

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

      {/* Storage optimization */}
      <OptimizationCard imageStats={data.compressionStats} videoStats={data.videoCompressionStats} />

      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total consumed"     value={fmtBytes(grand)}              sub={`${data.summary.totalGB} GB`} />
        <KpiCard label="Docs stored"        value={data.docs.count.toLocaleString()}    sub={`${data.docs.totalMB} MB`} />
        <KpiCard label="Images stored"      value={data.images.count.toLocaleString()}  sub={`${data.images.totalMB} MB`} />
        <KpiCard label="Avg / user"         value={fmtBytes(data.averageBytesPerUser)} sub={`${data.averageMBPerUser} MB`} />
      </div>

      {/* Consumption over time */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800">Consumption over time</h2>
          <select value={historyDays} onChange={(e) => setHistoryDays(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-teal-500">
            {HISTORY_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        {historyLoading ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400 animate-pulse">Loading…</div>
        ) : (
          <StorageHistoryChart snapshots={history?.snapshots ?? []} />
        )}
      </div>

      {/* Quota bar */}
      {data.quota ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-800">Quota</h2>
              <QuotaInfo />
            </div>
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
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-amber-700">Quota not configured</p>
            <QuotaInfo tone="amber" />
          </div>
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

/* ── Storage optimization ─────────────────────────────────────── */
function OptimizationCard({ imageStats, videoStats }) {
  const hasImg = imageStats?.imagesCompressed > 0;
  const hasVid = videoStats?.videosCompressed > 0;

  const originalTotal = (hasImg ? imageStats.originalBytes : 0) + (hasVid ? videoStats.originalBytes : 0);
  const finalTotal = (hasImg ? imageStats.finalBytes : 0) + (hasVid ? videoStats.finalBytes : 0);
  const combinedSavedPercent = originalTotal > 0 ? Math.round((1 - finalTotal / originalTotal) * 100) : null;

  return (
    <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <h2 className="text-sm font-bold text-slate-800">Storage optimization</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Every photo and video is automatically compressed before it lands in cloud storage — resized and
            re-encoded for photos, transcoded for videos — with no visible drop in quality.
          </p>
        </div>
        {combinedSavedPercent !== null && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-teal-600">~{combinedSavedPercent}%</p>
            <p className="text-xs text-slate-400">less cloud storage used</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <OptimizationStat
          label="Photos"
          active={hasImg}
          savedPercent={imageStats?.savedPercent}
          count={imageStats?.imagesCompressed}
          bytesSaved={hasImg ? imageStats.originalBytes - imageStats.finalBytes : 0}
          emptyNote="Savings will show here once new photos come in"
        />
        <OptimizationStat
          label="Videos"
          active={hasVid}
          savedPercent={videoStats?.savedPercent}
          count={videoStats?.videosCompressed}
          bytesSaved={hasVid ? videoStats.originalBytes - videoStats.finalBytes : 0}
          emptyNote="Savings will show here once new videos come in"
        />
      </div>
    </div>
  );
}

function OptimizationStat({ label, active, savedPercent, count, bytesSaved, emptyNote }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      {active ? (
        <>
          <p className="text-lg font-bold text-slate-800 mt-1">
            {savedPercent}% smaller <span className="text-xs font-normal text-slate-400">on average</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{fmtBytes(bytesSaved)} saved across {count.toLocaleString()} files</p>
        </>
      ) : (
        <p className="text-xs text-slate-400 mt-1.5">{emptyNote}</p>
      )}
    </div>
  );
}

/* ── Quota info popover ───────────────────────────────────────── */
function QuotaInfo({ tone = 'slate' }) {
  const [open, setOpen] = useState(false);
  const color = tone === 'amber' ? 'text-amber-500 hover:text-amber-700' : 'text-slate-400 hover:text-slate-600';

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`inline-flex ${color} transition-colors`} aria-label="What is quota?">
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-72 bg-white rounded-xl border border-slate-100 shadow-lg p-3.5 text-left">
            <p className="text-xs text-slate-600 leading-relaxed">
              An optional storage budget you set yourself — it&apos;s not tied to any real AWS/S3 limit, just a soft ceiling
              for planning purposes. When configured (<code className="bg-slate-100 px-1 rounded text-[11px]">STORAGE_QUOTA_BYTES</code> on
              the backend), this bar shows usage against it: teal under 70%, amber 70–90%, red above 90%. Nothing is
              enforced — the app keeps accepting uploads past 100%.
            </p>
          </div>
        </>
      )}
    </span>
  );
}

/* ── History chart ─────────────────────────────────────────────── */
function StorageHistoryChart({ snapshots }) {
  if (snapshots.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-center gap-1">
        <p className="text-sm text-slate-400">Not enough history yet</p>
        <p className="text-xs text-slate-300 max-w-xs">
          A daily snapshot job records totals each night — check back in a few days for a trend line.
        </p>
      </div>
    );
  }

  const series = [
    { key: 'totalBytes',  label: 'Total',  color: '#0d9488' },
    { key: 'docsBytes',   label: 'Docs',   color: '#475569' },
    { key: 'imagesBytes', label: 'Images', color: '#94a3b8' },
  ];

  const maxVal = Math.max(...snapshots.map((s) => s.totalBytes), 1);
  const W = 640; const H = 200;
  const PAD = { t: 10, r: 12, b: 30, l: 56 };
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b;
  const xp = (i) => PAD.l + (i / Math.max(snapshots.length - 1, 1)) * iW;
  const yp = (v) => PAD.t + iH - (v / maxVal) * iH;

  const gridVals = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div>
      <div className="flex gap-3 mb-2">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
        {gridVals.map((v) => {
          const y = yp(v);
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtBytes(v)}</text>
            </g>
          );
        })}
        {snapshots.filter((_, i) => snapshots.length <= 7 || i % Math.ceil(snapshots.length / 6) === 0 || i === snapshots.length - 1).map((s) => {
          const i = snapshots.indexOf(s);
          const d = new Date(`${String(s.date).slice(0, 10)}T12:00:00.000Z`);
          const label = Number.isNaN(d.getTime()) ? s.date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return <text key={s.date} x={xp(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>;
        })}
        {series.map(({ key, color }) => {
          const pts = snapshots.map((s, i) => ({ x: xp(i), y: yp(s[key]), v: s[key] }));
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          return (
            <g key={key}>
              <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
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
