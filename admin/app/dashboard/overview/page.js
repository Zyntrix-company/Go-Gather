'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function OverviewPage() {
  const [summary, setSummary] = useState(null);
  const [growth,  setGrowth]  = useState(null);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiJSON('/admin/dashboard/summary'),
      apiJSON(`/admin/dashboard/growth?days=${days}`),
    ]).then(([s, g]) => { setSummary(s); setGrowth(g); }).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <Skeleton />;
  if (!summary) return null;

  const totalTrips  = summary.trips.upcoming  + summary.trips.active  + summary.trips.completed;
  const totalEvents = summary.events.upcoming + summary.events.active + summary.events.completed;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
            Business Insights
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform overview · admin accounts excluded</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-teal-500">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Registered Users"  value={summary.users.registered}
          sub="all time, excl. admins" color="teal" />
        <KpiCard label="Active Users"      value={summary.users.active}
          sub={`signed in last ${days}d`} color="teal" />
        <KpiCard label="Trips"             value={totalTrips}
          sub={`${summary.trips.active} active`} color="slate" />
        <KpiCard label="Events"            value={totalEvents}
          sub={`${summary.events.active} active`} color="slate" />
      </div>

      {/* Buckets + growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BucketTable summary={summary} />
        {growth && <GrowthChart growth={growth} days={days} />}
      </div>
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${color === 'teal' ? 'text-teal-600' : 'text-slate-800'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

/* ── Bucket table ─────────────────────────────────────────────── */
function BucketTable({ summary }) {
  const rows = [
    { label: 'Upcoming trips',   value: summary.trips.upcoming,   dot: 'bg-blue-400' },
    { label: 'Active trips',     value: summary.trips.active,     dot: 'bg-teal-500' },
    { label: 'Completed trips',  value: summary.trips.completed,  dot: 'bg-slate-300' },
    { label: 'Archived trips',   value: summary.trips.archived,   dot: 'bg-slate-200' },
    null,
    { label: 'Upcoming events',  value: summary.events.upcoming,  dot: 'bg-blue-400' },
    { label: 'Active events',    value: summary.events.active,    dot: 'bg-teal-500' },
    { label: 'Completed events', value: summary.events.completed, dot: 'bg-slate-300' },
    { label: 'Archived events',  value: summary.events.archived,  dot: 'bg-slate-200' },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-800 mb-4">Activity Buckets</h2>
      <div className="space-y-2">
        {rows.map((r, i) =>
          r ? (
            <div key={r.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className={`w-2 h-2 rounded-full ${r.dot} shrink-0`} />{r.label}
              </span>
              <span className="font-semibold text-slate-800 tabular-nums">{r.value}</span>
            </div>
          ) : <div key={i} className="border-t border-slate-50 my-1" />,
        )}
      </div>
    </div>
  );
}

/** Normalize API dates (Postgres date vs ISO string) to YYYY-MM-DD for keys and sorting. */
function growthDateKey(raw) {
  if (raw == null) return '';
  const s = String(raw);
  return s.slice(0, 10);
}

function formatGrowthAxisLabel(ymd) {
  if (!ymd || ymd.length < 10) return ymd;
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── SVG growth chart ─────────────────────────────────────────── */
function GrowthChart({ growth, days }) {
  const series = [
    { key: 'users',  label: 'Users',  color: '#0d9488' },
    { key: 'trips',  label: 'Trips',  color: '#475569' },
    { key: 'events', label: 'Events', color: '#94a3b8' },
  ];

  const dateSet = new Set();
  series.forEach(({ key }) => {
    (growth[key] ?? []).forEach((d) => dateSet.add(growthDateKey(d.date)));
  });
  const dates = Array.from(dateSet).filter(Boolean).sort();

  const dataByKey = {};
  series.forEach(({ key }) => {
    dataByKey[key] = {};
    (growth[key] ?? []).forEach((d) => {
      const k = growthDateKey(d.date);
      const n = Number(d.count);
      dataByKey[key][k] = (dataByKey[key][k] ?? 0) + (Number.isFinite(n) ? n : 0);
    });
  });

  const allCounts = series.flatMap(({ key }) => (growth[key] ?? []).map((d) => d.count));
  const maxVal = Math.max(...allCounts, 1);

  const W = 520; const H = 180;
  const PAD = { t: 10, r: 12, b: 30, l: 30 };
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b;
  const xp = (i) => PAD.l + (i / Math.max(dates.length - 1, 1)) * iW;
  const yp = (v) => PAD.t + iH - (v / maxVal) * iH;

  const gridVals = [...new Set([0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal])].sort((a, b) => a - b);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-800">Growth — last {days} days</h2>
        <div className="flex gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No registrations in this period</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
          {gridVals.map((v) => {
            const y = yp(v);
            return (
              <g key={v}>
                <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
              </g>
            );
          })}
          {/* X axis — show ~5 labels */}
          {dates.filter((_, i) => dates.length <= 7 || i % Math.ceil(dates.length / 5) === 0 || i === dates.length - 1).map((d) => {
            const i = dates.indexOf(d);
            return (
              <text key={d} x={xp(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{formatGrowthAxisLabel(d)}</text>
            );
          })}
          {series.map(({ key, color }) => {
            const pts = dates.map((d, i) => {
              const v = dataByKey[key][d] ?? 0;
              return { x: xp(i), y: yp(v), v };
            });
            // Single-point paths have zero stroke length in SVG; duplicate X so the line renders.
            const pathD =
              pts.length === 1
                ? `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${(pts[0].x + 0.01).toFixed(1)},${pts[0].y.toFixed(1)}`
                : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            return (
              <g key={key}>
                <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {pts.filter((p) => p.v > 0).map((p, i) => (
                  <circle key={`${key}-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 h-72" />
        <div className="bg-white rounded-2xl border border-slate-100 h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
