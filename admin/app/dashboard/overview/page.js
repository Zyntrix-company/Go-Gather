'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function OverviewPage() {
  const [summary, setSummary] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiJSON('/admin/dashboard/summary'),
      apiJSON(`/admin/dashboard/growth?days=${days}`),
    ]).then(([s, g]) => {
      setSummary(s);
      setGrowth(g);
    }).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <PageSkeleton />;
  if (!summary) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader days={days} setDays={setDays} />
      <SummaryCards summary={summary} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TripEventBuckets summary={summary} />
        {growth && <GrowthChart growth={growth} />}
      </div>
    </div>
  );
}

function PageHeader({ days, setDays }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>
          Overview
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform snapshot</p>
      </div>
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-teal-500"
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>
    </div>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Users', value: summary.users.total, sub: `${summary.users.active} active`, color: 'teal' },
    { label: 'Trips', value: summary.trips.active + summary.trips.upcoming, sub: `${summary.trips.upcoming} upcoming`, color: 'slate' },
    { label: 'Events', value: summary.events.active + summary.events.upcoming, sub: `${summary.events.upcoming} upcoming`, color: 'slate' },
    { label: 'Contact', value: summary.contact.total, sub: `${summary.contact.unread} unread`, color: summary.contact.unread > 0 ? 'amber' : 'slate' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
          <p className={`text-3xl font-bold mt-1 ${c.color === 'teal' ? 'text-teal-600' : c.color === 'amber' ? 'text-amber-600' : 'text-slate-800'}`}>
            {c.value.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

function TripEventBuckets({ summary }) {
  const rows = [
    { label: 'Trips upcoming', value: summary.trips.upcoming },
    { label: 'Trips active', value: summary.trips.active },
    { label: 'Trips completed', value: summary.trips.completed },
    { label: 'Trips archived', value: summary.trips.archived },
    { label: 'Events upcoming', value: summary.events.upcoming },
    { label: 'Events active', value: summary.events.active },
    { label: 'Events completed', value: summary.events.completed },
    { label: 'Events archived', value: summary.events.archived },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-800 mb-4">Activity Buckets</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{r.label}</span>
            <span className="font-semibold text-slate-800">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthChart({ growth }) {
  const series = [
    { key: 'users', label: 'Users', color: '#0d9488' },
    { key: 'trips', label: 'Trips', color: '#64748b' },
    { key: 'events', label: 'Events', color: '#94a3b8' },
  ];

  // Build a unified date index
  const dateSet = new Set();
  series.forEach(({ key }) => growth[key].forEach((d) => dateSet.add(d.date)));
  const dates = Array.from(dateSet).sort();

  const dataByKey = {};
  series.forEach(({ key }) => {
    dataByKey[key] = {};
    growth[key].forEach((d) => { dataByKey[key][d.date] = d.count; });
  });

  const allCounts = series.flatMap(({ key }) => growth[key].map((d) => d.count));
  const maxVal = Math.max(...allCounts, 1);

  const W = 480;
  const H = 160;
  const PAD = { t: 8, r: 8, b: 28, l: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xPos = (i) => PAD.l + (i / Math.max(dates.length - 1, 1)) * innerW;
  const yPos = (v) => PAD.t + innerH - (v / maxVal) * innerH;

  function linePath(key) {
    if (!dates.length) return '';
    return dates
      .map((d, i) => {
        const v = dataByKey[key][d] ?? 0;
        return `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-800">Growth — last {growth.days} days</h2>
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
        <p className="text-sm text-slate-400 py-8 text-center">No data for this period</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '180px' }}>
          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = PAD.t + f * innerH;
            return (
              <g key={f}>
                <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {Math.round(maxVal * (1 - f))}
                </text>
              </g>
            );
          })}
          {/* X axis labels (first/mid/last) */}
          {[0, Math.floor(dates.length / 2), dates.length - 1].map((i) => (
            <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {dates[i]?.slice(5)}
            </text>
          ))}
          {/* Lines */}
          {series.map((s) => (
            <path
              key={s.key}
              d={linePath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 h-64" />
        <div className="bg-white rounded-2xl border border-slate-100 h-64 lg:col-span-2" />
      </div>
    </div>
  );
}
