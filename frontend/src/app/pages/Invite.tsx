import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, PartyPopper, Smartphone, Download, Calendar, MapPin, Users } from 'lucide-react';
import SEO from '../components/SEO';
import { fetchInvitePreview, type InvitePreview, type InviteType } from '../lib/inviteApi';

// Must match backend APP_DEEP_LINK_BASE_URL — the host the Universal Link is registered for.
const INVITE_ORIGIN = 'https://gatherrgo.com';
// Numeric App Store ID (from App Store Connect). The Smart App Banner is skipped without it.
const APP_STORE_ID = import.meta.env.VITE_APP_STORE_ID as string | undefined;

const TYPE_COPY: Record<InviteType, (name: string, context: string | null) => string> = {
  trip: (name, tripName) => `${name} invited you to join${tripName ? ` "${tripName}"` : ' a trip'} on GatherrGo`,
  event: (name, eventName) => `${name} invited you to${eventName ? ` "${eventName}"` : ' an event'} on GatherrGo`,
  friend: (name) => `${name} wants to be your friend on GatherrGo`,
};

const REASON_COPY: Record<NonNullable<InvitePreview['reason']>, string> = {
  NOT_FOUND: "This invite link doesn't exist, or has already been used.",
  ALREADY_CLAIMED: 'This invite has already been accepted.',
  EXPIRED: 'This invite link has expired. Ask them to send you a new one.',
};

// Dates arrive as ISO strings (a bare date or a midnight timestamp). Read the calendar day
// as written rather than through a Date, so the viewer's timezone can't shift it.
function parseDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
  const from = parseDay(start);
  if (!from) return null;
  const to = parseDay(end) ?? from;
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  if (to.getTime() === from.getTime()) return fmt(from, true);
  return from.getFullYear() === to.getFullYear()
    ? `${fmt(from, false)} – ${fmt(to, true)}`
    : `${fmt(from, true)} – ${fmt(to, true)}`;
}

// The inviter's photo, falling back to the party icon if it is missing or fails to load.
function InviterBadge({ avatarUrl, name }: { avatarUrl?: string | null; name: string }) {
  const [failed, setFailed] = React.useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setFailed(true)}
        className="w-20 h-20 rounded-full object-cover border-2 border-teal-100 shadow-md mx-auto"
      />
    );
  }
  return (
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 shadow-inner mx-auto">
      <PartyPopper className="w-7 h-7 text-teal-600" />
    </div>
  );
}

export default function Invite() {
  const { type, token } = useParams<{ type: string; token: string }>();
  const [preview, setPreview] = React.useState<InvitePreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) {
      setError('Missing invite token');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchInvitePreview(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setError('load_failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const inviteType: InviteType = (preview?.type || (type as InviteType) || 'trip');
  const appLink = token ? `gathergo://invite/${inviteType}/${token}` : undefined;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white text-[#666] text-sm">
        Loading invite…
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[#1a1a1a]">We couldn't load this invite. Please try the link again.</p>
        <Link to="/" className="text-sm font-semibold text-teal-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to GatherrGo
        </Link>
      </div>
    );
  }

  if (!preview.valid) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[#1a1a1a] max-w-sm">
          {preview.reason ? REASON_COPY[preview.reason] : 'This invite is no longer valid.'}
        </p>
        <Link to="/" className="text-sm font-semibold text-teal-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to GatherrGo
        </Link>
      </div>
    );
  }

  const inviterName = preview.invitedBy?.name || 'Someone';
  const contextName = inviteType === 'trip' ? preview.context?.tripName ?? null : preview.context?.eventName ?? null;
  const headline = TYPE_COPY[inviteType](inviterName, contextName);
  // Trips and events show what they are; a friend link has nothing more to say.
  const details: { icon: React.ElementType; text: string }[] = [];
  if (inviteType !== 'friend') {
    const when = formatDateRange(preview.context?.startDate, preview.context?.endDate);
    if (when) details.push({ icon: Calendar, text: when });
    if (preview.context?.locationName) details.push({ icon: MapPin, text: preview.context.locationName });
    const count = preview.context?.memberCount;
    if (typeof count === 'number' && count > 0) {
      details.push({ icon: Users, text: `${count} ${count === 1 ? 'member' : 'members'}` });
    }
  }
  const inviteUrl = `${INVITE_ORIGIN}/invite/${inviteType}/${token ?? ''}`;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  // Phones get their own store only; desktop gets both, labelled.
  const storeLinks: { href: string; label: string }[] = [];
  const { android, ios } = preview.installLinks ?? {};
  if (isIos) {
    if (ios) storeLinks.push({ href: ios, label: 'Get GatherrGo' });
  } else if (isAndroid) {
    if (android) storeLinks.push({ href: android, label: 'Get GatherrGo' });
  } else {
    if (android) storeLinks.push({ href: android, label: 'Get GatherrGo for Android' });
    if (ios) storeLinks.push({ href: ios, label: 'Get GatherrGo for iPhone' });
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-white">
      <SEO
        title="You're invited to GatherrGo"
        description={headline}
        canonical={`/invite/${inviteType}/${token ?? ''}`}
        noIndex
      />
      {/* iOS has no deferred deep link, so the banner is the hand-off to the App Store.
          app-argument is the invite URL: "Open" on an installed app resolves it as a
          Universal Link. Requires the App Store ID; omitted until it is configured. */}
      {APP_STORE_ID && (
        <Helmet>
          <meta name="apple-itunes-app" content={`app-id=${APP_STORE_ID}, app-argument=${inviteUrl}`} />
        </Helmet>
      )}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white/60 border border-white/60 shadow-lg shadow-teal-900/5 p-8 md:p-10 text-center space-y-6"
      >
        <InviterBadge avatarUrl={preview.invitedBy?.avatarUrl} name={inviterName} />
        <h1 className="text-2xl font-bold text-slate-900 leading-snug">{headline}</h1>
        {details.length > 0 && (
          <ul className="flex flex-col items-center gap-2 text-sm text-slate-600">
            {details.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon className="w-4 h-4 text-teal-600" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-500">
          Open this link on your phone with GatherrGo installed to accept — or get the app below.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          {appLink && (
            <a
              href={appLink}
              className="w-full px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all shadow-[0_4px_14px_0_rgba(13,148,136,0.3)] flex items-center justify-center gap-2 text-sm"
            >
              <Smartphone className="w-4 h-4" />
              Open in the GatherrGo app
            </a>
          )}
          {storeLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="w-full px-6 py-3 rounded-xl bg-white border border-teal-200 hover:border-teal-400 text-teal-700 font-semibold transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              {label}
            </a>
          ))}
        </div>
        {isIos && (
          <p className="text-xs text-slate-500 pt-1">
            New to GatherrGo? After you install it, come back to the message with this invite and tap the link
            again — it will open the app and take you straight to your invite.
          </p>
        )}
      </motion.div>
    </div>
  );
}
