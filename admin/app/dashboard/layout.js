'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getToken, logoutAndClearSession, getAdminRole, setAdminRole, apiJSON } from '../../lib/api';
import ConfirmDialog from '../../components/ConfirmDialog';

const NAV = [
  { href: '/dashboard/overview',     label: 'Business Insights',  icon: ChartIcon,    roles: ['full', 'content'] },
  { href: '/dashboard/health',       label: 'Health',             icon: ActivityIcon, roles: ['full'] },
  { href: '/dashboard/users',        label: 'Users',              icon: UsersIcon,    roles: ['full'] },
  { href: '/dashboard/trips-events', label: 'Trips & Events',     icon: MapIcon,      roles: ['full'] },
  { href: '/dashboard/storage',      label: 'Storage & Capacity', icon: DatabaseIcon, roles: ['full'] },
  { href: '/dashboard/contact',      label: 'Feedback',           icon: MailIcon,     roles: ['full'] },
  { href: '/dashboard/ai-usage',     label: 'AI Usage',           icon: SweeIcon,     roles: ['full'] },
  { href: '/dashboard/blogs',        label: 'Blogs',              icon: BookIcon,     roles: ['full', 'content'] },
  { href: '/dashboard/deals',        label: 'Amazing Deals',      icon: TagIcon,      roles: ['full', 'content'] },
  { href: '/dashboard/promo-video',  label: 'Promo Video',        icon: VideoIcon,    roles: ['full', 'content'] },
  { href: '/dashboard/legal',        label: 'Legal',              icon: FileTextIcon, roles: ['full'] },
  { href: '/dashboard/security',     label: 'Security',           icon: ShieldIcon,   roles: ['full', 'content'] },
];

export default function DashboardLayout({ children }) {
  const router  = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(() => getAdminRole());
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    if (role) return;
    // Refresh with no cached role (e.g. hard reload) — fetch it once.
    apiJSON('/admin/me').then((me) => {
      if (me?.role) { setAdminRole(me.role); setRole(me.role); }
    });
  }, [router, role]);

  const allowedNav = NAV.filter((n) => !role || n.roles.includes(role));

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAndClearSession();
    router.replace('/login');
  }

  useEffect(() => {
    if (!role) return;
    const current = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'));
    if (current && !current.roles.includes(role)) router.replace('/dashboard/overview');
  }, [role, pathname, router]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-slate-100 flex flex-col
        transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>

        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <span className="text-lg font-extrabold text-teal-600 tracking-tight"
            style={{ fontFamily: 'var(--font-nunito, sans-serif)' }}>GatherrGo</span>
          <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin</span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {allowedNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all
                  ${active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-slate-100 shrink-0">
          <button onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-semibold
              text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOutIcon className="w-4 h-4 shrink-0" /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}

      {confirmLogout && (
        <ConfirmDialog
          title="Sign out?"
          body="You'll need to sign in again to access the admin panel."
          confirmLabel="Sign out"
          danger
          busy={loggingOut}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="shrink-0 h-12 bg-white border-b border-slate-100 flex items-center px-4 gap-3">
          <button className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-50" onClick={() => setOpen(true)}>
            <MenuIcon className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-500">
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'Dashboard'}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function ChartIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>;
}
function ActivityIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <polyline strokeLinecap="round" strokeLinejoin="round" points="8 12 10.5 12 11.5 9 13 15 14.5 12 16 12" />
  </svg>;
}
function UsersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>;
}
function MapIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
  </svg>;
}
function DatabaseIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>;
}
function MailIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>;
}
function FileTextIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>;
}

function BookIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>;
}
function TagIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M3 3h8l9.5 9.5a2 2 0 010 2.83l-5.17 5.17a2 2 0 01-2.83 0L3 11V3z" />
  </svg>;
}
function VideoIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M15 10l4.553-2.07A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
  </svg>;
}
function SweeIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063A2 2 0 0014.063 15.5l-1.582 6.135a.5.5 0 01-.963 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
  </svg>;
}
function ShieldIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>;
}
function LogOutIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>;
}
function MenuIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>;
}
