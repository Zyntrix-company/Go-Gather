import { AppState, Linking, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { getDriveConnectUrl, getDriveStatus, getEmailConnectUrl, getEmailStatus, type EmailProvider } from '../api/trips.api';
import { showConfirm } from '../store/alertStore';

// OAuth started from inside a flow (trip/event docs, gallery). Its gathergo://email-connected
// return must not open Connected Services — the flow's watcher reopens the picker instead.
const IN_FLOW_CONNECT_TTL_MS = 10 * 60 * 1000;
let inFlowConnectStartedAt = 0;

/** True (once) if the OAuth that just returned was started from inside a flow. */
export function consumeInFlowConnect(): boolean {
  const inFlow = Date.now() - inFlowConnectStartedAt < IN_FLOW_CONNECT_TTL_MS;
  inFlowConnectStartedAt = 0;
  return inFlow;
}

/** A connect started outside any flow (Connected Services) — its return is not in-flow. */
export function clearInFlowConnect(): void {
  inFlowConnectStartedAt = 0;
}

/** Always fetch live status — do not rely on cached component state. */
export async function checkDriveConnected(): Promise<boolean> {
  try {
    const d = await getDriveStatus();
    return Boolean(d?.connected);
  } catch {
    return false;
  }
}

/** Ask user to connect Drive in-place (OAuth), without leaving the photos screen. */
export function promptConnectDrive(onCancel?: () => void): void {
  showConfirm({
    title: 'Connect Google Drive',
    message: 'Sign in to Google Drive to browse and import photos from your account.',
    confirmText: 'Connect Drive',
    onConfirm: async () => {
      try {
        const { url } = await getDriveConnectUrl();
        if (!url) {
          Toast.show({ type: 'error', text1: 'Could not start Drive sign-in', text2: 'Please try again.' });
          return;
        }
        // Note: Linking.canOpenURL returns false for https on Android 11+ (package
        // visibility), so we open directly and let openURL throw if it truly can't.
        inFlowConnectStartedAt = Date.now();
        await Linking.openURL(url);
        Toast.show({
          type: 'info',
          text1: 'Complete sign-in in your browser',
          text2: 'Return here — your photo picker will open automatically.',
        });
      } catch {
        clearInFlowConnect(); // the browser never opened, so no return is coming
        Toast.show({ type: 'error', text1: 'Could not start Drive sign-in', text2: 'Please try again.' });
      }
    },
    onCancel,
  });
}

/**
 * Ask user to connect Gmail/Outlook in-place (OAuth), without leaving the current screen.
 * Returns a cancel function that stops the connect watcher (if it has started) so
 * onConnected never fires — call it when the calling screen/form goes away.
 */
export function promptConnectEmail(
  provider: EmailProvider,
  onConnected: () => void,
  onCancel?: () => void,
): () => void {
  const label = provider === 'gmail' ? 'Gmail' : 'Outlook';
  let cancelled = false;
  let stopWatching: (() => void) | null = null;
  showConfirm({
    title: `Connect ${label}`,
    message: `Sign in to ${label} to browse and import attachments.`,
    confirmText: `Connect ${label}`,
    onConfirm: async () => {
      try {
        const { url } = await getEmailConnectUrl(provider);
        if (!url) {
          Toast.show({ type: 'error', text1: `Could not start ${label} sign-in`, text2: 'Please try again.' });
          return;
        }
        // Note: Linking.canOpenURL returns false for https on Android 11+ (package
        // visibility), so we open directly and let openURL throw if it truly can't.
        inFlowConnectStartedAt = Date.now();
        await Linking.openURL(url);
        Toast.show({
          type: 'info',
          text1: 'Complete sign-in in your browser',
          text2: 'Return here — your email picker will open automatically.',
        });
        if (!cancelled) stopWatching = watchEmailConnect(provider, onConnected);
      } catch {
        clearInFlowConnect(); // the browser never opened, so no return is coming
        Toast.show({ type: 'error', text1: `Could not start ${label} sign-in`, text2: 'Please try again.' });
      }
    },
    onCancel,
  });
  return () => {
    cancelled = true;
    stopWatching?.();
    stopWatching = null;
  };
}

/** Re-check email connection after OAuth or when app returns to foreground. */
export function watchEmailConnect(provider: EmailProvider, onConnected: () => void): () => void {
  let cancelled = false;

  const check = async () => {
    if (cancelled) return;
    try {
      const status = await getEmailStatus();
      if (status?.[provider]?.connected) {
        cancelled = true;
        onConnected();
      }
    } catch {}
  };

  const onUrl = ({ url }: { url: string }) => {
    if (url.startsWith('gathergo://email-connected')) {
      setTimeout(check, 400);
    }
  };

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') check();
  };

  const urlSub = Linking.addEventListener('url', onUrl);
  const appSub = AppState.addEventListener('change', onAppState);

  return () => {
    cancelled = true;
    urlSub.remove();
    appSub.remove();
  };
}

/** Re-check Drive after OAuth or when app returns to foreground. */
export function watchDriveConnect(onConnected: () => void): () => void {
  let cancelled = false;

  const check = async () => {
    if (cancelled) return;
    if (await checkDriveConnected()) onConnected();
  };

  const onUrl = ({ url }: { url: string }) => {
    if (url.startsWith('gathergo://email-connected')) {
      setTimeout(check, 400);
    }
  };

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') check();
  };

  const urlSub = Linking.addEventListener('url', onUrl);
  const appSub = AppState.addEventListener('change', onAppState);

  return () => {
    cancelled = true;
    urlSub.remove();
    appSub.remove();
  };
}
