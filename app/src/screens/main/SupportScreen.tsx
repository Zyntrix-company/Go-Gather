import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';
import { showAlert } from '../../store/alertStore';
import { submitFeedback } from '../../api/feedback.api';

function Chevron() {
  return <Text style={styles.chevron}>›</Text>;
}

function Row({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Chevron />
    </TouchableOpacity>
  );
}

// Same pattern as Swee's "Report an issue" modal (ChatDetailScreen) — general app issues instead of a chat message.
const REPORT_OPTIONS = [
  'Bug or crash',
  'App is slow',
  'UI looks wrong',
  'Feature request',
  'Other',
];

export default function SupportScreen({ navigation }: { navigation: any }) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const comingSoon = (title: string) =>
    showAlert({ title, message: 'This feature is coming soon.', buttons: [{ text: 'OK' }] });

  const openReportModal = () => {
    setSelectedOption(null);
    setReportDetails('');
    setReportSent(false);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!selectedOption) return;
    const combined = selectedOption + (reportDetails.trim() ? ` — ${reportDetails.trim()}` : '');
    setIsSubmittingReport(true);
    try {
      await submitFeedback(combined);
      setReportSent(true);
    } catch (_) {
      setReportSent(true);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <AppScreenLayout navigation={navigation} title="Support" onBack={() => navigation.goBack()}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Row
            label="How it works"
            sub="Video, highlights & FAQs"
            onPress={() => navigation.navigate('HowItWorks')}
          />
          <View style={styles.divider} />
          <Row
            label="Help Center"
            sub="Guides & articles"
            onPress={() => comingSoon('Help Center')}
          />
          <View style={styles.divider} />
          <Row
            label="Report a Problem"
            sub="Tell us what went wrong"
            onPress={openReportModal}
          />
        </View>
      </ScrollView>

      {/* ── Report a Problem modal — same design as Swee's "Report an issue" ── */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report a Problem</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} activeOpacity={0.7}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {reportSent ? (
              <View style={styles.reportSent}>
                <View style={styles.reportSentIcon}>
                  <Text style={styles.reportSentEmoji}>✓</Text>
                </View>
                <Text style={styles.reportSentTitle}>Thanks for your feedback</Text>
                <Text style={styles.reportSentText}>Your report helps us improve GatherrGo.</Text>
                <TouchableOpacity style={styles.reportBtn} onPress={() => setShowReportModal(false)} activeOpacity={0.8}>
                  <Text style={styles.reportBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.reportLabel}>What went wrong?</Text>
                <View style={styles.optionGrid}>
                  {REPORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.optionChip, selectedOption === opt && styles.optionChipSelected]}
                      onPress={() => setSelectedOption(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionChipText, selectedOption === opt && styles.optionChipTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.reportLabelOptional}>Additional details <Text style={styles.optionalTag}>(optional)</Text></Text>
                <TextInput
                  style={styles.reportInput}
                  placeholder="Add more context..."
                  placeholderTextColor="#94a3b8"
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  maxLength={500}
                  selectionColor="#0d9488"
                />
                <TouchableOpacity
                  style={[styles.reportBtn, (!selectedOption || isSubmittingReport) && styles.reportBtnDisabled]}
                  onPress={submitReport}
                  disabled={!selectedOption || isSubmittingReport}
                  activeOpacity={0.8}
                >
                  {isSubmittingReport
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.reportBtnText}>Submit</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  card: { borderRadius: 14, paddingVertical: 4, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 },
  chevron: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.12)', marginLeft: 14 },

  // Report modal — mirrors ChatDetailScreen's report-an-issue modal exactly.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  reportModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reportTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  reportInput: {
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0f172a', minHeight: 100, textAlignVertical: 'top',
    marginBottom: 16,
  },
  reportLabel: { fontSize: 13, color: '#475569', marginBottom: 10, fontWeight: '500' },
  reportLabelOptional: { fontSize: 13, color: '#475569', marginBottom: 8, marginTop: 4, fontWeight: '500' },
  optionalTag: { fontSize: 12, color: '#94a3b8', fontWeight: '400' },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  optionChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  optionChipSelected: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  optionChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  optionChipTextSelected: { color: '#0d9488', fontWeight: '600' },

  reportBtn: {
    backgroundColor: '#0d9488', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
    alignSelf: 'stretch', marginTop: 4,
  },
  reportBtnDisabled: { backgroundColor: '#cbd5e1' },
  reportBtnText: { color: '#fff', fontSize: 15, fontWeight: '400' },

  reportSent: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  reportSentIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#0d9488',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  reportSentEmoji: { fontSize: 22, color: '#0d9488', fontWeight: '600' },
  reportSentTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  reportSentText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
});
