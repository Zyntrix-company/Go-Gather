'use client';

import { useState, useEffect, useRef } from 'react';
import { apiJSON, apiFetch, getToken } from '../../../lib/api';

const TITLE_SOFT_MAX = 20;
const SUBTITLE_SOFT_MAX = 30;

const EMPTY = {
  title: '', subtitle: '', imageUrl: '', hyperlink: '', sortOrder: '', active: true,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    apiJSON('/admin/deals').then((data) => { if (data) setDeals(data); }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(EMPTY); setEditing('new'); setError(''); }

  function openEdit(deal) {
    setForm({
      title: deal.title,
      subtitle: deal.subtitle ?? '',
      imageUrl: deal.imageUrl,
      hyperlink: deal.hyperlink ?? '',
      sortOrder: deal.sortOrder ?? '',
      active: deal.active,
    });
    setEditing(deal); setError('');
  }

  function closeEditor() { setEditing(null); setError(''); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    const payload = {
      ...form,
      subtitle: form.subtitle || null,
      hyperlink: form.hyperlink || null,
      sortOrder: form.sortOrder !== '' ? Number(form.sortOrder) : null,
    };
    try {
      if (editing === 'new') {
        await apiJSON('/admin/deals', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiJSON(`/admin/deals/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      load(); closeEditor();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this deal?')) return;
    await apiFetch(`/admin/deals/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>Amazing Deals</h1>
          <p className="text-sm text-slate-500 mt-0.5">{deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
          + New deal
        </button>
      </div>

      {editing && (
        <EditorModal
          editing={editing} form={form} setForm={setForm}
          saving={saving} error={error}
          onClose={closeEditor} onSave={handleSave}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : !deals.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">No deals yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Image', 'Title', 'Subtitle', 'Link', 'Order', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {deals.map((d, i) => (
                  <tr key={d.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      {d.imageUrl ? (
                        <img src={d.imageUrl} alt={d.title}
                          className="w-14 h-10 object-cover rounded-lg border border-slate-200"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-14 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">No img</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[140px] truncate">{d.title}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{d.subtitle || <span className="italic text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {d.hyperlink ? (
                        <a href={d.hyperlink} target="_blank" rel="noreferrer"
                          className="text-teal-600 hover:underline text-xs truncate block max-w-[120px]">
                          {d.hyperlink.replace(/^https?:\/\//, '')}
                        </a>
                      ) : <span className="text-slate-300 text-xs italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{d.sortOrder ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border
                        ${d.active ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {d.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(d)} className="text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors">Edit</button>
                        <button onClick={() => handleDelete(d.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Editor modal ─────────────────────────────────────────────── */
function EditorModal({ editing, form, setForm, saving, error, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{editing === 'new' ? 'New deal' : 'Edit deal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSave} className="p-6 space-y-4">

          <CharField
            label="Title *"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="e.g. Taj Coral Reef, Maldives"
            softMax={TITLE_SOFT_MAX}
            hint={`≤ ${TITLE_SOFT_MAX} chars fits the card without truncation`}
          />

          <CharField
            label="Subtitle"
            value={form.subtitle}
            onChange={(v) => setForm((f) => ({ ...f, subtitle: v }))}
            placeholder="e.g. Overwater villas from ₹18,999/night"
            softMax={SUBTITLE_SOFT_MAX}
            hint={`≤ ${SUBTITLE_SOFT_MAX} chars fits the card without truncation`}
            optional
          />

          <ImageField value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />

          <Field
            label="Hyperlink"
            value={form.hyperlink}
            onChange={(v) => setForm((f) => ({ ...f, hyperlink: v }))}
            placeholder="https://example.com/deal"
            type="url"
            hint="Tapping the card in the app opens this URL"
            optional
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Sort order"
              value={form.sortOrder}
              onChange={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
              placeholder="1"
              type="number"
              optional
            />
            <div className="flex items-end pb-1">
              <Toggle label="Active (visible in app)" checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── CharField — text input with live character counter ──────── */
function CharField({ label, value, onChange, placeholder, softMax, hint, optional }) {
  const len = value.length;
  const over = len > softMax;
  const near = !over && len > softMax * 0.75;
  const counterColor = over ? 'text-red-500' : near ? 'text-amber-500' : 'text-slate-400';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="block text-sm font-semibold text-slate-700">
          {label}{optional && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
        </label>
        <span className={`text-xs font-medium tabular-nums ${counterColor}`}>{len}/{softMax}</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm text-slate-800
          focus:ring-2 transition-colors
          ${over
            ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20'
            : 'border-slate-200 focus:border-teal-500 focus:ring-teal-500/20'}`}
      />
      {hint && (
        <p className={`mt-1 text-xs ${over ? 'text-red-500' : 'text-slate-400'}`}>
          {over ? `${len - softMax} char${len - softMax === 1 ? '' : 's'} over — remaining text will be cut off on the card` : hint}
        </p>
      )}
    </div>
  );
}

/* ── Image field — upload or URL ──────────────────────────────── */
function ImageField({ value, onChange }) {
  const [mode, setMode] = useState('url');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const token = getToken();
      const res = await fetch(`${API_BASE}/admin/deals/upload-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Upload failed');
      onChange(json.url);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) { uploadFile(e.target.files?.[0]); }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700">Cover Image *</label>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-semibold">
          {['url', 'upload'].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-1.5 transition-colors ${mode === m ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
              {m === 'url' ? 'Paste URL' : 'Upload file'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Best dimensions: 800 × 500 px</span>
          {' '}— the card displays roughly 2:1.25 ratio on the app.
          JPEG or WebP preferred for smallest file size.
        </div>
      </div>

      {mode === 'url' ? (
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/deal-image.jpg"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 px-4
            ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/40'}`}>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handleFileChange} />
          {uploading ? (
            <p className="text-sm text-slate-500 animate-pulse">Uploading…</p>
          ) : (
            <>
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-teal-600">Click to browse</span> or drag & drop
              </p>
              <p className="text-xs text-slate-400">JPEG, PNG, WebP · max 10 MB</p>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{uploadError}</p>
      )}

      {value && (
        <div className="rounded-xl overflow-hidden border border-slate-200 relative">
          <img src={value} alt="Deal preview"
            className="w-full object-cover"
            style={{ aspectRatio: '800/500', maxHeight: 200 }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="absolute top-2 right-2">
            <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">Preview</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Field ────────────────────────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', placeholder, hint, optional }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}{optional && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ── Toggle ───────────────────────────────────────────────────── */
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}
