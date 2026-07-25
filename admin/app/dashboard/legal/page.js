'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiJSON } from '../../../lib/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

/** Sandboxed iframe preview — scripts do not run (sandbox). Final output still sanitised on the server. */
function buildPreviewSrcDoc(html) {
  const body = (html && html.trim()) ? html : '<p style="color:#94a3b8;margin:0">Nothing to preview yet.</p>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body{margin:0;padding:1rem 1.125rem;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
    font-size:15px;line-height:1.6;color:#334155;background:#f8fafc;}
  p{margin:0 0 0.75rem 0}
  h1,h2,h3,h4{color:#0f172a;font-weight:700;line-height:1.3;margin:1.25rem 0 0.5rem 0}
  h1{font-size:1.375rem} h2{font-size:1.2rem} h3{font-size:1.05rem}
  ul,ol{padding-left:1.35rem;margin:0 0 0.75rem 0}
  a{color:#0d9488;text-decoration:underline}
  table{border-collapse:collapse;width:100%;font-size:14px;margin:0.5rem 0 1rem 0}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
  blockquote{margin:0.75rem 0;padding-left:1rem;border-left:3px solid #99f6e4;color:#475569}
</style></head><body>${body}</body></html>`;
}

const TYPES = [
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms & Conditions' },
];

export default function LegalPage() {
  const [tab, setTab] = useState('privacy');
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState([]);
  const [suggestedNext, setSuggestedNext] = useState('1.0.0');
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({ version: '', contentHtml: '', effectiveAt: '' });
  const [saving, setSaving] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  /** @type {'edit' | 'split' | 'preview'} */
  const [editorView, setEditorView] = useState('split');

  const previewSrcDoc = useMemo(() => buildPreviewSrcDoc(form.contentHtml), [form.contentHtml]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiJSON(`/admin/legal/versions?documentType=${tab}`)
      .then((data) => {
        if (!data) return;
        setVersions(data.versions || []);
        setSuggestedNext(data.suggestedNext || '1.0.0');
        setCurrent(data.current || null);
        const today = new Date().toISOString().slice(0, 10);
        setForm((f) => ({
          ...f,
          version: data.suggestedNext || '1.0.0',
          effectiveAt: f.effectiveAt || today,
        }));
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function openPublish() {
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      version: suggestedNext,
      contentHtml: current?.contentHtml || '',
      effectiveAt: today,
    });
    setEditorView('split');
    setEditorOpen(true);
    setError('');
  }

  async function runPublish() {
    setSaving(true);
    setError('');
    try {
      await apiJSON('/admin/legal/publish', {
        method: 'POST',
        body: JSON.stringify({
          documentType: tab,
          version: form.version.trim(),
          contentHtml: form.contentHtml,
          effectiveAt: form.effectiveAt ? new Date(form.effectiveAt).toISOString() : undefined,
        }),
      });
      setEditorOpen(false);
      setConfirmPublish(false);
      load();
    } catch (err) {
      setError(err.message || 'Publish failed');
      setConfirmPublish(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>
          Legal documents
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Published versions are shown in the app and on the marketing site. Patch version is suggested automatically (e.g. 1.1.1 → 1.1.2).
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && !editorOpen && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live version</p>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : current ? (
              <p className="text-lg font-bold text-slate-900">
                v{current.version}
                <span className="text-sm font-normal text-slate-500 ml-2">
                  effective {current.effectiveAt ? new Date(current.effectiveAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </p>
            ) : (
              <p className="text-slate-500 text-sm">Nothing published yet.</p>
            )}
          </div>
          <button
            type="button"
            onClick={openPublish}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Publish new version
          </button>
        </div>
        <p className="text-xs text-slate-500">Suggested next version: <strong>{suggestedNext}</strong></p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 text-sm">Publication history</div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : !versions.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">No published versions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Version</th>
                  <th className="text-left px-4 py-2 font-semibold">Effective</th>
                  <th className="text-left px-4 py-2 font-semibold">Published</th>
                  <th className="text-left px-4 py-2 font-semibold">Current</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono">{v.version}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {v.effectiveAt ? new Date(v.effectiveAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">{v.isCurrent ? <span className="text-teal-700 font-semibold">Yes</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Publish {TYPES.find((t) => t.id === tab)?.label}</h2>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-sm font-semibold" onClick={() => setEditorOpen(false)}>
                Close
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setConfirmPublish(true); }} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-500 uppercase">Version (MAJOR.MINOR.PATCH)</span>
                    <input
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                      value={form.version}
                      onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-500 uppercase">Effective date</span>
                    <input
                      type="date"
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      value={form.effectiveAt}
                      onChange={(e) => setForm((f) => ({ ...f, effectiveAt: e.target.value }))}
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">HTML content</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
                    {[
                      { id: 'edit', label: 'Edit only' },
                      { id: 'split', label: 'Edit + preview' },
                      { id: 'preview', label: 'Preview only' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setEditorView(id)}
                        className={`px-3 py-1.5 transition-colors ${
                          editorView === id ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`grid gap-4 min-h-0 ${
                    editorView === 'split' ? 'grid-cols-1 lg:grid-cols-2 lg:min-h-[380px]' : 'grid-cols-1'
                  }`}>
                  {(editorView === 'edit' || editorView === 'split') && (
                    <label className="block min-h-0 flex flex-col">
                      <span className="text-xs text-slate-500 mb-1">Source (sanitised on save)</span>
                      <textarea
                        className="w-full flex-1 min-h-[260px] lg:min-h-0 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                        value={form.contentHtml}
                        onChange={(e) => setForm((f) => ({ ...f, contentHtml: e.target.value }))}
                        required
                        placeholder="<p>...</p>"
                      />
                    </label>
                  )}
                  {(editorView === 'preview' || editorView === 'split') && (
                    <div className="flex flex-col min-h-[260px] lg:min-h-0">
                      <span className="text-xs text-slate-500 mb-1">Live preview</span>
                      <iframe
                        title="HTML preview"
                        sandbox=""
                        className="w-full flex-1 min-h-[280px] rounded-xl border border-slate-200 bg-slate-50"
                        srcDoc={previewSrcDoc}
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                        Preview uses a locked-down frame (no scripts). The server still applies the final whitelist when you publish.
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  After publish, verified users receive an email in batches. Users must acknowledge the new version in the app.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setEditorOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl">
                  {saving ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmPublish && (
        <ConfirmDialog
          title={`Publish v${form.version.trim() || suggestedNext}?`}
          body={<>
            This becomes the live {TYPES.find((t) => t.id === tab)?.label.toLowerCase()}. Every verified user is emailed
            in batches and must acknowledge it in the app before continuing. <strong>This cannot be unpublished.</strong>
          </>}
          confirmLabel="Publish"
          danger
          busy={saving}
          onCancel={() => setConfirmPublish(false)}
          onConfirm={runPublish}
        />
      )}
    </div>
  );
}
