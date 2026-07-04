import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ShieldCheck, ChevronRight, Check } from 'lucide-react-native';
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
  const [agreed, setAgreed] = useState(false);

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

  const updatedPrivacy = Boolean(status?.privacy.needsAck);
  const updatedTerms = Boolean(status?.terms.needsAck);

  let subtitle = "We've updated our Privacy Policy and Terms & Conditions.";
  if (updatedPrivacy && !updatedTerms) {
    subtitle = "We've updated our Privacy Policy.";
  } else if (updatedTerms && !updatedPrivacy) {
    subtitle = "We've updated our Terms & Conditions.";
  }

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <View style={s.badge}>
              <ShieldCheck size={30} color="#0d9488" strokeWidth={2} />
            </View>

            <Text style={s.title}>Important Update</Text>
            <Text style={s.subtitle}>{subtitle}</Text>

            {updatedPrivacy ? (
              <TouchableOpacity style={s.link} onPress={() => setLegalModal('privacy')} activeOpacity={0.85}>
                <Text style={s.linkText}>Privacy Policy</Text>
                <ChevronRight size={20} color="#0d9488" strokeWidth={2.25} />
              </TouchableOpacity>
            ) : null}
            {updatedTerms ? (
              <TouchableOpacity style={s.link} onPress={() => setLegalModal('terms')} activeOpacity={0.85}>
                <Text style={s.linkText}>Terms &amp; Conditions</Text>
                <ChevronRight size={20} color="#0d9488" strokeWidth={2.25} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={s.agreeRow}
              onPress={() => setAgreed((v) => !v)}
              activeOpacity={0.7}>
              <View style={[s.checkbox, agreed && s.checkboxChecked]}>
                {agreed ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text style={s.agreeText}>
                I agree to the Privacy Policy and Terms &amp; Conditions.
              </Text>
            </TouchableOpacity>

            {error ? <Text style={s.err}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primary, (!agreed || ackLoading) && s.primaryDisabled]}
              onPress={onAcknowledge}
              disabled={!agreed || ackLoading}
              activeOpacity={0.85}>
              {ackLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.primaryText, !agreed && s.primaryTextDisabled]}>Continue</Text>
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
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#d6f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#e9f7f4',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  agreeText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 19 },
  err: { fontSize: 13, color: '#b91c1c', textAlign: 'center', marginBottom: 12 },
  primary: {
    backgroundColor: '#0d9488',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
  },
  primaryDisabled: { backgroundColor: '#e2e8f0' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  primaryTextDisabled: { color: '#94a3b8' },
});
