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
import { UnifiedCard } from './Cards';
import {
  getRequestPreview,
  respondToRequest,
  type RequestPreview,
} from '../../api/requests.api';
import { inviteDateLabel, inviteDaysToGo, inviteHeadline } from '../../utils/inviteDisplay';

// Same look as ThemedAlert (overlay, radius, border, shadow), but quicker: this is the first
// thing an invitee sees, so it should pop in and out without making them wait.
const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.48)';
const ENTER_DURATION = 170;
const EXIT_DURATION = 120;
const ENTER_RISE = 18;

// Same stock image the home screen falls back to when a trip/event has no banner.
const FALLBACK_BANNER = require('../../assets/images/goa_beach.png');

export type InviteRequestRef = { type: 'trip' | 'event'; id: string };

type Props = {
  /** The pending trip/event request to show; null keeps the popup closed. */
  request: InviteRequestRef | null;
  /** Dismissed without answering (tap outside, Android back) — the request stays in Requests. */
  onClose: () => void;
  /** Accepted: the user is now a member. `parentId` is the trip/event id. */
  onAccepted: (r: { type: 'trip' | 'event'; requestId: string; parentId: string; name: string }) => void;
  /** Declined: the request is gone. */
  onDeclined: (r: { type: 'trip' | 'event'; requestId: string }) => void;
};

export default function InviteRequestPopup({ request, onClose, onAccepted, onDeclined }: Props) {
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  // Starts true so the first frame after opening is the skeleton, not an empty card.
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const riseAnim = useRef(new Animated.Value(ENTER_RISE)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.55)).current;
  const dismissingRef = useRef(false);

  const dismissAnimated = useCallback(
    (after: () => void) => {
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: EXIT_DURATION,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(riseAnim, {
          toValue: 10,
          duration: EXIT_DURATION,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: EXIT_DURATION + 20,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        dismissingRef.current = false;
        after();
      });
    },
    [scaleAnim, riseAnim, opacityAnim, overlayAnim],
  );

  // Open: pop in and load the details.
  const requestKey = request ? `${request.type}:${request.id}` : null;
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setPreview(null);
    setLoadFailed(false);
    setLoading(true);
    setBusy(null);
    contentAnim.setValue(0);

    scaleAnim.setValue(0.92);
    riseAnim.setValue(ENTER_RISE);
    opacityAnim.setValue(0);
    overlayAnim.setValue(0);
    Animated.parallel([
      // A touch of overshoot gives the pop; the spring settles fast.
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 340, friction: 22 }),
      Animated.spring(riseAnim, { toValue: 0, useNativeDriver: true, tension: 340, friction: 24 }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: ENTER_DURATION,
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
  }, [requestKey]);

  // Skeleton shimmer, only while there is something to wait for.
  useEffect(() => {
    if (!request || !loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [request, loading, pulseAnim]);

  // Loaded: the card fades in over the skeleton's footprint.
  useEffect(() => {
    if (!preview && !loadFailed) return;
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [preview, loadFailed, contentAnim]);

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

  // The home cards only draw avatars that have a photo; everyone else folds into "+N".
  const avatarMembers = (preview?.members ?? [])
    .filter((m) => !!m.avatarUrl)
    .map((m) => ({ id: m.id, uri: m.avatarUrl as string }));
  const headline = preview ? inviteHeadline(preview.inviter.name, preview.type) : '';

  return (
    <AppModal visible={!!request} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close invite" />
        <Animated.View
          style={[
            styles.dialog,
            { opacity: opacityAnim, transform: [{ translateY: riseAnim }, { scale: scaleAnim }] },
          ]}>
          {loading && (
            <Animated.View style={{ opacity: pulseAnim }} accessibilityLabel="Loading invite">
              <View style={styles.body}>
                <View style={styles.skelHeadline} />
                <View style={styles.skelCard}>
                  <View style={styles.skelImg} />
                  <View style={styles.skelLines}>
                    <View style={[styles.skelLine, { width: '70%' }]} />
                    <View style={[styles.skelLine, { width: '50%' }]} />
                    <View style={[styles.skelLine, { width: '60%' }]} />
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <View style={[styles.btn, styles.btnSecondary]} />
                <View style={[styles.btn, styles.btnSecondary]} />
              </View>
            </Animated.View>
          )}

          {!loading && loadFailed && (
            <Animated.View style={{ opacity: contentAnim }}>
              <View style={[styles.body, styles.errorBody]}>
                <Text style={styles.errorTitle}>This invite isn't available</Text>
                <Text style={styles.errorText}>It may have expired or already been answered.</Text>
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
            </Animated.View>
          )}

          {!loading && preview && (
            <Animated.View style={{ opacity: contentAnim }}>
              <View style={styles.body}>
                <View style={styles.headlineRow} accessible accessibilityLabel={headline}>
                  <Avatar uri={preview.inviter.avatarUrl} size={28} />
                  <Text style={styles.headline} numberOfLines={2}>
                    {headline}
                  </Text>
                </View>

                <UnifiedCard
                  readOnly
                  imageUri={preview.bannerImageUrl}
                  imageFallback={FALLBACK_BANNER}
                  name={preview.name}
                  location={preview.locationName || 'Location TBD'}
                  dateLabel={inviteDateLabel(preview.type, preview.startDate, preview.endDate)}
                  members={avatarMembers}
                  extraMembers={Math.max(0, preview.memberCount - avatarMembers.length)}
                  daysToGo={inviteDaysToGo(preview.startDate)}
                  mb={0}
                />
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
            </Animated.View>
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
    paddingHorizontal: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
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
  body: {
    paddingTop: 20,
    paddingHorizontal: 14,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  headline: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 48,
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
  errorBody: {
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  // Skeleton — same footprint as the loaded card (UnifiedCard: minHeight 84, 60px image),
  // so the dialog doesn't change size when the details arrive.
  skelHeadline: {
    alignSelf: 'center',
    width: '62%',
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceSecondary,
    marginTop: 7,
    marginBottom: 21,
  },
  skelCard: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  skelImg: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  skelLines: {
    flex: 1,
    gap: 8,
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceSecondary,
  },
});
