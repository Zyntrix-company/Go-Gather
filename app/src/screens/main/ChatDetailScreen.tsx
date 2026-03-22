import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';

const SWEE_RESPONSES = [
  "That sounds like a great adventure! I can help you plan itineraries, find local tips, and manage group expenses.",
  "I recommend visiting during the shoulder season for the best experience and fewer crowds.",
  "For group trips, splitting costs early avoids awkwardness later. Use the Expenses tab to track everything!",
  "Don't forget to check visa requirements and travel insurance before booking flights.",
  "Goa is beautiful in winter (November–February). The beaches are perfect and the weather is ideal.",
  "I can suggest hidden gems and local restaurants if you tell me more about your travel style!",
  "Pro tip: Book accommodation at least 2 months in advance for peak season travel.",
];

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'swee' | 'other';
  senderName?: string;
  time: string;
};

const INITIAL_MESSAGES_SWEE: Message[] = [
  { id: 'm1', text: 'Hey! I\'m Swee, your AI travel companion. Ask me anything about planning your trip! ✈️', sender: 'swee', time: '10:00 AM' },
  { id: 'm2', text: 'How do I plan a group trip to Goa?', sender: 'user', time: '10:02 AM' },
  { id: 'm3', text: 'Great choice! Goa is perfect for group trips. Start by deciding on dates, then use GatherGo to invite friends, plan the itinerary, and track shared expenses. Want me to suggest a 5-day itinerary?', sender: 'swee', time: '10:02 AM' },
];

const INITIAL_MESSAGES_GROUP: Message[] = [
  { id: 'm1', text: 'Hey everyone! Super excited for Goa 🎉', sender: 'other', senderName: 'Alex', time: '9:00 AM' },
  { id: 'm2', text: 'Me too! Can\'t wait 🏖️', sender: 'other', senderName: 'Sam', time: '9:01 AM' },
  { id: 'm3', text: 'Should we book the hotel now or wait?', sender: 'user', time: '9:05 AM' },
  { id: 'm4', text: 'I say book now — prices are going up!', sender: 'other', senderName: 'Priya', time: '9:06 AM' },
];

function formatTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function getSweeResponse() {
  return SWEE_RESPONSES[Math.floor(Math.random() * SWEE_RESPONSES.length)];
}

export default function ChatDetailScreen({ route, navigation }: any) {
  const chat = route?.params?.chat ?? {
    id: 'swee',
    name: 'Swee AI',
    isSwee: true,
    subtitle: 'Your AI travel companion',
  };

  const isSwee = chat.isSwee ?? chat.id === 'swee';
  const isGroup = chat.isGroup ?? false;

  const [messages, setMessages] = useState<Message[]>(
    isSwee ? INITIAL_MESSAGES_SWEE : INITIAL_MESSAGES_GROUP
  );
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  function sendMessage() {
    const text = inputText.trim();
    if (!text) return;

    const userMsg: Message = {
      id: `m${Date.now()}`,
      text,
      sender: 'user',
      time: formatTime(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    if (isSwee) {
      setIsTyping(true);
      setTimeout(() => {
        const sweeMsg: Message = {
          id: `m${Date.now() + 1}`,
          text: getSweeResponse(),
          sender: 'swee',
          time: formatTime(),
        };
        setMessages(prev => [...prev, sweeMsg]);
        setIsTyping(false);
      }, 1200);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.sender === 'user';
    const isSweeMsg = item.sender === 'swee';

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowOther]}>
        {!isUser && (
          <View style={[styles.msgAvatar, isSweeMsg ? styles.msgAvatarSwee : styles.msgAvatarOther]}>
            {isSweeMsg ? (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" />
              </Svg>
            ) : (
              <Text style={styles.msgAvatarText}>{item.senderName?.[0] ?? '?'}</Text>
            )}
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : (isSweeMsg ? styles.msgBubbleSwee : styles.msgBubbleOther)]}>
          {!isUser && isGroup && item.senderName && (
            <Text style={styles.msgSenderName}>{item.senderName}</Text>
          )}
          <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{item.text}</Text>
          <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>{item.time}</Text>
        </View>
      </View>
    );
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <View style={[styles.headerAvatar, isSwee ? styles.headerAvatarSwee : styles.headerAvatarOther]}>
            {isSwee ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" />
              </Svg>
            ) : (
              <Text style={styles.headerAvatarText}>{chat.name[0]}</Text>
            )}
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chat.name}</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? 'typing...' : (chat.subtitle ?? (isGroup ? `${INITIAL_MESSAGES_GROUP.length} members` : 'Online'))}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <Text style={styles.typingText}>Swee is typing...</Text>
            </View>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={isSwee ? 'Ask Swee anything...' : 'Type a message...'}
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              selectionColor="#0d9488"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
              activeOpacity={0.8}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'rgba(255,255,255,0.8)',
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatarSwee: { backgroundColor: '#0d9488' },
  headerAvatarOther: { backgroundColor: '#6366f1' },
  headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },

  messageList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8, gap: 12 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgRowOther: {},

  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  msgAvatarSwee: { backgroundColor: '#0d9488' },
  msgAvatarOther: { backgroundColor: '#6366f1' },
  msgAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 13 },
  msgBubbleUser: { backgroundColor: '#0d9488', borderBottomRightRadius: 4 },
  msgBubbleSwee: { backgroundColor: '#f0fdfa', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#ccfbf1' },
  msgBubbleOther: { backgroundColor: '#f8fafc', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },

  msgSenderName: { fontSize: 11, fontWeight: '700', color: '#6366f1', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#0f172a', lineHeight: 20 },
  msgTextUser: { color: '#ffffff' },
  msgTime: { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  msgTimeUser: { color: 'rgba(255,255,255,0.7)' },

  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  typingBubble: { backgroundColor: '#f0fdfa', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ccfbf1' },
  typingText: { fontSize: 12, color: '#0d9488', fontStyle: 'italic' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
    selectionColor: '#0d9488',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#cbd5e1' },
});
