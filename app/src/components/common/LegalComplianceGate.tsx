import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fetchLegalStatus, postLegalAck } from '../../api/legal.api';
import LegalModal from './LegalModal';

/**
 * After login, prompts the user if published privacy/terms versions are ahead of acknowledgements.
 */
export default function LegalComplianceGate() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchLegalStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const s = await fetchLegalStatus();
      setStatus(s);
    } catch {
      setError('Could not check policy updates.');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const needsAck = Boolean(status?.privacy.needsAck || status?.terms.needsAck);

  const onAcknowledge = async () => {
    if (!status) return;
    setAckLoading(true);
    setError(null);
    try {
      const body: { privacyVersion?: string; termsVersion?: string } = {};
      if (status.privacy.needsAck && status.privacy.currentVersion) {
        body.privacyVersion = status.privacy.currentVersion;
      }
      if (status.terms.needsAck && status.terms.currentVersion) {
        body.termsVersion = status.terms.currentVersion;
      }
      const next = await postLegalAck(body);
      setStatus(next);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not save acknowledgement.');
    } finally {
      setAckLoading(false);
    }
  };

  if (loading || !needsAck) return null;

  const lines: string[] = [];
  if (status?.privacy.needsAck) {
    lines.push(`Privacy Policy is now version ${status.privacy.currentVersion}.`);
  }
  if (status?.terms.needsAck) {
    lines.push(`Terms & Conditions are now version ${status.terms.currentVersion}.`);
  }

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text style={s.title}>Updated policies</Text>
            <Text style={s.body}>{lines.join('\n\n')}</Text>
            <Text style={s.hint}>Please review the documents, then tap OK to confirm you have read them.</Text>
            {error ? <Text style={s.err}>{error}</Text> : null}
            <View style={s.row}>
              {status?.privacy.needsAck ? (
                <TouchableOpacity style={s.secondary} onPress={() => setLegalModal('privacy')} activeOpacity={0.85}>
                  <Text style={s.secondaryText}>Privacy</Text>
                </TouchableOpacity>
              ) : null}
              {status?.terms.needsAck ? (
                <TouchableOpacity style={s.secondary} onPress={() => setLegalModal('terms')} activeOpacity={0.85}>
                  <Text style={s.secondaryText}>Terms</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[s.primary, ackLoading && s.primaryDisabled]}
              onPress={onAcknowledge}
              disabled={ackLoading}
              activeOpacity={0.85}>
              {ackLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryText}>OK, I have read them</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <LegalModal visible={legalModal === 'privacy'} type="privacy" onClose={() => setLegalModal(null)} />
      <LegalModal visible={legalModal === 'terms'} type="terms" onClose={() => setLegalModal(null)} />
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  body: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 10 },
  hint: { fontSize: 13, color: '#64748b', lineHeight: 19, marginBottom: 16 },
  err: { fontSize: 13, color: '#b91c1c', marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  secondaryText: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  primary: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
