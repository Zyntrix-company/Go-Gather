'use client';

import { useState, useEffect } from 'react';
import { apiJSON } from '../../../lib/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

export default function HealthPage() {
  const [system, setSystem] = useState(null);

  async function loadSystem() {
    await apiJSON('/admin/system/status').then(setSystem).catch(() => {});
  }

  useEffect(() => { loadSystem(); }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
        Health
      </h1>

      <EmergencyStop system={system} onChange={loadSystem} />
    </div>
  );
}

/* ── Emergency stop (maintenance mode) ───────────────────────────── */

const STOP_PHRASE = 'STOP ALL SERVICES';

function EmergencyStop({ system, onChange }) {
  const [stage,     setStage]     = useState(null); // null | 'confirm1' | 'confirm2'
  const [typed,     setTyped]     = useState('');
  const [reason,    setReason]    = useState('');
  const [resuming,  setResuming]  = useState(false);
  const [stopping,  setStopping]  = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const [error,     setError]     = useState('');

  function closeAll() {
    setStage(null);
    setTyped('');
    setReason('');
    setError('');
  }

  async function handleStop() {
    setStopping(true);
    setError('');
    try {
      await apiJSON('/admin/system/stop', { method: 'POST', body: JSON.stringify({ reason: reason.trim() || undefined }) });
      closeAll();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Failed to stop services');
    } finally {
      setStopping(false);
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      await apiJSON('/admin/system/resume', { method: 'POST', body: JSON.stringify({}) });
      setConfirmResume(false);
      onChange?.();
    } catch { /* leave banner as-is; admin can retry */ }
    finally { setResuming(false); }
  }

  if (system?.active) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 space-y-2">
        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Emergency stop is ACTIVE — all non-admin traffic is being rejected
        </div>
        <p className="text-xs text-red-600 leading-relaxed">
          {system.enabledByEmail && <>Enabled by <span className="font-semibold">{system.enabledByEmail}</span></>}
          {system.enabledAt && <> at {new Date(system.enabledAt).toLocaleString()}</>}
          {system.reason && <>. Reason: “{system.reason}”</>}
        </p>
        <button onClick={() => setConfirmResume(true)} disabled={resuming}
          className="mt-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
          {resuming ? 'Resuming…' : 'Resume services'}
        </button>

        {confirmResume && (
          <ConfirmDialog
            title="Resume all services?"
            body="This turns the emergency stop off and immediately lets normal traffic through again."
            confirmLabel="Resume services"
            busy={resuming}
            onCancel={() => setConfirmResume(false)}
            onConfirm={handleResume}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Emergency stop</p>
        <p className="text-xs text-slate-400 mt-0.5">Immediately blocks all app/website traffic. Use only for a live incident.</p>
      </div>
      <button onClick={() => setStage('confirm1')}
        className="shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
        Stop all services
      </button>

      {stage === 'confirm1' && (
        <ConfirmDialog
          title="Stop all services?"
          body="This takes GatherrGo down for every user right now — the mobile app and website will get errors until you resume it. This does not affect the admin panel, so you can undo it from here."
          confirmLabel="Continue"
          danger
          onCancel={closeAll}
          onConfirm={() => setStage('confirm2')}
        />
      )}

      {stage === 'confirm2' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-2">Final confirmation</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Type <span className="font-mono font-bold text-red-600">{STOP_PHRASE}</span> to confirm.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder={STOP_PHRASE}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm text-slate-800 font-mono mb-3"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional, shown to other admins)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm text-slate-800 mb-4"
            />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={closeAll} disabled={stopping}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleStop} disabled={stopping || typed !== STOP_PHRASE}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {stopping ? 'Stopping…' : 'Stop all services now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
