'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { apiJSON } from '../../../lib/api';

export default function AiUsagePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJSON('/admin/ai-usage').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return null;

  const m = data.metrics;
  const errorPercent = m ? (m.errorRate * 100).toFixed(1) : null;
  const thresholdPercent = m ? (m.alertThreshold * 100).toFixed(1) : null;
  const overThreshold = m && m.errorRate > m.alertThreshold;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
          AI Usage — Swee
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Chat volume and error rate for the AI assistant</p>
      </div>

      {m ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label={`Requests (${m.windowMinutes}m window)`} value={m.totalRequests} color="teal" />
          <StatCard label="Failed requests" value={m.failedRequests} color="slate" />
          <StatCard label="Error rate" value={`${errorPercent}%`}
            sub={`alert threshold ${thresholdPercent}%`} color={overThreshold ? 'red' : 'teal'} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-400">
          Metrics unavailable — the AI module may not be configured in this environment.
        </div>
      )}

      {data.circuit && <CircuitBreakerCard circuit={data.circuit} />}

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

function Skeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-24" />)}
      </div>
    </div>
  );
}
