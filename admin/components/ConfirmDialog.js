'use client';

/**
 * Generic confirmation modal. Prefer this over window.confirm() for anything
 * destructive or hard to reverse (delete, publish, logout) — consistent look,
 * and room for a real explanation instead of a one-line browser prompt.
 */
export default function ConfirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-2xl p-6">
        <h2 className="text-base font-bold text-slate-900 mb-2">{title}</h2>
        <div className="text-sm text-slate-600 leading-relaxed mb-6">{body}</div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
