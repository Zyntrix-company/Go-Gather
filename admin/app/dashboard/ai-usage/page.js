'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { apiJSON } from '../../../lib/api';

const TEAL = '#0d9488';
const PERIODS = ['day', 'week', 'month', 'quarter'];
const BUCKET_CAP = { day: 60, week: 26, month: 12, quarter: 8 };

export default function AiUsagePage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    Promise.all([
      apiJSON('/admin/ai-usage'),
      apiJSON('/admin/ai-usage/history?days=400'),
    ])
      .then(([usage, hist]) => { setData(usage); setHistory(hist?.history ?? []); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return null;

  const m = data.metrics;
  const s = data.summary;
  const errorPercent = m ? (m.errorRate * 100).toFixed(1) : null;
  const thresholdPercent = m ? (m.alertThreshold * 100).toFixed(1) : null;
  const overThreshold = m && m.errorRate > m.alertThreshold;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
          AI Usage — Swee
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">How many chats Swee has handled, and whether Gemini is keeping up</p>
      </div>

      {s ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Today" value={s.today} color="teal" />
          <StatCard label="This week" value={s.thisWeek} color="teal" />
          <StatCard label="This month" value={s.thisMonth} color="slate" />
          <StatCard label="This quarter" value={s.thisQuarter} color="slate" />
        </div>
      ) : (
        <EmptyNote text="Usage figures aren't available yet — they fill in as Swee handles chats." />
      )}

      <UsageTrendChart history={history} period={period} onPeriodChange={setPeriod} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GeminiRateLimitCard summary={s} rateLimits={data.rateLimits} />
        {data.circuit && <CircuitBreakerCard circuit={data.circuit} />}
      </div>

      {m && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Right now</h2>
          <p className="text-xs text-slate-400 -mt-2 mb-4">
            A live snapshot of the last {m.windowMinutes} minutes — resets whenever the server restarts,
            unlike the figures above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MiniStat label={`Chats (${m.windowMinutes}m)`} value={m.totalRequests} />
            <MiniStat label="Failed" value={m.failedRequests} />
            <MiniStat label="Error rate" value={`${errorPercent}%`} warn={overThreshold}
              hint={`alert above ${thresholdPercent}%`} />
          </div>
        </div>
      )}

      {typeof data.sweeReportsTotal === 'number' && (
        <StatCard label="Reported issues (all time)" value={data.sweeReportsTotal} color="slate" wide />
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-amber-700 mb-1">About this data</p>
        <p className="text-xs text-amber-600 leading-relaxed">{data.note}</p>
      </div>
    </div>
  );
}

/* ── Bucketing helpers ────────────────────────────────────────── */
function toDateKey(raw) { return String(raw).slice(0, 10); }

function isoWeekStart(dateKey) {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function monthStart(dateKey) { return `${dateKey.slice(0, 7)}-01`; }
function quarterStart(dateKey) {
  const [y, mo] = dateKey.split('-').map(Number);
  const qMonth = Math.floor((mo - 1) / 3) * 3 + 1;
  return `${y}-${String(qMonth).padStart(2, '0')}-01`;
}
const BUCKET_KEY_FN = { day: (d) => d, week: isoWeekStart, month: monthStart, quarter: quarterStart };

function bucketHistory(history, period) {
  const keyFn = BUCKET_KEY_FN[period];
  const map = new Map();
  for (const row of history) {
    const key = keyFn(toDateKey(row.date));
    const prev = map.get(key) || { key, total: 0 };
    prev.total += Number(row.total) || 0;
    map.set(key, prev);
  }
  const arr = Array.from(map.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  return arr.slice(-BUCKET_CAP[period]);
}

function formatBucketLabel(key, period) {
  const d = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return key;
  if (period === 'day') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (period === 'week') return `Wk ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  if (period === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} '${String(d.getUTCFullYear()).slice(2)}`;
}

/* ── Trend chart ──────────────────────────────────────────────── */
function UsageTrendChart({ history, period, onPeriodChange }) {
  const buckets = useMemo(() => bucketHistory(history || [], period), [history, period]);
  const [hoverIdx, setHoverIdx] = useState(null);

  const hasData = buckets.some((b) => b.total > 0);
  const W = 720; const H = 240;
  const PAD = { t: 16, r: 12, b: 34, l: 34 };
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...buckets.map((b) => b.total), 1);
  const n = buckets.length;
  const bandW = n > 0 ? iW / n : iW;
  const barW = Math.min(24, Math.max(bandW * 0.55, 4));
  const yFor = (v) => PAD.t + iH - (v / maxVal) * iH;
  const gridVals = [...new Set([0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal])]
    .sort((a, b) => a - b);
  const labelStep = n <= 10 ? 1 : Math.ceil(n / 8);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Swee chats over time</h2>
          <p className="text-xs text-slate-400 mt-0.5">Total chats handled, grouped by {period}</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => { setHoverIdx(null); onPeriodChange(p); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                period === p ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400 text-center py-16">
          No Swee usage recorded yet — this chart fills in as chats happen.
        </p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }}>
            {gridVals.map((v) => {
              const y = yFor(v);
              return (
                <g key={v}>
                  <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toLocaleString()}</text>
                </g>
              );
            })}
            {buckets.map((b, i) => {
              const cx = PAD.l + bandW * i + bandW / 2;
              const h = (b.total / maxVal) * iH;
              const y = PAD.t + iH - h;
              const isHover = hoverIdx === i;
              const showLabel = i % labelStep === 0 || i === n - 1 || isHover;
              return (
                <g key={b.key} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}>
                  <rect x={cx - bandW / 2} y={PAD.t} width={bandW} height={iH} fill="transparent" />
                  <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(h, 1)}
                    rx={4} ry={4} fill={TEAL} opacity={isHover ? 1 : 0.82} />
                  {showLabel && (
                    <text x={cx} y={H - 10} textAnchor="middle" fontSize="9"
                      fill={isHover ? '#0f172a' : '#94a3b8'} fontWeight={isHover ? 600 : 400}>
                      {formatBucketLabel(b.key, period)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hoverIdx != null && buckets[hoverIdx] && (
            <ChartTooltip bucket={buckets[hoverIdx]} period={period}
              xPct={Math.min(94, Math.max(6, ((PAD.l + bandW * hoverIdx + bandW / 2) / W) * 100))} />
          )}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ bucket, period, xPct }) {
  return (
    <div
      className="absolute pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg -translate-x-1/2 whitespace-nowrap z-10"
      style={{ left: `${xPct}%`, top: 4 }}
    >
      <div className="font-semibold">{bucket.total.toLocaleString()} chats</div>
      <div className="text-slate-300 text-[10px] mt-0.5">{formatBucketLabel(bucket.key, period)}</div>
    </div>
  );
}

/* ── Gemini rate limits ───────────────────────────────────────── */
function GeminiRateLimitCard({ summary, rateLimits }) {
  const g = summary?.geminiRateLimited;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-800 mb-1">Gemini rate limits</h2>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        How often Swee got throttled by Google&rsquo;s Gemini API, and the limits we enforce per user.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniStat label="Today" value={g?.today ?? 0} warn={(g?.today ?? 0) > 0} />
        <MiniStat label="This week" value={g?.thisWeek ?? 0} warn={(g?.thisWeek ?? 0) > 0} />
        <MiniStat label="This month" value={g?.thisMonth ?? 0} warn={(g?.thisMonth ?? 0) > 0} />
      </div>
      <div className="border-t border-slate-50 pt-3 text-xs text-slate-500 leading-relaxed">
        Each user can send up to <strong className="text-slate-700">{rateLimits?.perUserPerHour ?? '—'}</strong> chats
        per hour and <strong className="text-slate-700">{rateLimits?.perUserPerDay ?? '—'}</strong> per day before
        Swee asks them to slow down.
      </div>
    </div>
  );
}

function MiniStat({ label, value, warn, hint }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
      <p className={`text-xl font-bold tabular-nums ${warn ? 'text-amber-600' : 'text-slate-700'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
      {hint && <p className="text-[10px] text-slate-300 mt-0.5">{hint}</p>}
    </div>
  );
}

/* ── Circuit breaker ──────────────────────────────────────────── */
function CircuitBreakerCard({ circuit }) {
  const cfg = {
    closed: {
      label: 'Healthy', icon: ShieldCheck, dot: 'bg-teal-500',
      text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-100',
      desc: 'Gemini requests are flowing normally.',
    },
    'half-open': {
      label: 'Testing recovery', icon: ShieldQuestion, dot: 'bg-amber-500',
      text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100',
      desc: 'Cooldown elapsed — the next request will decide whether it fully reopens or trips again.',
    },
    open: {
      label: 'Tripped', icon: ShieldAlert, dot: 'bg-red-500',
      text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100',
      desc: 'Too many recent Gemini failures — Swee is fast-failing chat requests until the cooldown passes.',
    },
  }[circuit.state] ?? {
    label: circuit.state, icon: ShieldQuestion, dot: 'bg-slate-400',
    text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', desc: '',
  };
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-800 mb-3">Circuit breaker</h2>
      <div className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 mb-4`}>
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.text}`} strokeWidth={1.75} />
        <div>
          <p className={`text-sm font-semibold ${cfg.text} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cfg.desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Recent failures</p>
          <p className="font-bold text-slate-800 tabular-nums mt-0.5">{circuit.recentFailures} / {circuit.failureThreshold}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cooldown</p>
          <p className="font-bold text-slate-800 tabular-nums mt-0.5">{Math.round(circuit.cooldownMs / 1000)}s</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, wide }) {
  const colorCls = { teal: 'text-teal-600', slate: 'text-slate-800', red: 'text-red-600' }[color] ?? 'text-slate-800';
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${wide ? 'sm:col-span-3' : ''}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${colorCls}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-400">
      {text}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-24" />)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 h-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-40" />)}
      </div>
    </div>
  );
}
