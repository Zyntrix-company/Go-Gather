'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';

const GROUPS = [
  {
    label: 'Infrastructure',
    services: [
      { key: 'api',     name: 'API Server',    detail: 'Express · Node.js' },
      { key: 'db',      name: 'Database',       detail: 'PostgreSQL · AWS RDS' },
      { key: 'storage', name: 'File Storage',   detail: 'AWS S3' },
    ],
  },
  {
    label: 'Communication',
    services: [
      { key: 'email', name: 'Email',             detail: 'AWS SES' },
      { key: 'fcm',   name: 'Push — Mobile',     detail: 'Firebase FCM v1' },
      { key: 'sns',   name: 'Push — Legacy',     detail: 'AWS SNS' },
    ],
  },
  {
    label: 'Auth & OAuth',
    services: [
      { key: 'googleOAuth',    name: 'Google',    detail: 'Sign-in & Gmail import' },
      { key: 'facebookOAuth',  name: 'Facebook',  detail: 'Social login' },
      { key: 'microsoftOAuth', name: 'Microsoft', detail: 'Outlook import' },
    ],
  },
  {
    label: 'Integrations',
    services: [
      { key: 'gemini', name: 'AI Assistant', detail: 'Google Gemini 2.5 Flash' },
      { key: 'branch', name: 'Deep Links',   detail: 'Branch.io' },
    ],
  },
];

const STATUS = {
  ok:             { dot: 'bg-emerald-500', label: 'Operational',     text: 'text-emerald-700' },
  configured:     { dot: 'bg-emerald-500', label: 'Configured',      text: 'text-emerald-700' },
  error:          { dot: 'bg-red-500',     label: 'Error',           text: 'text-red-600' },
  not_configured: { dot: 'bg-slate-300',   label: 'Not configured',  text: 'text-slate-400' },
  unknown:        { dot: 'bg-amber-400',   label: 'Unknown',         text: 'text-amber-600' },
};

function getStatus(key) {
  return STATUS[key] ?? { dot: 'bg-amber-400', label: key, text: 'text-amber-600' };
}

export default function HealthPage() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    await apiJSON('/admin/health').then(setData).catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const allServices = data ? GROUPS.flatMap((g) => g.services) : [];
  const issues = allServices.filter((s) => data && data[s.key] === 'error').length;
  const unchecked = allServices.filter((s) => data && data[s.key] === 'unknown').length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
            Health
          </h1>
          {data && (
            <p className="text-sm text-slate-400 mt-0.5">
              Checked at {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button onClick={load} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white
            text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {refreshing ? 'Checking' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 animate-pulse">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <div className="w-28 h-3.5 bg-slate-100 rounded" />
              </div>
              <div className="w-20 h-3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Overall status strip */}
          {data && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
              ${issues > 0
                ? 'bg-red-50 text-red-700 border border-red-100'
                : unchecked > 0
                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${issues > 0 ? 'bg-red-500' : unchecked > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              {issues > 0
                ? `${issues} service${issues > 1 ? 's' : ''} reporting errors`
                : unchecked > 0
                  ? 'Some services could not be verified'
                  : 'All services operational'}
              {data.requests30m != null && (
                <span className="ml-auto font-normal text-xs opacity-70">
                  {data.requests30m.toLocaleString()} req / 30 min
                </span>
              )}
            </div>
          )}

          {/* Service list */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {GROUPS.map((group, gi) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="px-5 py-2 bg-slate-50 border-y border-slate-100 first:border-t-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {group.label}
                  </span>
                </div>

                {/* Service rows */}
                {group.services.map((svc, si) => {
                  const st = data ? getStatus(data[svc.key]) : getStatus('unknown');
                  const isLast = si === group.services.length - 1 && gi === GROUPS.length - 1;
                  return (
                    <div key={svc.key}
                      className={`flex items-center justify-between px-5 py-3 ${!isLast ? 'border-b border-slate-50' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{svc.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{svc.detail}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ml-4 ${st.text}`}>
                        {data ? st.label : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
