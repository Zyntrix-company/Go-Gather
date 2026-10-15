import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AppScreenLayout from '../../components/common/AppScreenLayout';
import Avatar from '../../components/common/Avatar';
import colors from '../../theme/colors';
import { validateInvite, claimInvite, type InvitePreview, type InviteType } from '../../api/invites.api';
import { handleApiError, parseError } from '../../api/trips.api';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import usePendingInviteStore from '../../store/pendingInviteStore';
import Toast from 'react-native-toast-message';
import { APP_BRAND_NAME } from '../../constants/brand';

type Props = {
  navigation: any;
  route: { params: { type: InviteType; token: string } };
};

const REASON_COPY: Record<NonNullable<InvitePreview['reason']>, string> = {
  NOT_FOUND: "This invite link doesn't exist, or has already been used.",
  ALREADY_CLAIMED: 'This invite has already been accepted.',
  EXPIRED: 'This invite link has expired. Ask them to send you a new one.',
};

function headline(preview: InvitePreview): string {
  const name = preview.invitedBy?.name || 'Someone';
  const type = preview.type;
  if (type === 'trip') {
    const tripName = preview.context?.tripName;
    return `${name} invited you to join${tripName ? ` "${tripName}"` : ' a trip'}`;
  }
  if (type === 'event') {
    const eventName = preview.context?.eventName;
    return `${name} invited you to${eventName ? ` "${eventName}"` : ' an event'}`;
  }
  return `${name} wants to be your friend on ${APP_BRAND_NAME}`;
}

export default function AcceptInviteScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { logout } = useAuth();
  const myName = useAuthStore(s => s.user?.fullName || s.user?.profile?.fullName || null);

  useEffect(() => {
    let cancelled = false;
    validateInvite(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Sign out but keep the invite, so it resumes under whichever account signs in next.
  const handleSwitchAccount = async () => {
    const invite = { type: route.params.type, token };
    await logout();
    usePendingInviteStore.getState().setPendingInvite(invite);
  };

  const handleAccept = async () => {
    setAccepting(true);
    setClaimError(null);
    try {
      const result = await claimInvite(token);
      if (result.type === 'friend' && result.status === 'accepted') {
        Toast.show({ type: 'success', text1: "You're already friends" });
        navigation.goBack();
      } else if (result.type === 'trip') {
        navigation.replace('TripDetail', { trip: { id: result.tripId } });
      } else if (result.type === 'event') {
        navigation.replace('EventDetail', { event: { id: result.eventId } });
      } else {
        Toast.show({ type: 'success', text1: 'Friend request sent' });
        navigation.replace('Notifications', { initialTab: 'requests' });
      }
    } catch (err) {
      const code = parseError(err).error;
      if (code === 'SELF_CLAIM') {
        setClaimError('This is your own invite link. Send it to a friend instead.');
      } else if (code === 'INVALID_INVITE') {
        setClaimError('This invite has expired or has already been used. Ask them to send you a new one.');
      } else if (code === 'FORBIDDEN') {
        setClaimError(`This invite was sent to a different account${myName ? `, and you're signed in as ${myName}` : ''}.`);
      } else {
        handleApiError(err);
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <AppScreenLayout navigation={navigation} title="Invite" onBack={() => navigation.goBack()}>
      <View style={styles.container}>
        {loading && <ActivityIndicator size="large" color={colors.accent} />}

        {!loading && (loadError || !preview) && (
          <>
            <Text style={styles.message}>We couldn't load this invite. Please try the link again.</Text>
          </>
        )}

        {!loading && preview && !preview.valid && (
          <Text style={styles.message}>
            {preview.reason ? REASON_COPY[preview.reason] : 'This invite is no longer valid.'}
          </Text>
        )}

        {!loading && preview && preview.valid && (
          <>
            <Avatar uri={preview.invitedBy?.avatarUrl} size={88} />
            <Text style={styles.headline}>{headline(preview)}</Text>
            {claimError && <Text style={styles.claimError}>{claimError}</Text>}

            <TouchableOpacity
              style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={accepting}
              activeOpacity={0.85}>
              {accepting ? (
                <ActivityIndicator size="small" color={colors.accentForeground} />
              ) : (
                <Text style={styles.acceptBtnText}>
                  {preview.type === 'friend' ? 'Accept & Add Friend' : 'Accept Invite'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.declineText}>Not now</Text>
            </TouchableOpacity>

            {myName && (
              <TouchableOpacity onPress={handleSwitchAccount} activeOpacity={0.7}>
                <Text style={styles.accountText}>
                  Signed in as {myName}. <Text style={styles.accountLink}>Not you? Switch account</Text>
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
    gap: 16,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  acceptBtn: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
  },
  acceptBtnDisabled: {
    opacity: 0.7,
  },
  acceptBtnText: {
    color: colors.accentForeground,
    fontSize: 16,
    fontWeight: '700',
  },
  claimError: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 20,
  },
  accountText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  accountLink: {
    color: colors.accent,
    fontWeight: '600',
  },
  declineText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
