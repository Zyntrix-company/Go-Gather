import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, PartyPopper, Smartphone, Download } from 'lucide-react';
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
  const storeLink = preview.installLinks?.android || preview.installLinks?.ios;
  const inviteUrl = `${INVITE_ORIGIN}/invite/${inviteType}/${token ?? ''}`;
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

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
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 shadow-inner mx-auto">
          <PartyPopper className="w-7 h-7 text-teal-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 leading-snug">{headline}</h1>
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
          {storeLink && (
            <a
              href={storeLink}
              target="_blank"
              rel="noreferrer"
              className="w-full px-6 py-3 rounded-xl bg-white border border-teal-200 hover:border-teal-400 text-teal-700 font-semibold transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Get GatherrGo
            </a>
          )}
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
