'use client';

import { useState, useEffect, useMemo } from 'react';
import { Wallet, Camera, FileText, StickyNote } from 'lucide-react';
import { apiJSON } from '../../../lib/api';

/* ── Date-range presets (created-date filter) ─────────────────── */
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
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
    { key: 'all', label: 'All time', from: null, to: null, rangeLabel: 'all time' },
    { key: '7d', label: 'Last 7 days', from: startOfDay(addDays(now, -7)), to: now, rangeLabel: 'within the last 7 days' },
    { key: '30d', label: 'Last 30 days', from: startOfDay(addDays(now, -30)), to: now, rangeLabel: 'within the last 30 days' },
    { key: 'this_week', label: 'This week', from: thisWeekStart, to: now, rangeLabel: 'this week' },
    { key: 'last_week', label: 'Last week', from: lastWeekStart, to: lastWeekEnd, rangeLabel: 'last week' },
    { key: 'this_month', label: 'This month', from: thisMonthStart, to: now, rangeLabel: 'this month' },
    { key: 'last_month', label: 'Last month', from: lastMonthStart, to: lastMonthEnd, rangeLabel: 'last month' },
  ];
}

export default function TripsEventsPage() {
  const presets = useMemo(buildPresets, []);
  const [presetKey, setPresetKey] = useState('all');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const preset = presets.find((p) => p.key === presetKey) ?? presets[0];

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (preset.from) params.set('from', preset.from.toISOString());
    if (preset.to)   params.set('to', preset.to.toISOString());
    if (preset.from || preset.to) params.set('label', preset.rangeLabel);
    apiJSON(`/admin/trips-events?${params}`).then(setData).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  if (loading) return <Skeleton />;
  if (!data)   return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
            Trips &amp; Events
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Created {preset.rangeLabel}</p>
        </div>
        <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-teal-500">
          {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BucketCard title="Trips" total={data.trips.total} buckets={[
          { label: 'Active',    value: data.trips.active,    color: 'teal' },
          { label: 'Upcoming',  value: data.trips.upcoming,  color: 'blue' },
          { label: 'Completed', value: data.trips.completed, color: 'slate' },
          { label: 'Archived',  value: data.trips.archived,  color: 'muted' },
        ]} />
        <BucketCard title="Events" total={data.events.total} buckets={[
          { label: 'Active',    value: data.events.active,    color: 'teal' },
          { label: 'Upcoming',  value: data.events.upcoming,  color: 'blue' },
          { label: 'Completed', value: data.events.completed, color: 'slate' },
          { label: 'Archived',  value: data.events.archived,  color: 'muted' },
        ]} />
      </div>

      {/* Shared activity */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Shared Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ActivityStat label="Expenses logged" value={data.activity.expenses} icon={Wallet} />
          <ActivityStat label="Photos uploaded"  value={data.activity.photos}   icon={Camera} />
          <ActivityStat label="Documents shared" value={data.activity.docs}     icon={FileText} />
          <ActivityStat label="Notes created"    value={data.activity.notes}    icon={StickyNote} />
        </div>
      </div>
    </div>
  );
}

/* ── Bucket card ──────────────────────────────────────────────── */
function BucketCard({ title, total, buckets }) {
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const colorMap = {
    teal:  { bar: 'bg-teal-500',  text: 'text-teal-700',  bg: 'bg-teal-50' },
    blue:  { bar: 'bg-blue-400',  text: 'text-blue-700',  bg: 'bg-blue-50' },
    slate: { bar: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100' },
    muted: { bar: 'bg-slate-200', text: 'text-slate-400', bg: 'bg-slate-50' },
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

function ActivityStat({ label, value, icon: Icon }) {
  return (
    <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
      <Icon className="w-6 h-6 mx-auto mb-1.5 text-teal-600" strokeWidth={1.75} />
      <p className="text-2xl font-bold text-slate-800 tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 h-64" />
        <div className="bg-white rounded-2xl border border-slate-100 h-64" />
      </div>
    </div>
  );
}
