import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import MarkdownText from '../../components/common/MarkdownText';
import SweeIcon from '../../components/common/SweeIcon';
import useAuthStore from '../../store/authStore';
import {
  sendMessageStream,
  reportMessage,
  clearConversation,
  type ConversationMessage,
  type TripContext,
} from '../../api/ai.api';

// ─── Types ─────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'swee';
  time: string;
  streaming?: boolean;
};

// ─── Welcome message ───────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  text: "Hi! I'm Swee, your travel assistant. How can I help you plan your next adventure?",
  sender: 'swee',
  time: formatTime(),
};

function formatTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// ─── Build history for API ─────────────────────────────────────────────────

function toApiHistory(messages: Message[]): ConversationMessage[] {
  return messages
    .filter((m) => m.id !== 'welcome' && !m.streaming)
    .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
}

// ─── Icons ─────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);


const DotsIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z" fill="#64748b" />
  </Svg>
);

const SendIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const AttachIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Report options ────────────────────────────────────────────────────────

const REPORT_OPTIONS = [
  'Wrong information',
  'Not helpful',
  'Inappropriate content',
  'Off topic',
  'Other',
];

// ─── Typing indicator ──────────────────────────────────────────────────────

function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay(Math.max(0, 780 - i * 160)),
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={styles.msgRow}>
      <View style={styles.msgAvatarSwee}>
        <SweeIcon size={14} color="#fff" />
      </View>
      <View style={[styles.msgBubble, styles.msgBubbleSwee, styles.typingBubble]}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ChatDetailScreen({ route, navigation }: any) {
  const rawUser = useAuthStore((s) => s.user) as any;
  const userId: string = rawUser?.id ?? '';
  const initialMessageParam = route?.params?.initialMessage;

  const chat = route?.params?.chat ?? {
    id: 'swee',
    name: 'Swee',
    isSwee: true,
    subtitle: 'Always active · AI Assistant',
  };
  const isSwee = chat.isSwee ?? chat.id === 'swee';

  // Trip/event context passed from TripDetailScreen or EventDetailScreen via SweeFab
  const [tripContext, setTripContext] = useState<TripContext | null>(
    route?.params?.tripContext ?? null,
  );

  const [messages, setMessages] = useState<Message[]>([{ ...WELCOME_MESSAGE }]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const autoSentInitialRef = useRef<string | null>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const sendMessage = useCallback((overrideText?: unknown) => {
    const resolvedText = typeof overrideText === 'string' ? overrideText : inputText;
    const text = resolvedText.trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      text,
      sender: 'user',
      time: formatTime(),
    };

    const streamingMsgId = `s_${Date.now() + 1}`;
    const streamingMsg: Message = {
      id: streamingMsgId,
      text: '',
      sender: 'swee',
      time: formatTime(),
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, streamingMsg]);
    setInputText('');
    setIsTyping(true);

    const history = toApiHistory([...messages, userMsg]);

    abortRef.current = sendMessageStream(
      text,
      history,
      tripContext,
      (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId ? { ...m, text: m.text + delta } : m,
          ),
        );
      },
      () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId ? { ...m, streaming: false } : m,
          ),
        );
        setIsTyping(false);
        abortRef.current = null;
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? { ...m, text: `Sorry, something went wrong. ${err}`, streaming: false }
              : m,
          ),
        );
        setIsTyping(false);
        abortRef.current = null;
      },
    );
  }, [inputText, isTyping, messages, tripContext]);

  useEffect(() => {
    const text = typeof initialMessageParam === 'string' ? initialMessageParam.trim() : '';
    if (!text || isTyping) return;
    if (autoSentInitialRef.current === text) return;

    autoSentInitialRef.current = text;
    sendMessage(text);
    navigation.setParams({ initialMessage: undefined });
  }, [initialMessageParam, isTyping, navigation, sendMessage]);

  const handleClearConversation = useCallback(async () => {
    abortRef.current?.();
    abortRef.current = null;
    setShowOverflow(false);
    setIsTyping(false);
    setMessages([{ ...WELCOME_MESSAGE, time: formatTime() }]);
    try {
      await clearConversation(userId);
    } catch (_) { /* silent — client already cleared */ }
  }, [userId]);

  const openReportModal = useCallback(() => {
    const lastSweeMsg = [...messages].reverse().find((m) => m.sender === 'swee');
    setReportingMessageId(lastSweeMsg?.id ?? null);
    setReportReason('');
    setSelectedOption(null);
    setReportSent(false);
    setShowOverflow(false);
    setShowReportModal(true);
  }, [messages]);

  const submitReport = useCallback(async () => {
    if (!selectedOption) return;
    const combined = selectedOption + (reportReason.trim() ? ` — ${reportReason.trim()}` : '');
    setIsSubmittingReport(true);
    try {
      await reportMessage(reportingMessageId ?? '', combined);
      setReportSent(true);
    } catch (_) {
      setReportSent(true);
    } finally {
      setIsSubmittingReport(false);
    }
  }, [selectedOption, reportReason, reportingMessageId]);

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.sender === 'user';
    const isStreamingPlaceholder = !isUser && item.streaming && !item.text.trim();
    const textStyle = [styles.msgText, isUser && styles.msgTextUser];

    if (isStreamingPlaceholder) {
      return <TypingIndicator />;
    }

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowOther]}>
        {!isUser && (
          <View style={styles.msgAvatarSwee}>
            <SweeIcon size={14} color="#fff" />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleSwee]}>
          {isUser ? (
            <Text style={textStyle}>{item.text}</Text>
          ) : (
            <MarkdownText
              text={item.text}
              streaming={item.streaming}
              baseStyle={textStyle}
            />
          )}
          {item.streaming && (
            <Text style={[styles.msgText, styles.cursor]}>▌</Text>
          )}
          {!item.streaming && (
            <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>{item.time}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.7}>
            <BackIcon />
          </TouchableOpacity>

          <View style={styles.headerAvatarSwee}>
            <SweeIcon size={20} color="#fff" />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chat.name}</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? 'typing...' : 'Always active · AI Assistant'}
            </Text>
          </View>

          {/* + context button */}
          {isSwee && (
            <TouchableOpacity
              style={[styles.iconBtn, tripContext && styles.contextBtnActive]}
              onPress={() => {
                // If context already set, clear it; otherwise open would need a trip list sheet
                // For now: tap to clear the context
                if (tripContext) setTripContext(null);
              }}
              activeOpacity={0.7}
            >
              {tripContext ? (
                <View style={styles.contextPill}>
                  <Text style={styles.contextPillText} numberOfLines={1}>
                    {tripContext.name?.substring(0, 12) ?? 'Trip'}
                  </Text>
                  <CloseIcon size={12} />
                </View>
              ) : null}
            </TouchableOpacity>
          )}

          {/* Overflow menu */}
          {isSwee && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowOverflow(true)} activeOpacity={0.7}>
              <DotsIcon />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Context banner (when trip is attached) ── */}
        {tripContext && (
          <View style={styles.contextBanner}>
            <SweeIcon size={13} color="#0d9488" />
            <Text style={styles.contextBannerText} numberOfLines={1}>
              Context: {tripContext.name}
              {tripContext.destination ? ` · ${tripContext.destination}` : ''}
            </Text>
            <TouchableOpacity onPress={() => setTripContext(null)}>
              <CloseIcon size={14} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        {/* ── Input bar ── */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask Swee anything..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              selectionColor="#0d9488"
              editable={!isTyping}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isTyping}
              activeOpacity={0.8}
            >
              <SendIcon />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>

      {/* ── Overflow Menu Modal ── */}
      <Modal visible={showOverflow} transparent animationType="fade" onRequestClose={() => setShowOverflow(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOverflow(false)}>
          <View style={styles.overflowMenu}>
            <TouchableOpacity style={styles.overflowItem} onPress={handleClearConversation} activeOpacity={0.8}>
              <Text style={styles.overflowItemText}>Clear conversation</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity style={styles.overflowItem} onPress={openReportModal} activeOpacity={0.8}>
              <Text style={[styles.overflowItemText, { color: '#ef4444' }]}>Report issue</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity style={styles.overflowItem} onPress={() => { setShowOverflow(false); setShowAboutModal(true); }} activeOpacity={0.8}>
              <Text style={styles.overflowItemText}>About Swee</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Report Issue Modal ── */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report an issue</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <CloseIcon size={20} />
              </TouchableOpacity>
            </View>

            {reportSent ? (
              <View style={styles.reportSent}>
                <View style={styles.reportSentIcon}>
                  <Text style={styles.reportSentEmoji}>✓</Text>
                </View>
                <Text style={styles.reportSentTitle}>Thanks for your feedback</Text>
                <Text style={styles.reportSentText}>Your report helps us improve Swee.</Text>
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
                  value={reportReason}
                  onChangeText={setReportReason}
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
        </View>
      </Modal>

      {/* ── About Swee Modal ── */}
      <Modal visible={showAboutModal} transparent animationType="slide" onRequestClose={() => setShowAboutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.aboutModal}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>About Swee</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <CloseIcon size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.aboutAvatarRow}>
              <View style={styles.aboutAvatar}>
                <SweeIcon size={28} color="#fff" />
              </View>
            </View>
            <Text style={styles.aboutText}>
              Swee is your AI-powered travel assistant, built into GatherrGo to help you plan
              better group trips. She can suggest itineraries, recommend restaurants, answer
              visa questions, help with packing lists, and much more.{'\n\n'}
              Swee is powered by Google Gemini 2.5 Flash and gets smarter when you attach a trip or event
              context to the conversation.
            </Text>
            <Text style={styles.aboutDisclaimer}>
              Swee may occasionally make mistakes. Always verify critical travel information
              from official sources.
            </Text>
          </View>
        </View>
      </Modal>

    </BlobBackground>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: 8,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  contextBtnActive: {},
  headerAvatarSwee: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },

  contextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f0fdfa', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  contextPillText: { fontSize: 11, color: '#0d9488', fontWeight: '600', maxWidth: 80 },

  contextBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdfa', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#ccfbf1',
  },
  contextBannerText: { flex: 1, fontSize: 12, color: '#0d9488', fontWeight: '500' },

  messageList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8, gap: 12 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgRowOther: {},

  msgAvatarSwee: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  msgBubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 13 },
  msgBubbleUser: { backgroundColor: '#0d9488', borderBottomRightRadius: 4 },
  msgBubbleSwee: {
    backgroundColor: '#f0fdfa', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#ccfbf1',
  },

  msgText: { fontSize: 14, color: '#0f172a', lineHeight: 21 },
  msgTextUser: { color: '#ffffff' },
  cursor: { color: '#0d9488', fontWeight: '300' },
  msgTime: { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  msgTimeUser: { color: 'rgba(255,255,255,0.65)' },

  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#0d9488',
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    backgroundColor: 'rgba(255,255,255,0.95)', gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#f8fafc',
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#0f172a', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#cbd5e1' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },

  overflowMenu: {
    position: 'absolute', top: 60, right: 12,
    backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    minWidth: 190, overflow: 'hidden',
  },
  overflowItem: { paddingVertical: 14, paddingHorizontal: 18 },
  overflowItemText: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  overflowDivider: { height: 1, backgroundColor: '#f1f5f9' },

  reportModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reportTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
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
  reportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  reportSent: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  reportSentIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#0d9488',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  reportSentEmoji: { fontSize: 22, color: '#0d9488', fontWeight: '700' },
  reportSentTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  reportSentText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  aboutModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  aboutAvatarRow: { alignItems: 'center', marginVertical: 16 },
  aboutAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center',
  },
  aboutText: { fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 12 },
  aboutDisclaimer: { fontSize: 12, color: '#94a3b8', lineHeight: 18, fontStyle: 'italic' },
});
