import { create } from 'zustand';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AlertButton = {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type AlertStore = {
  visible: boolean;
  config: AlertConfig | null;
  show: (config: AlertConfig) => void;
  hide: () => void;
};

const useAlertStore = create<AlertStore>((set) => ({
  visible: false,
  config: null,
  show: (config) => set({ visible: true, config }),
  hide: () => set({ visible: false, config: null }),
}));

export default useAlertStore;

// Imperative helpers — call these anywhere without needing a component reference

export function showAlert(config: AlertConfig) {
  useAlertStore.getState().show(config);
}

export function showConfirm({
  title,
  message,
  confirmText,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  useAlertStore.getState().show({
    title,
    message,
    buttons: [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      {
        text: confirmText ?? (destructive ? 'Delete' : 'Confirm'),
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ],
  });
}
