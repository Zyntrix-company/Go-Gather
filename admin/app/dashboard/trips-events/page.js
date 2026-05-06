'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

export default function TripsEventsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJSON('/admin/trips-events').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data)   return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
        Trips &amp; Events
      </h1>

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
          <ActivityStat label="Expenses logged" value={data.activity.expenses} icon="💰" />
          <ActivityStat label="Photos uploaded"  value={data.activity.photos}   icon="📷" />
          <ActivityStat label="Documents shared" value={data.activity.docs}     icon="📄" />
          <ActivityStat label="Notes created"    value={data.activity.notes}    icon="📝" />
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

function ActivityStat({ label, value, icon }) {
  return (
    <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
      <div className="text-2xl mb-1">{icon}</div>
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
