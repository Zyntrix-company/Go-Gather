import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import AppScreenLayout from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';
import { validateInvite, claimInvite, type InvitePreview, type InviteType } from '../../api/invites.api';
import { handleApiError } from '../../api/trips.api';
import Toast from 'react-native-toast-message';

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
  return `${name} wants to be your friend on GatherGo`;
}

export default function AcceptInviteScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState(false);

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

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const result = await claimInvite(token);
      if (result.type === 'trip') {
        navigation.replace('TripDetail', { trip: { id: result.tripId } });
      } else if (result.type === 'event') {
        navigation.replace('EventDetail', { event: { id: result.eventId } });
      } else {
        Toast.show({ type: 'success', text1: 'Friend request sent' });
        navigation.replace('Notifications', { initialTab: 'requests' });
      }
    } catch (err) {
      handleApiError(err);
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
            {preview.invitedBy?.avatarUrl ? (
              <Image source={{ uri: preview.invitedBy.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <Text style={styles.headline}>{headline(preview)}</Text>

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
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    backgroundColor: colors.secondary,
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
  declineText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
