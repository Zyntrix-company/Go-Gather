'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiJSON } from '../../../lib/api';

/* ── Date-range presets ───────────────────────────────────────── */
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
/** Monday-start week boundary. */
function startOfWeek(d) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

function buildPresets() {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = endOfDay(addDays(thisWeekStart, -1));
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = endOfMonth(lastMonthStart);

  return [
    { key: '7d', label: 'Last 7 days', from: startOfDay(addDays(now, -7)), to: now, rangeLabel: 'within the last 7 days' },
    { key: '30d', label: 'Last 30 days', from: startOfDay(addDays(now, -30)), to: now, rangeLabel: 'within the last 30 days' },
    { key: '90d', label: 'Last 90 days', from: startOfDay(addDays(now, -90)), to: now, rangeLabel: 'within the last 90 days' },
    { key: 'this_week', label: 'This week', from: thisWeekStart, to: now, rangeLabel: 'this week' },
    { key: 'last_week', label: 'Last week', from: lastWeekStart, to: lastWeekEnd, rangeLabel: 'last week' },
    { key: 'this_month', label: 'This month', from: thisMonthStart, to: now, rangeLabel: 'this month' },
    { key: 'last_month', label: 'Last month', from: lastMonthStart, to: lastMonthEnd, rangeLabel: 'last month' },
  ];
}

export default function OverviewPage() {
  const presets = useMemo(buildPresets, []);
  const [presetKey, setPresetKey] = useState('30d');
  const [summary, setSummary] = useState(null);
  const [growth,  setGrowth]  = useState(null);
  const [loading, setLoading] = useState(true);

  const preset = presets.find((p) => p.key === presetKey) ?? presets[1];

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      from: preset.from.toISOString(),
      to: preset.to.toISOString(),
      label: preset.rangeLabel,
    });
    Promise.all([
      apiJSON(`/admin/dashboard/summary?${params}`),
      apiJSON(`/admin/dashboard/growth?${params}`),
    ]).then(([s, g]) => { setSummary(s); setGrowth(g); }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

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
        <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-teal-500">
          {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Registered Users"  value={summary.users.registered}
          sub="all time, excl. admins" color="teal" />
        <KpiCard label="Active Users"      value={summary.users.active}
          sub={`signed in ${preset.rangeLabel}`} color="teal" />
        <KpiCard label="Trips"             value={totalTrips}
          sub={`${summary.trips.active} active`} color="slate" />
        <KpiCard label="Events"            value={totalEvents}
          sub={`${summary.events.active} active`} color="slate" />
      </div>

      {/* Buckets + growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BucketTable summary={summary} />
        {growth && <GrowthChart growth={growth} rangeLabel={preset.label} />}
      </div>

      {/* Dedicated Trips & Events cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownCard title="Trips" total={totalTrips} buckets={[
          { label: 'Active',    value: summary.trips.active,    color: 'teal' },
          { label: 'Upcoming',  value: summary.trips.upcoming,  color: 'blue' },
          { label: 'Completed', value: summary.trips.completed, color: 'slate' },
          { label: 'Archived',  value: summary.trips.archived,  color: 'muted' },
        ]} />
        <BreakdownCard title="Events" total={totalEvents} buckets={[
          { label: 'Active',    value: summary.events.active,    color: 'teal' },
          { label: 'Upcoming',  value: summary.events.upcoming,  color: 'blue' },
          { label: 'Completed', value: summary.events.completed, color: 'slate' },
          { label: 'Archived',  value: summary.events.archived,  color: 'muted' },
        ]} />
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
function GrowthChart({ growth, rangeLabel }) {
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
        <h2 className="text-sm font-bold text-slate-800">Growth — {rangeLabel}</h2>
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

/* ── Trips / Events breakdown card ───────────────────────────── */
function BreakdownCard({ title, total, buckets }) {
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const colorMap = {
    teal:  { bar: 'bg-teal-500',  text: 'text-teal-700' },
    blue:  { bar: 'bg-blue-400',  text: 'text-blue-700' },
    slate: { bar: 'bg-slate-400', text: 'text-slate-600' },
    muted: { bar: 'bg-slate-200', text: 'text-slate-400' },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="text-2xl font-extrabold text-slate-800 tabular-nums">{total.toLocaleString()}</span>
      </div>
      <div className="space-y-3">
        {buckets.map((b) => {
          const c = colorMap[b.color];
          const pct = Math.round((b.value / max) * 100);
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600 font-medium">{b.label}</span>
                <span className={`font-bold tabular-nums ${c.text}`}>{b.value.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
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
