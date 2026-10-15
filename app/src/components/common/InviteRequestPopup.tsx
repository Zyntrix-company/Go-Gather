import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import colors from '../../theme/colors';
import AppModal from './AppModal';
import Avatar from './Avatar';
import StackedAvatars from './StackedAvatars';
import {
  getRequestPreview,
  respondToRequest,
  type RequestPreview,
} from '../../api/requests.api';
import { inviteMetaLine, memberCountLabel } from '../../utils/inviteDisplay';

// Same look and motion as ThemedAlert, so this reads as one of the app's own dialogs.
const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.48)';
const ENTER_DURATION = 240;
const EXIT_DURATION = 180;

export type InviteRequestRef = { type: 'trip' | 'event'; id: string };

type Props = {
  /** The pending trip/event request to show; null keeps the popup closed. */
  request: InviteRequestRef | null;
  /** Dismissed without answering (tap outside, Android back, Close) — the request stays in Requests. */
  onClose: () => void;
  /** Accepted: the user is now a member. `parentId` is the trip/event id. */
  onAccepted: (r: { type: 'trip' | 'event'; requestId: string; parentId: string; name: string }) => void;
  /** Declined: the request is gone. */
  onDeclined: (r: { type: 'trip' | 'event'; requestId: string }) => void;
};

export default function InviteRequestPopup({ request, onClose, onAccepted, onDeclined }: Props) {
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);

  const dismissAnimated = useCallback(
    (after: () => void) => {
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: EXIT_DURATION,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: EXIT_DURATION - 20,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: EXIT_DURATION + 40,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        dismissingRef.current = false;
        after();
      });
    },
    [scaleAnim, opacityAnim, overlayAnim],
  );

  // Open: animate in and load the details.
  const requestKey = request ? `${request.type}:${request.id}` : null;
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setPreview(null);
    setLoadFailed(false);
    setLoading(true);
    setBusy(null);

    scaleAnim.setValue(0.94);
    opacityAnim.setValue(0);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 24 }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: ENTER_DURATION + 30,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    getRequestPreview(request.type, request.id)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // requestKey stands in for `request` so a re-render with the same request doesn't reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, scaleAnim, opacityAnim, overlayAnim]);

  const close = () => {
    if (busy) return;
    dismissAnimated(onClose);
  };

  const accept = async () => {
    if (!request || busy) return;
    setBusy('accept');
    try {
      const res = await respondToRequest(request.type, request.id, 'approve');
      const parentId = (request.type === 'trip' ? res.tripId : res.eventId) ?? '';
      dismissAnimated(() =>
        onAccepted({ type: request.type, requestId: request.id, parentId, name: res.name ?? preview?.name ?? '' }),
      );
    } catch {
      setBusy(null);
      Toast.show({ type: 'error', text1: "Couldn't join", text2: 'Please try again.' });
    }
  };

  const decline = async () => {
    if (!request || busy) return;
    setBusy('decline');
    try {
      await respondToRequest(request.type, request.id, 'decline');
      dismissAnimated(() => onDeclined({ type: request.type, requestId: request.id }));
    } catch {
      setBusy(null);
      Toast.show({ type: 'error', text1: "Couldn't decline", text2: 'Please try again.' });
    }
  };

  const meta = preview ? inviteMetaLine(preview.startDate, preview.endDate, preview.locationName) : '';

  return (
    <AppModal visible={!!request} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          {loading && (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}

          {!loading && loadFailed && (
            <>
              <View style={styles.content}>
                <Text style={styles.title}>This invite isn't available</Text>
                <Text style={styles.subtitle}>It may have expired or already been answered.</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close">
                  <Text style={styles.btnTextSecondary}>Close</Text>
                </Pressable>
              </View>
            </>
          )}

          {!loading && preview && (
            <>
              <View style={styles.content}>
                <View style={styles.avatarWrap}>
                  <Avatar uri={preview.inviter.avatarUrl} size={56} />
                </View>
                <Text style={styles.subtitle}>{`${preview.inviter.name || 'Someone'} invited you to`}</Text>
                <Text style={[styles.title, styles.titleSpaced]}>{preview.name}</Text>
                {!!meta && <Text style={styles.subtitle}>{meta}</Text>}
                <View style={styles.membersRow}>
                  <StackedAvatars
                    avatars={preview.members.map((m) => ({ id: m.id, avatarUrl: m.avatarUrl ?? undefined }))}
                    totalCount={preview.memberCount}
                    maxVisible={4}
                    size={28}
                    overlap={8}
                    counterStyle="soft"
                    animated={false}
                  />
                  <Text style={styles.memberCount}>{memberCountLabel(preview.memberCount)}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed, !!busy && styles.btnDisabled]}
                  onPress={accept}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel="Accept and join">
                  {busy === 'accept' ? (
                    <ActivityIndicator size="small" color={colors.accentForeground} />
                  ) : (
                    <Text style={styles.btnTextPrimary}>Accept & Join</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed, !!busy && styles.btnDisabled]}
                  onPress={decline}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel="Decline">
                  {busy === 'decline' ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <Text style={styles.btnTextSecondary}>Decline</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  centerBlock: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 4,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  titleSpaced: {
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 4,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  memberCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 22,
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceSecondary,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colors.accentForeground,
  },
  btnTextSecondary: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: colors.textPrimary,
  },
});
