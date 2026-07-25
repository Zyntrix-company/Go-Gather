import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Image as ImageIcon, FileText } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  pick as pickDocument,
  types as docTypes,
  keepLocalCopy,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../../components/common/AppScreenLayout';
import MarkdownText from '../../components/common/MarkdownText';
import SweeIcon from '../../components/common/SweeIcon';
import { TripPlanForm, EventPlanForm } from '../../components/chat/SweePlanForm';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import { KeyboardAvoider } from '../../components/common/KeyboardAvoider';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import { showConfirm } from '../../store/alertStore';
import {
  sendMessageStream,
  reportMessage,
  deleteConversation,
  executeAction,
  getConversation,
  getConversationMessages,
  type ConversationMessage,
  type TripContext,
  type PendingAction,
  type ExecuteResult,
  type AiMessage,
  type ChatAttachment,
} from '../../api/ai.api';
import { animateTextStream } from '../../utils/animateTextStream';
import { loadChatDraft, saveChatDraft, clearChatDraft } from '../../utils/chatDraftStorage';
import { SkeletonBox } from '../../components/common/ExpenseTabSkeleton';

// ─── Types ─────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'swee';
  time: string;
  streaming?: boolean;
  // When this Swee message contains a recap + confirm request
  pendingAction?: PendingAction | null;
  // When this Swee message is a success confirmation with navigation
  createdResult?: ExecuteResult['created'];
  // File chips to show on a user message that carried attachments
  attachments?: { name: string; kind: 'image' | 'file' }[];
};

// A file the user has staged in the composer (base64 payload sent to Swee).
type LocalAttachment = ChatAttachment & { id: string; kind: 'image' | 'file' };

const MAX_CHAT_ATTACHMENTS = 4;

/** Read a local file URI into base64 (no data: prefix). */
async function fileUriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

// ─── Welcome message variants (picked randomly, typed on screen open) ───────

function buildWelcomeVariants(firstName?: string | null): string[] {
  const name = firstName?.trim();
  if (!name) {
    return [
      "Hi! I'm Swee. Let's plan your next trip or event!",
      "Hey — I'm Swee. Where should we go next?",
      "Hi! I'm Swee. Trip or event on your mind?",
      "Hello! I'm Swee — ready when you are.",
      "Hi! I'm Swee. Tell me what you're planning.",
    ];
  }
  return [
    `Hi ${name}! I'm Swee. Let's plan your next trip or event!`,
    `Hey ${name} — I'm Swee. Where should we go next?`,
    `Hi ${name}! I'm Swee. Trip or event on your mind?`,
    `Hello ${name}! I'm Swee — ready when you are.`,
    `Hi ${name}! I'm Swee. Tell me what you're planning.`,
  ];
}

const WELCOME_ID = 'welcome';

// Bottom inset is managed manually (see the container's paddingBottom) so the
// composer can track the keyboard exactly; opt the layout out of the bottom edge.
const CHAT_SAFE_AREA_EDGES = ['top', 'left', 'right'] as const;

function formatTime(date?: Date | string) {
  const d = date ? new Date(date) : new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function sortMessagesChronologically(messages: AiMessage[]): AiMessage[] {
  return [...messages].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    if (a.role === b.role) return 0;
    return a.role === 'user' ? -1 : 1;
  });
}

function mapApiMessage(m: AiMessage): Message {
  return {
    id: m.id,
    text: m.content,
    sender: m.role === 'user' ? 'user' : 'swee',
    time: formatTime(m.createdAt),
    pendingAction: m.metadata?.pendingAction ?? null,
    createdResult: m.metadata?.createdResult ?? undefined,
  };
}

function buildPreview(text: string): string {
  const clean = text.replace(/[#*_`|]/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean;
}

// ─── Build history for API ─────────────────────────────────────────────────

function toApiHistory(messages: Message[]): ConversationMessage[] {
  return messages
    .filter((m) => m.id !== 'welcome' && !m.streaming)
    .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
}

// ─── Confirmation helpers ────────────────────────────────────────────────────

function findPendingConfirmation(messages: Message[]): { action: PendingAction; msgId: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender === 'swee' && m.pendingAction?.readyToCreate) {
      return { action: m.pendingAction, msgId: m.id };
    }
  }
  return null;
}

const AFFIRMATIVE_PHRASES = new Set([
  'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'confirm', 'confirmed',
  'go ahead', 'create it', 'do it', 'yes please', 'yeah go', 'yes done',
  'yes create it', 'yes, create it', 'save', 'save changes', 'save it',
  'looks good', 'perfect', 'sounds good', 'that works', 'go for it',
  'please do', 'please create', 'lets do it', "let's do it", 'all good',
  'sounds great', 'thats fine', "that's fine", 'fine', 'absolutely',
  'definitely', 'correct', 'right', 'agreed', 'proceed',
]);

function normalizeConfirmationInput(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[!.?,]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\bgo\s+a\s+head\b/g, 'go ahead')
    .replace(/\bya\b/g, 'yeah');
}

function isAffirmativeConfirmation(text: string): boolean {
  const normalized = normalizeConfirmationInput(text);
  if (!normalized || normalized === 'no' || normalized.startsWith('no ')) return false;
  if (/\b(but|except|wait|change|actually|instead|not|unless|although)\b/.test(normalized)) return false;
  if (AFFIRMATIVE_PHRASES.has(normalized)) return true;
  return /^(yes|yeah|yep|yup|sure|ok|okay|confirm|save|go ahead|go for it|do it|create it|sounds good|looks good|that works|perfect|please|proceed|absolutely|definitely)\b/.test(normalized);
}

// ─── Icons ─────────────────────────────────────────────────────────────────

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
    <View style={[styles.msgRow, styles.msgRowSwee]}>
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
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const initialMessageParam = route?.params?.initialMessage;

  // Space the container always reserves below the composer: the floating tab
  // bar plus the safe-area inset. KeyboardAvoider tops this up to the keyboard
  // height when the keyboard opens (max, not sum), so the composer lands flush
  // on the keyboard and the message list shrinks with it. No keyboard-height
  // math lives in this screen.
  const composerClosedOffset = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const paramConversationId = route?.params?.conversationId as string | undefined;

  const updateConversationInStore = useChatStore((s) => s.updateConversation);
  const removeConversationFromStore = useChatStore((s) => s.removeConversation);
  const prependConversationInStore = useChatStore((s) => s.prependConversation);
  const rawUser = useAuthStore((s) => s.user) as { fullName?: string; full_name?: string } | null;
  const userFirstName = (rawUser?.fullName ?? rawUser?.full_name ?? '').split(' ')[0] || null;

  const [conversationId, setConversationId] = useState<string | null>(paramConversationId ?? null);
  const [conversationTitle, setConversationTitle] = useState('New chat');
  const [tripContext, setTripContext] = useState<TripContext | null>(
    route?.params?.tripContext ?? null,
  );
  const [loadingHistory, setLoadingHistory] = useState(!!paramConversationId);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isWelcomeTyping, setIsWelcomeTyping] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
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
  const welcomeAnimRef = useRef<(() => void) | null>(null);
  const autoSentInitialRef = useRef<string | null>(null);
  const initRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const inputTextRef = useRef('');

  const draftConversationKey = conversationId ?? paramConversationId ?? null;

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadChatDraft(draftConversationKey).then((draft) => {
        if (active && draft) setInputText(draft);
      });
      return () => {
        active = false;
        saveChatDraft(draftConversationKey, inputTextRef.current);
      };
    }, [draftConversationKey]),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      saveChatDraft(draftConversationKey, inputText);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputText, draftConversationKey]);

  const startWelcomeAnimation = useCallback(() => {
    welcomeAnimRef.current?.();
    const variants = buildWelcomeVariants(userFirstName);
    const text = variants[Math.floor(Math.random() * variants.length)];
    setIsWelcomeTyping(true);
    setMessages([{
      id: WELCOME_ID,
      text: '',
      sender: 'swee',
      time: formatTime(),
      streaming: true,
    }]);

    welcomeAnimRef.current = animateTextStream(
      text,
      (partial, done) => {
        setMessages([{
          id: WELCOME_ID,
          text: partial,
          sender: 'swee',
          time: formatTime(),
          streaming: !done,
        }]);
        if (done) setIsWelcomeTyping(false);
      },
    );
  }, [userFirstName]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current || !hasMoreOlder) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await getConversationMessages(conversationId, {
        before: nextBefore ?? undefined,
      });
      setMessages((prev) => [
        ...sortMessagesChronologically(data.messages).map(mapApiMessage),
        ...prev,
      ]);
      setHasMoreOlder(data.hasMore);
      setNextBefore(data.nextBefore);
    } catch {
      // non-blocking
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, hasMoreOlder, nextBefore]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        let convId = paramConversationId ?? null;
        const ctx = route?.params?.tripContext as TripContext | undefined;

        if (!convId) {
          if (ctx) setTripContext(ctx);
          setLoadingHistory(false);
          if (!initialMessageParam) startWelcomeAnimation();
          return;
        }

        setConversationId(convId);
        const [meta, msgData] = await Promise.all([
          getConversation(convId),
          getConversationMessages(convId),
        ]);
        if (cancelled) return;

        setConversationTitle(meta.title);
        if (meta.tripContext) setTripContext(meta.tripContext);
        const loaded = sortMessagesChronologically(msgData.messages).map(mapApiMessage);
        setMessages(loaded);
        setHasMoreOlder(msgData.hasMore);
        setNextBefore(msgData.nextBefore);
        setLoadingHistory(false);

        if (loaded.length === 0 && !initialMessageParam) {
          startWelcomeAnimation();
        }
      } catch {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
      welcomeAnimRef.current?.();
    };
  }, [paramConversationId, route?.params?.tripContext, startWelcomeAnimation]);

  // Scrolling to the newest message is driven by the FlatList's
  // onContentSizeChange, which fires after layout settles — see below.

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.();
      welcomeAnimRef.current?.();
    };
  }, []);

  // Execute a confirmed Swee action (create/update trip or event)
  const handleConfirmAction = useCallback(async (action: PendingAction, fromMsgId: string) => {
    if (isExecuting) return;
    setIsExecuting(true);

    setMessages((prev) =>
      prev.map((m) => m.id === fromMsgId ? { ...m, pendingAction: null } : m),
    );

    const workingId = `exec_${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: workingId,
      text: '',
      sender: 'swee',
      time: formatTime(),
      streaming: true,
    }]);

    const finishStream = (reply: string, created?: ExecuteResult['created']) => {
      animateTextStream(reply, (partial, done) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === workingId
              ? {
                  ...m,
                  text: partial,
                  streaming: !done,
                  createdResult: done ? created : m.createdResult,
                }
              : m,
          ),
        );
        if (done) setIsExecuting(false);
      });
    };

    try {
      const result = await executeAction(action, conversationId);
      finishStream(result.reply, result.created ?? undefined);
      if (conversationId) {
        updateConversationInStore(conversationId, {
          preview: buildPreview(result.reply),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';
      finishStream(msg);
    }
  }, [conversationId, isExecuting, updateConversationInStore]);

  const streamToSwee = useCallback((text: string, currentMessages: Message[], userMsg: Message, msgAttachments?: ChatAttachment[]) => {
    const streamingMsgId = `s_${Date.now() + 1}`;
    const streamingMsg: Message = {
      id: streamingMsgId,
      text: '',
      sender: 'swee',
      time: formatTime(),
      streaming: true,
    };

    setMessages((prev) => [...prev, streamingMsg]);
    setIsTyping(true);

    const history = toApiHistory([...currentMessages, userMsg]);
    let accumulatedReply = '';

    abortRef.current = sendMessageStream(
      text,
      conversationId,
      history,
      tripContext,
      (partial) => {
        accumulatedReply = partial;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId ? { ...m, text: partial } : m,
          ),
        );
      },
      ({ pendingAction, conversationId: convId, messageId }) => {
        const isFirstPersist = Boolean(convId && !conversationId);
        if (convId) setConversationId(convId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? {
                  ...m,
                  id: messageId ?? m.id,
                  streaming: false,
                  pendingAction: pendingAction ?? null,
                }
              : m,
          ),
        );
        const resolvedId = convId ?? conversationId;
        if (resolvedId) {
          updateConversationInStore(resolvedId, {
            preview: buildPreview(accumulatedReply),
            updatedAt: new Date().toISOString(),
          });
        }
        if (isFirstPersist && convId) {
          getConversation(convId)
            .then((conv) => {
              prependConversationInStore(conv);
              setConversationTitle(conv.title);
            })
            .catch(() => {});
        }
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
      msgAttachments,
    );
  }, [conversationId, tripContext, updateConversationInStore, prependConversationInStore]);

  const addImageAttachment = useCallback(async () => {
    setShowAttachMenu(false);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: true });
      const asset = result.assets?.[0];
      if (!asset?.base64) return;
      setAttachments((prev) =>
        prev.length >= MAX_CHAT_ATTACHMENTS
          ? prev
          : [...prev, {
              id: `att_${Date.now()}`,
              name: asset.fileName || 'photo.jpg',
              mimeType: asset.type || 'image/jpeg',
              data: asset.base64!,
              kind: 'image',
            }],
      );
    } catch {
      // cancelled / failed — no-op
    }
  }, []);

  const addDocumentAttachment = useCallback(async () => {
    setShowAttachMenu(false);
    try {
      const [picked] = await pickDocument({ type: [docTypes.pdf, docTypes.images, docTypes.plainText] });
      if (!picked?.uri) return;
      const [localCopy] = await keepLocalCopy({
        files: [{ uri: picked.uri, fileName: picked.name ?? `file_${Date.now()}` }],
        destination: 'cachesDirectory',
      });
      const uri = localCopy.status === 'success' ? localCopy.localUri : picked.uri;
      const base64 = await fileUriToBase64(uri);
      if (!base64) return;
      setAttachments((prev) =>
        prev.length >= MAX_CHAT_ATTACHMENTS
          ? prev
          : [...prev, {
              id: `att_${Date.now()}`,
              name: picked.name || 'document',
              mimeType: picked.type || 'application/pdf',
              data: base64,
              kind: 'file',
            }],
      );
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      // other errors — silently ignore, user can retry
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const sendMessage = useCallback((overrideText?: unknown) => {
    const resolvedText = typeof overrideText === 'string' ? overrideText : inputText;
    const text = resolvedText.trim();
    const outgoing = attachments;
    if ((!text && outgoing.length === 0) || isTyping || isExecuting || isWelcomeTyping) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      text,
      sender: 'user',
      time: formatTime(),
      attachments: outgoing.length
        ? outgoing.map((a) => ({ name: a.name, kind: a.kind }))
        : undefined,
    };

    setInputText('');
    setAttachments([]);
    clearChatDraft(draftConversationKey);

    const apiAttachments: ChatAttachment[] = outgoing.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      data: a.data,
    }));

    setMessages((prev) => {
      const pending = findPendingConfirmation(prev);
      const withUser = [...prev, userMsg];

      // A typed "yes" only confirms when there are no new attachments to read.
      if (pending && outgoing.length === 0 && isAffirmativeConfirmation(text)) {
        queueMicrotask(() => handleConfirmAction(pending.action, pending.msgId));
        return withUser;
      }

      queueMicrotask(() => streamToSwee(text, prev, userMsg, apiAttachments));
      return withUser;
    });
  }, [inputText, attachments, isTyping, isExecuting, isWelcomeTyping, handleConfirmAction, streamToSwee, draftConversationKey]);

  const handleIdentifyResponse = useCallback((msgId: string, affirmative: boolean) => {
    if (isTyping || isExecuting) return;
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, pendingAction: null } : m),
    );
    sendMessage(affirmative ? 'Yes' : 'No');
  }, [isTyping, isExecuting, sendMessage]);

  useEffect(() => {
    const text = typeof initialMessageParam === 'string' ? initialMessageParam.trim() : '';
    if (!text || isTyping) return;
    if (autoSentInitialRef.current === text) return;

    autoSentInitialRef.current = text;
    sendMessage(text);
    navigation.setParams({ initialMessage: undefined });
  }, [initialMessageParam, isTyping, navigation, sendMessage]);

  const performDeleteChat = useCallback(async () => {
    if (!conversationId) return;
    abortRef.current?.();
    abortRef.current = null;
    setShowOverflow(false);
    setIsTyping(false);
    setIsExecuting(false);
    welcomeAnimRef.current?.();
    try {
      await deleteConversation(conversationId);
      removeConversationFromStore(conversationId);
    } catch {
      // still navigate back on failure — user wanted to leave
    }
    navigation.goBack();
  }, [conversationId, navigation, removeConversationFromStore]);

  // Deleting a chat is irreversible — always confirm first. ("Close chat" on an
  // unsaved conversation destroys nothing, so it goes straight back.)
  const handleDeleteChat = useCallback(() => {
    if (!conversationId) {
      navigation.goBack();
      return;
    }
    setShowOverflow(false);
    showConfirm({
      title: 'Delete chat?',
      message: `"${conversationTitle}" and all its messages will be permanently deleted. This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => { void performDeleteChat(); },
    });
  }, [conversationId, conversationTitle, navigation, performDeleteChat]);

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

    const hasTable = !isUser && /\|.+\|/.test(item.text);

    const showConfirmChips = !isUser && !item.streaming && item.pendingAction?.readyToCreate === true;
    const showIdentifyChips = !isUser && !item.streaming && item.pendingAction?.intent === 'identify_update';
    const showViewBtn = !isUser && !item.streaming && item.createdResult;
    let formType = !isUser && !item.streaming ? item.pendingAction?.showForm : undefined;
    // Don't render a live, re-submittable card once a trip/event was already
    // created after it (prevents a persisted card re-appearing on reload and
    // letting the user create a duplicate).
    if (formType) {
      const idx = messages.findIndex((m) => m.id === item.id);
      if (idx >= 0 && messages.slice(idx + 1).some((m) => m.createdResult)) {
        formType = undefined;
      }
    }
    const hasAttachments = isUser && !!item.attachments?.length;

    return (
      <View>
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowSwee, hasTable && styles.msgRowWide]}>
        <View style={[
          styles.msgBubble,
          isUser ? styles.msgBubbleUser : styles.msgBubbleSwee,
          hasTable && styles.msgBubbleWide,
        ]}>
          {hasAttachments && (
            <View style={styles.msgAttachList}>
              {item.attachments!.map((a, i) => (
                <View key={i} style={styles.msgAttachChip}>
                  {a.kind === 'image' ? <ImageIcon size={14} color="#fff" /> : <FileText size={14} color="#fff" />}
                  <Text style={styles.msgAttachName} numberOfLines={1}>{a.name}</Text>
                </View>
              ))}
            </View>
          )}
          {isUser ? (
            item.text ? <Text style={textStyle}>{item.text}</Text> : null
          ) : (
            <MarkdownText
              text={item.text}
              streaming={item.streaming}
              baseStyle={textStyle}
            />
          )}
          {!item.streaming && (
            <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>{item.time}</Text>
          )}

          {/* ── Identify chips (update flow: "Is this the one?") ── */}
          {showIdentifyChips && (
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmYes}
                onPress={() => handleIdentifyResponse(item.id, true)}
                activeOpacity={0.8}
                disabled={isTyping || isExecuting}
              >
                <Text style={styles.confirmYesText}>Yes, that's it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmNo}
                onPress={() => handleIdentifyResponse(item.id, false)}
                activeOpacity={0.8}
                disabled={isTyping || isExecuting}
              >
                <Text style={styles.confirmNoText}>No, different one</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Confirm chips (shown when Swee asks for confirmation) ── */}
          {showConfirmChips && (
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmYes}
                onPress={() => handleConfirmAction(item.pendingAction!, item.id)}
                activeOpacity={0.8}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmYesText}>
                    {item.pendingAction?.intent === 'update_trip' || item.pendingAction?.intent === 'update_event'
                      ? 'Save changes'
                      : item.pendingAction?.intent === 'add_note'
                        ? 'Save note'
                        : 'Yes, create it'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmNo}
                onPress={() =>
                  setMessages((prev) =>
                    prev.map((m) => m.id === item.id ? { ...m, pendingAction: null } : m),
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.confirmNoText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── View Trip/Event button after successful creation ── */}
          {showViewBtn && (
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => {
                const res = item.createdResult!;
                if (res.type === 'trip') {
                  navigation.navigate('TripDetail', { trip: { id: res.id, name: res.name } });
                } else {
                  navigation.navigate('EventDetail', { event: { id: res.id, name: res.name } });
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>View {item.createdResult!.type === 'trip' ? 'Trip' : 'Event'} →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Structured planning card (trip / event questionnaire) ── */}
      {formType === 'trip' && (
        <TripPlanForm
          draft={item.pendingAction?.draft}
          submitting={isExecuting}
          onSubmit={(action) => handleConfirmAction(action, item.id)}
        />
      )}
      {formType === 'event' && (
        <EventPlanForm
          draft={item.pendingAction?.draft}
          submitting={isExecuting}
          onSubmit={(action) => handleConfirmAction(action, item.id)}
        />
      )}
      </View>
    );
  }

  return (
    <AppScreenLayout
      navigation={navigation}
      activeTab="chat"
      safeAreaStyle={{ flex: 1 }}
      onLogoPress={() => navigation.goBack()}
      showFooter={!keyboardVisible}
      edges={CHAT_SAFE_AREA_EDGES}
    >
      <KeyboardAvoider existingBottomSpace={composerClosedOffset}>
      <View style={[styles.container, { paddingBottom: composerClosedOffset }]}>

        {/* ── Chat sub-header ── */}
        <View style={styles.header}>
          <View style={styles.headerAvatarSwee}>
            <SweeIcon size={20} color="#fff" />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{conversationTitle}</Text>
            {(isTyping || isWelcomeTyping) ? (
              <Text style={styles.headerSubtitle}>typing...</Text>
            ) : null}
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowOverflow(true)} activeOpacity={0.7}>
            <DotsIcon />
          </TouchableOpacity>
        </View>

        {/* Trip/event context is attached silently — passed to Swee, intentionally not shown in the UI. */}

        {/* ── Messages ── */}
        {loadingHistory ? (
          <View style={styles.historySkeleton}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.msgRow, i % 2 === 0 ? styles.msgRowUser : styles.msgRowSwee]}>
                <SkeletonBox width={i % 2 === 0 ? '55%' : '70%'} height={52} style={{ borderRadius: 16 }} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.list}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y < 48) loadOlderMessages();
            }}
            scrollEventThrottle={200}
            // Follow layout instead of racing it: the composer/keyboard resize
            // changes content size, so this fires after the relayout settles.
            // Deferred one frame: nested content (forms/cards) can report this
            // event before its own layout pass commits, so scrolling immediately
            // would land short of the true bottom.
            onContentSizeChange={() => {
              requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
            }}
            ListHeaderComponent={
              loadingOlder ? (
                <ActivityIndicator style={styles.olderLoader} color="#0d9488" />
              ) : null
            }
          />
        )}

        {/* ── Input bar ── */}
        {attachments.length > 0 && (
          <View style={styles.composerAttachments}>
            {attachments.map((a) => (
              <View key={a.id} style={styles.composerChip}>
                {a.kind === 'image' ? <ImageIcon size={14} color="#0d9488" /> : <FileText size={14} color="#0d9488" />}
                <Text style={styles.composerChipName} numberOfLines={1}>{a.name}</Text>
                <TouchableOpacity onPress={() => removeAttachment(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CloseIcon size={14} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowAttachMenu(true)}
            disabled={isTyping || isWelcomeTyping || isExecuting || attachments.length >= MAX_CHAT_ATTACHMENTS}
            activeOpacity={0.7}
          >
            <AttachIcon />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Ask Swee anything..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            selectionColor="#0d9488"
            editable={!isTyping && !isWelcomeTyping}
          />
          <TouchableOpacity
            style={[styles.sendBtn, ((!inputText.trim() && attachments.length === 0) || isTyping || isWelcomeTyping || isExecuting) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={(!inputText.trim() && attachments.length === 0) || isTyping || isWelcomeTyping || isExecuting}
            activeOpacity={0.8}
          >
            <SendIcon />
          </TouchableOpacity>
        </View>

      </View>
      </KeyboardAvoider>

      {/* ── Overflow Menu Modal ── */}
      <Modal visible={showOverflow} transparent animationType="fade" onRequestClose={() => setShowOverflow(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOverflow(false)}>
          <View style={styles.overflowMenu}>
            <TouchableOpacity style={styles.overflowItem} onPress={handleDeleteChat} activeOpacity={0.8}>
              <Text style={[styles.overflowItemText, { color: '#ef4444' }]}>
                {conversationId ? 'Delete chat' : 'Close chat'}
              </Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity style={styles.overflowItem} onPress={openReportModal} activeOpacity={0.8}>
              <Text style={styles.overflowItemText}>Report issue</Text>
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
              <TouchableOpacity onPress={() => setShowReportModal(false)} activeOpacity={0.7}>
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
              <TouchableOpacity onPress={() => setShowAboutModal(false)} activeOpacity={0.7}>
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
              Swee is powered by Google Gemini 2.5 Flash. When you open her from a trip or event page,
              she automatically understands that trip or event — no setup needed.
            </Text>
            <Text style={styles.aboutDisclaimer}>
              Swee may occasionally make mistakes. Always verify critical travel information
              from official sources.{'\n\n'}
              Fair use limits apply so everyone gets a smooth experience — if you send many
              messages in a short time, Swee may ask you to wait a minute, an hour, or until
              tomorrow.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Attachment menu (Photo / Document) ── */}
      <Modal visible={showAttachMenu} transparent animationType="slide" onRequestClose={() => setShowAttachMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.attachSheet}>
            <View style={styles.attachSheetHandle} />
            <Text style={styles.attachSheetTitle}>Share with Swee</Text>
            <Text style={styles.attachSheetSubtitle}>Attach an itinerary or photo and Swee will read it.</Text>
            <TouchableOpacity style={styles.attachOption} onPress={addImageAttachment} activeOpacity={0.8}>
              <View style={styles.attachOptionIconWrap}>
                <ImageIcon size={22} color="#0d9488" />
              </View>
              <View style={styles.attachOptionInfo}>
                <Text style={styles.attachOptionTitle}>Photo</Text>
                <Text style={styles.attachOptionDesc}>Pick an image from your gallery</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={addDocumentAttachment} activeOpacity={0.8}>
              <View style={styles.attachOptionIconWrap}>
                <FileText size={22} color="#0d9488" />
              </View>
              <View style={styles.attachOptionInfo}>
                <Text style={styles.attachOptionTitle}>Document</Text>
                <Text style={styles.attachOptionDesc}>PDF, image or text file</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </AppScreenLayout>
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
  headerAvatarSwee: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 14, fontWeight: '400', color: '#009788' },
  headerSubtitle: { fontSize: 11, color: '#64748b', marginTop: 1 },

  list: { flex: 1 },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8, gap: 10 },
  historySkeleton: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  olderLoader: { marginVertical: 8 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  msgRowUser: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
  msgRowSwee: { justifyContent: 'flex-start' },
  msgRowWide: { alignSelf: 'stretch', width: '100%' },

  msgBubble: { maxWidth: '82%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  msgBubbleWide: { maxWidth: '100%', alignSelf: 'stretch', width: '100%' },
  msgBubbleUser: { backgroundColor: '#0d9488', borderBottomRightRadius: 4 },
  msgBubbleSwee: {
    backgroundColor: '#f0fdfa', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#ccfbf1',
  },

  // Confirm chips
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  confirmYes: {
    backgroundColor: '#0d9488', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9,
    minWidth: 110, alignItems: 'center',
  },
  confirmYesText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  confirmNo: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  confirmNoText: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  // View Trip/Event button after creation
  viewBtn: {
    marginTop: 10, backgroundColor: '#0d9488',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  viewBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  msgText: { fontSize: 14, color: '#0f172a', lineHeight: 21 },
  msgTextUser: { color: '#ffffff' },
  msgTime: { fontSize: 10, color: '#94a3b8', marginTop: 6, textAlign: 'right' },
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
  attachBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f0fdfa', borderWidth: 1.5, borderColor: '#ccfbf1',
    alignItems: 'center', justifyContent: 'center',
  },

  // Staged attachments in the composer
  composerAttachments: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingTop: 10,
  },
  composerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1',
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, maxWidth: 200,
  },
  composerChipName: { flex: 1, fontSize: 12, color: '#0f172a', fontWeight: '500' },

  // Attachment chips shown on a sent user message
  msgAttachList: { gap: 6, marginBottom: 6 },
  msgAttachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  msgAttachName: { flex: 1, fontSize: 12, color: '#ffffff', fontWeight: '500' },

  // Attachment bottom sheet
  attachSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  attachSheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 16,
  },
  attachSheetTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  attachSheetSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 },
  attachOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  attachOptionIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1',
    alignItems: 'center', justifyContent: 'center',
  },
  attachOptionInfo: { flex: 1 },
  attachOptionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  attachOptionDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
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
