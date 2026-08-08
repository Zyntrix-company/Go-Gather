'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiJSON, apiFetch } from '../../../lib/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

export default function UsersPage() {
  const [data,    setData]    = useState(null);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState(null);
  const [actionError, setActionError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'grant'|'revoke'|'delete', user }
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (query) params.set('search', query);
    apiJSON(`/admin/users?${params}`).then(setData).finally(() => setLoading(false));
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  async function runToggleContentAdmin(u) {
    setBusyId(u.id); setActionError('');
    try {
      await apiJSON(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_content_admin: !u.is_content_admin }),
      });
      load();
    } catch (err) {
      setActionError(err.message || 'Failed to update role');
    } finally {
      setBusyId(null);
    }
  }

  async function runDelete(u) {
    setBusyId(u.id); setActionError('');
    try {
      const res = await apiFetch(`/admin/users/${u.id}`, { method: 'DELETE' });
      if (res && !res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Delete failed');
      }
      load();
    } catch (err) {
      setActionError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  function requestAction(type, u) {
    setMenuOpenId(null);
    setConfirmAction({ type, user: u });
  }

  function handleConfirm() {
    const { type, user: u } = confirmAction;
    setConfirmAction(null);
    if (type === 'delete') runDelete(u);
    else runToggleContentAdmin(u);
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-nunito,sans-serif)' }}>
            Users
          </h1>
          {data && <p className="text-sm text-slate-500 mt-0.5">{data.total.toLocaleString()} registered (admins excluded)</p>}
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
          + Create content admin
        </button>
      </div>

      <p className="text-xs text-slate-400 -mt-2">
        <span className="font-semibold text-teal-600">Verified</span> = email/OTP confirmed.{' '}
        <span className="font-semibold text-slate-500">Complete</span> = profile setup (name, photo, etc.) finished.
        A user can be verified without a complete profile, or vice versa.
      </p>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search); }} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
        <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Search
        </button>
        {query && (
          <button type="button" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Clear
          </button>
        )}
      </form>

      {actionError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{actionError}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400 animate-pulse">Loading…</div>
        ) : !data?.users.length ? (
          <div className="p-10 text-center text-sm text-slate-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['User', 'Country', 'Status', 'Activity', 'Joined', 'Last sign-in', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-slate-50 transition-colors ${
                    u.is_content_admin ? 'bg-teal-50/60 hover:bg-teal-50' : `hover:bg-slate-50/60 ${i % 2 ? 'bg-slate-50/30' : ''}`}`}>
                    <td className="px-4 py-3 min-w-50">
                      <p className="font-semibold text-slate-800">
                        {u.full_name || <span className="font-normal text-slate-400">Unnamed</span>}
                        {u.is_content_admin && <Badge color="teal" text="Content admin" className="ml-2" />}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{u.email}</p>
                      <p className="text-slate-300 text-[11px] font-mono mt-0.5" title={u.id}>{u.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {u.country || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.is_verified        && <Badge color="teal"  text="Verified" />}
                        {u.is_profile_complete && <Badge color="slate" text="Complete" />}
                        {!u.is_verified        && <Badge color="amber" text="Unverified" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      <span className="tabular-nums font-semibold text-slate-700">{u.trip_count}</span> trips ·{' '}
                      <span className="tabular-nums font-semibold text-slate-700">{u.event_count}</span> events
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span className="text-slate-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40">
                        <DotsIcon className="w-4 h-4" />
                      </button>
                      {menuOpenId === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                          <div className="absolute right-4 top-11 z-20 w-56 bg-white rounded-xl border border-slate-100 shadow-lg py-1 text-left">
                            <button type="button"
                              onClick={() => requestAction(u.is_content_admin ? 'revoke' : 'grant', u)}
                              className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                              {u.is_content_admin ? 'Revoke content admin' : 'Grant content admin'}
                            </button>
                            <button type="button"
                              onClick={() => requestAction('delete', u)}
                              className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                              Delete user
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <PagBtn label="Prev" disabled={page === 1}          onClick={() => setPage((p) => p - 1)} />
            <PagBtn label="Next" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} />
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          {...getConfirmCopy(confirmAction)}
          busy={busyId === confirmAction.user.id}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      )}

      {showCreate && (
        <CreateContentAdminModal
          onClose={(created) => { setShowCreate(false); if (created) load(); }}
        />
      )}
    </div>
  );
}

/* ── Create content admin ─────────────────────────────────────── */
function CreateContentAdminModal({ onClose }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { id, email, tempPassword }
  const [copied, setCopied] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await apiJSON('/admin/users/content-admin', {
        method: 'POST',
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    const text = `Email: ${result.email}\nTemporary password: ${result.tempPassword}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">
            {result ? 'Content admin created' : 'Create content admin'}
          </h2>
          {!result && (
            <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
          )}
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
              Save this password now — it will not be shown again. Share it with them securely and ask them to change it after signing in.
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 space-y-2 font-mono text-sm">
              <div><span className="text-slate-400">Email:</span> <span className="text-slate-800">{result.email}</span></div>
              <div><span className="text-slate-400">Password:</span> <span className="text-slate-800">{result.tempPassword}</span></div>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={handleCopy}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                {copied ? 'Copied!' : 'Copy credentials'}
              </button>
              <button type="button" onClick={() => onClose(true)}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Full name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                placeholder="e.g. Priya Nair"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-slate-800" />
            </div>
            <p className="text-xs text-slate-400">
              A temporary password is generated automatically and shown once after creation. The account can sign in to
              the admin panel immediately with content-admin access.
            </p>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => onClose(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                {saving ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Confirmation copy ────────────────────────────────────────── */
function getConfirmCopy({ type, user: u }) {
  const name = u.full_name || u.email;
  return {
    grant: {
      title: 'Grant content admin access?',
      body: <>
        <strong>{name}</strong> will be able to sign in to the admin panel and edit Blogs, Promo Video and Amazing Deals,
        plus view Business Insights. They will not see Users, Storage, Feedback, Legal or other business-sensitive sections.
      </>,
      confirmLabel: 'Grant access',
      danger: false,
    },
    revoke: {
      title: 'Revoke content admin access?',
      body: <><strong>{name}</strong> will immediately lose admin panel access.</>,
      confirmLabel: 'Revoke access',
      danger: true,
    },
    delete: {
      title: 'Delete this user?',
      body: <>
        This anonymizes <strong>{name}</strong>&rsquo;s account — email, name and profile details are scrubbed and login is disabled.
        Trips/events they created stay intact for other participants. <strong>This cannot be undone.</strong>
      </>,
      confirmLabel: 'Delete user',
      danger: true,
    },
  }[type];
}

/* ── Helpers ───────────────────────────────────────────────────── */
function Badge({ color, text, className = '' }) {
  const cls = { teal: 'bg-teal-50 text-teal-700 border-teal-100',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-100' }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} ${className}`}>{text}</span>;
}

function PagBtn({ label, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50
        disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
      {label}
    </button>
  );
}

function DotsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}
