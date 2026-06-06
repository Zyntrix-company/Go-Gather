import { AppState, Linking, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { getDriveConnectUrl, getDriveStatus } from '../api/trips.api';
import { showConfirm } from '../store/alertStore';

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
        const ok = await Linking.canOpenURL(url);
        if (!ok) {
          Toast.show({ type: 'error', text1: 'Cannot open sign-in on this device' });
          return;
        }
        await Linking.openURL(url);
        Toast.show({
          type: 'info',
          text1: 'Complete sign-in in your browser',
          text2: 'Return here — your photo picker will open automatically.',
        });
      } catch {
        Toast.show({ type: 'error', text1: 'Could not start Drive sign-in', text2: 'Please try again.' });
      }
    },
    onCancel,
  });
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
