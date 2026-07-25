'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiJSON, apiFetch, getToken } from '../../../lib/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

const EMPTY = {
  slug: '', image: '', title: '', excerpt: '', content: '',
  category: '', author: 'Vihaan Khanna', publishedAt: '',
  published: true, showOnWeb: true, showOnApp: true,
  sortOrderWeb: '', sortOrderApp: '',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function BlogsPage() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    apiJSON('/admin/blogs').then((data) => { if (data) setBlogs(data); }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(EMPTY); setEditing('new'); setError(''); }

  function openEdit(blog) {
    setForm({
      slug: blog.slug, image: blog.image, title: blog.title,
      excerpt: blog.excerpt, content: blog.content, category: blog.category,
      author: blog.author, publishedAt: blog.publishedAt?.slice(0, 10) ?? '',
      published: blog.published, showOnWeb: blog.showOnWeb, showOnApp: blog.showOnApp,
      sortOrderWeb: blog.sortOrderWeb ?? '', sortOrderApp: blog.sortOrderApp ?? '',
    });
    setEditing(blog); setError('');
  }

  function closeEditor() { setEditing(null); setError(''); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    const payload = {
      ...form,
      sortOrderWeb: form.sortOrderWeb !== '' ? Number(form.sortOrderWeb) : null,
      sortOrderApp: form.sortOrderApp !== '' ? Number(form.sortOrderApp) : null,
    };
    try {
      if (editing === 'new') {
        await apiJSON('/admin/blogs', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiJSON(`/admin/blogs/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      load(); closeEditor();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function runDelete(blog) {
    setDeleting(true);
    try {
      await apiFetch(`/admin/blogs/${blog.id}`, { method: 'DELETE' });
      load();
    } finally {
      setDeleting(false); setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>Blogs</h1>
          <p className="text-sm text-slate-500 mt-0.5">{blogs.length} posts</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
          + New post
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
        ) : !blogs.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">No blog posts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Title', 'Category', 'Published', 'Surfaces', 'Order W/A'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {blogs.map((b, i) => (
                  <tr key={b.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{b.title}</td>
                    <td className="px-4 py-3 text-slate-500">{b.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border
                        ${b.published ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {b.published ? 'Live' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {b.showOnWeb && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-lg border border-blue-100 font-medium">Web</span>}
                        {b.showOnApp && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-lg border border-purple-100 font-medium">App</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{b.sortOrderWeb ?? '—'} / {b.sortOrderApp ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(b)} className="text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors">Edit</button>
                        <button onClick={() => setPendingDelete(b)} className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this blog post?"
          body={<>Deletes <strong>{pendingDelete.title}</strong> permanently, including its image. It will disappear from the app and site immediately. This cannot be undone.</>}
          confirmLabel="Delete post"
          danger
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => runDelete(pendingDelete)}
        />
      )}
    </div>
  );
}

/* ── Editor modal ─────────────────────────────────────────────── */
function EditorModal({ editing, form, setForm, saving, error, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{editing === 'new' ? 'New blog post' : 'Edit blog post'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Slug *" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} placeholder="my-blog-post" />
            <Field label="Published at *" type="date" value={form.publishedAt} onChange={(v) => setForm((f) => ({ ...f, publishedAt: v }))} />
          </div>
          <Field label="Title *" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Post title" />

          {/* Image field — upload or URL */}
          <ImageField value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />

          <Field label="Excerpt *" value={form.excerpt} onChange={(v) => setForm((f) => ({ ...f, excerpt: v }))} placeholder="Short description shown on cards" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category *" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="TRAVEL TIPS" />
            <Field label="Author" value={form.author} onChange={(v) => setForm((f) => ({ ...f, author: v }))} />
          </div>
          <RichTextEditor
            value={form.content}
            onChange={(html) => setForm((f) => ({ ...f, content: html }))}
            editingKey={editing === 'new' ? 'new' : editing?.id}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sort order (web)" type="number" value={form.sortOrderWeb} onChange={(v) => setForm((f) => ({ ...f, sortOrderWeb: v }))} placeholder="1" />
            <Field label="Sort order (app)" type="number" value={form.sortOrderApp} onChange={(v) => setForm((f) => ({ ...f, sortOrderApp: v }))} placeholder="1" />
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle label="Published" checked={form.published} onChange={(v) => setForm((f) => ({ ...f, published: v }))} />
            <Toggle label="Show on Web" checked={form.showOnWeb} onChange={(v) => setForm((f) => ({ ...f, showOnWeb: v }))} />
            <Toggle label="Show on App" checked={form.showOnApp} onChange={(v) => setForm((f) => ({ ...f, showOnApp: v }))} />
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

/* ── Image field — upload or URL ──────────────────────────────── */
function ImageField({ value, onChange }) {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
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
      const res = await fetch(`${API_BASE}/admin/blogs/upload-image`, {
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

      {/* Recommended dimensions hint */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
        <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Best dimensions: 1200 × 630 px (16:9)</span>
          {' '}— renders crisply on both website cards and the mobile app feed.
          Minimum: <span className="font-semibold">800 × 420 px</span>.
          JPEG or WebP preferred for smallest file size.
        </div>
      </div>

      {mode === 'url' ? (
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/cover-photo.jpg"
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

      {/* Preview */}
      {value && (
        <div className="rounded-xl overflow-hidden border border-slate-200 relative">
          <img src={value} alt="Cover preview"
            className="w-full object-cover"
            style={{ aspectRatio: '1200/630', maxHeight: 220 }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="absolute top-2 right-2">
            <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">Preview</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Rich Text Editor ─────────────────────────────────────────── */
const TOOLBAR_BUTTONS = [
  { cmd: 'bold',             icon: <><strong>B</strong></>,                        title: 'Bold (Ctrl+B)' },
  { cmd: 'italic',           icon: <em>I</em>,                                     title: 'Italic (Ctrl+I)' },
  { cmd: 'underline',        icon: <span style={{ textDecoration: 'underline' }}>U</span>, title: 'Underline (Ctrl+U)' },
  { cmd: 'h2',               icon: 'H2',                                           title: 'Heading 2',  block: true },
  { cmd: 'h3',               icon: 'H3',                                           title: 'Heading 3',  block: true },
  { cmd: 'p',                icon: 'P¶',                                           title: 'Paragraph',  block: true },
  { cmd: 'insertUnorderedList', icon: '• List',                                    title: 'Bullet list' },
  { cmd: 'insertOrderedList',   icon: '1. List',                                   title: 'Numbered list' },
  { cmd: 'blockquote',       icon: '" Quote',                                      title: 'Blockquote', block: true },
  { cmd: 'removeFormat',     icon: 'Clear',                                        title: 'Remove formatting' },
];

function RichTextEditor({ value, onChange, editingKey }) {
  const ref = useRef(null);
  const skipSyncRef = useRef(false);

  // When the editing key changes (opening a new post or switching posts),
  // re-seed the editor with the stored HTML.
  useEffect(() => {
    if (ref.current && !skipSyncRef.current) {
      ref.current.innerHTML = value || '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingKey]);

  const exec = useCallback((cmd, block) => {
    ref.current?.focus();
    if (block) {
      document.execCommand('formatBlock', false, cmd);
    } else {
      document.execCommand(cmd, false, null);
    }
    // Sync immediately after command
    skipSyncRef.current = true;
    onChange(ref.current?.innerHTML || '');
    setTimeout(() => { skipSyncRef.current = false; }, 0);
  }, [onChange]);

  function handleInput() {
    onChange(ref.current?.innerHTML || '');
  }

  return (
    <div className="rounded-xl border border-slate-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
        {TOOLBAR_BUTTONS.map(({ cmd, icon, title, block }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd, block); }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white hover:text-teal-700 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all select-none"
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[240px] px-4 py-3 text-sm text-slate-800 outline-none overflow-y-auto rich-editor-body"
        style={{ lineHeight: '1.75', maxHeight: 480 }}
        data-placeholder="Write your full post content here…"
      />

      {/* Hint */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex gap-4">
        <span>Ctrl+B bold</span>
        <span>Ctrl+I italic</span>
        <span>Ctrl+U underline</span>
        <span>Select text, then click a toolbar button to format</span>
      </div>
    </div>
  );
}

/* ── Field ────────────────────────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
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
