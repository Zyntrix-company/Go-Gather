import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';

const MOCK_MEMBERS = [
  { id: '1', name: 'You', initials: 'Y', color: '#0d9488' },
  { id: '2', name: 'Alex', initials: 'A', color: '#6366f1' },
  { id: '3', name: 'Sam', initials: 'S', color: '#f59e0b' },
];

const MOCK_EXPENSES = [
  { id: 'e1', title: 'Festival Tickets', amount: 6000, paidBy: 'You', splitAmong: 3, date: '1 Mar' },
  { id: 'e2', title: 'Transportation', amount: 1800, paidBy: 'Alex', splitAmong: 3, date: '10 Apr' },
];

const MOCK_NOTES = [
  { id: 'n1', text: 'Gates open at 4 PM. Carry valid ID.', category: 'important', pinned: true },
  { id: 'n2', text: 'Book Uber in advance — parking will be full', category: 'idea', pinned: false },
];

const MOCK_POLLS = [
  {
    id: 'p1',
    question: 'Which day should we meet beforehand?',
    options: [
      { id: 'o1', text: 'Day before at 7 PM', votes: 2 },
      { id: 'o2', text: 'Morning of the event', votes: 1 },
    ],
    totalVotes: 3,
    userVote: 'o1',
  },
];

type Tab = 'details' | 'expenses' | 'notes' | 'polls' | 'members';

export default function EventDetailScreen({ route, navigation }: any) {
  const event = route?.params?.event ?? {
    id: '1',
    name: 'Spring Music Festival',
    type: 'Music',
    location: 'Palace Grounds, Bangalore',
    date: '10 Apr 2026',
    daysToGo: 22,
    status: 'upcoming',
    image: require('../../assets/images/music_festival.png'),
    description: 'Join us for an unforgettable evening of live music under the stars. Featuring top artists from around India.',
  };

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState(MOCK_NOTES);
  const [polls, setPolls] = useState(MOCK_POLLS);

  const totalExpenses = MOCK_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  const perPerson = Math.round(totalExpenses / MOCK_MEMBERS.length);

  function vote(pollId: string, optionId: string) {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;
      const updatedOptions = p.options.map(o => ({
        ...o,
        votes: o.id === optionId ? o.votes + 1 : (o.id === p.userVote ? o.votes - 1 : o.votes),
      }));
      return { ...p, options: updatedOptions, userVote: optionId };
    }));
  }

  function addNote() {
    if (!newNote.trim()) return;
    setNotes(prev => [
      { id: `n${Date.now()}`, text: newNote.trim(), category: 'general', pinned: false },
      ...prev,
    ]);
    setNewNote('');
    setShowAddNote(false);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'notes', label: 'Notes' },
    { key: 'polls', label: 'Polls' },
    { key: 'members', label: 'Members' },
  ];

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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{event.name}</Text>
            <View style={styles.eventTypeBadge}>
              <Text style={styles.eventTypeBadgeText}>{event.type}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={5} r={1.5} fill="#0d9488" />
              <Circle cx={12} cy={12} r={1.5} fill="#0d9488" />
              <Circle cx={12} cy={19} r={1.5} fill="#0d9488" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <Image source={event.image} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay}>
            <View style={styles.heroDates}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#fff" strokeWidth={2} />
                <Path d="M16 2v4M8 2v4M3 10h18" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.heroDatesText}>{event.date}</Text>
            </View>
            {event.status === 'upcoming' && (
              <View style={styles.daysChip}>
                <Text style={styles.daysChipText}>{event.daysToGo} days to go</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPad} showsVerticalScrollIndicator={false}>

          {/* DETAILS */}
          {activeTab === 'details' && (
            <View>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIconWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={10} r={3} stroke="#0d9488" strokeWidth={2} />
                    </Svg>
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{event.location}</Text>
                  </View>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIconWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#0d9488" strokeWidth={2} />
                      <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{event.date}</Text>
                  </View>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIconWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Members</Text>
                    <Text style={styles.detailValue}>{MOCK_MEMBERS.length} people</Text>
                  </View>
                </View>
              </View>

              {event.description ? (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionTitle}>About this Event</Text>
                  <Text style={styles.descriptionText}>{event.description}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* EXPENSES */}
          {activeTab === 'expenses' && (
            <View>
              <View style={styles.expenseSummary}>
                <View style={styles.expenseSummaryItem}>
                  <Text style={styles.expenseSummaryAmount}>₹{totalExpenses.toLocaleString()}</Text>
                  <Text style={styles.expenseSummaryLabel}>Total Spent</Text>
                </View>
                <View style={styles.expenseSummaryDivider} />
                <View style={styles.expenseSummaryItem}>
                  <Text style={styles.expenseSummaryAmount}>₹{perPerson.toLocaleString()}</Text>
                  <Text style={styles.expenseSummaryLabel}>Per Person</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Add Expense', 'Expense form coming soon')} activeOpacity={0.8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.addBtnText}>Add Expense</Text>
              </TouchableOpacity>

              {MOCK_EXPENSES.map(exp => (
                <View key={exp.id} style={styles.expenseCard}>
                  <View style={styles.expenseIconWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseTitle}>{exp.title}</Text>
                    <Text style={styles.expenseMeta}>Paid by {exp.paidBy} · Split {exp.splitAmong} ways · {exp.date}</Text>
                  </View>
                  <View style={styles.expenseAmountWrap}>
                    <Text style={styles.expenseAmount}>₹{exp.amount.toLocaleString()}</Text>
                    <Text style={styles.expensePerPerson}>₹{Math.round(exp.amount / exp.splitAmong).toLocaleString()}/person</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* NOTES */}
          {activeTab === 'notes' && (
            <View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddNote(true)} activeOpacity={0.8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.addBtnText}>Add Note</Text>
              </TouchableOpacity>
              {notes.map(note => (
                <View key={note.id} style={[styles.noteCard, note.pinned && styles.noteCardPinned]}>
                  <View style={styles.noteCategoryChip}>
                    <Text style={styles.noteCategoryText}>{note.category}</Text>
                  </View>
                  <Text style={styles.noteText}>{note.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* POLLS */}
          {activeTab === 'polls' && (
            <View>
              <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Create Poll', 'Poll creation coming soon')} activeOpacity={0.8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.addBtnText}>Create Poll</Text>
              </TouchableOpacity>
              {polls.map(poll => (
                <View key={poll.id} style={styles.pollCard}>
                  <Text style={styles.pollQuestion}>{poll.question}</Text>
                  <Text style={styles.pollTotal}>{poll.totalVotes} votes</Text>
                  {poll.options.map(opt => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                    const isVoted = poll.userVote === opt.id;
                    return (
                      <TouchableOpacity key={opt.id} style={styles.pollOption} onPress={() => vote(poll.id, opt.id)} activeOpacity={0.8}>
                        <View style={styles.pollOptionBar}>
                          <View style={[styles.pollOptionFill, { width: `${pct}%` as any, backgroundColor: isVoted ? '#0d9488' : '#e2e8f0' }]} />
                        </View>
                        <View style={styles.pollOptionLabels}>
                          <Text style={[styles.pollOptionText, isVoted && styles.pollOptionTextVoted]}>{opt.text}</Text>
                          <Text style={styles.pollOptionPct}>{pct}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* MEMBERS */}
          {activeTab === 'members' && (
            <View>
              <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Invite Member', 'Invite via email coming soon')} activeOpacity={0.8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.addBtnText}>Invite Member</Text>
              </TouchableOpacity>
              {MOCK_MEMBERS.map(member => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={[styles.memberAvatar, { backgroundColor: member.color + '20' }]}>
                    <Text style={[styles.memberInitials, { color: member.color }]}>{member.initials}</Text>
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.id === '1' && <View style={styles.adminChip}><Text style={styles.adminChipText}>Admin</Text></View>}
                </View>
              ))}
            </View>
          )}

        </ScrollView>

        {/* Add Note Modal */}
        <Modal visible={showAddNote} transparent animationType="slide" onRequestClose={() => setShowAddNote(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Note</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Write your note here..."
                placeholderTextColor="#94a3b8"
                value={newNote}
                onChangeText={setNewNote}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddNote(false)} activeOpacity={0.8}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={addNote} activeOpacity={0.8}>
                  <Text style={styles.modalSaveText}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  eventTypeBadge: { backgroundColor: '#f0fdfa', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  eventTypeBadgeText: { fontSize: 11, color: '#0d9488', fontWeight: '600' },
  headerAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  heroSection: { height: 180, position: 'relative', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  heroDates: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDatesText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  daysChip: { backgroundColor: '#0d9488', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  daysChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  tabBarScroll: { flexGrow: 0, marginBottom: 8 },
  tabBarContent: { paddingHorizontal: 16, gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: '#0d9488' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  content: { flex: 1 },
  contentPad: { paddingHorizontal: 16, paddingBottom: 32 },

  detailCard: { backgroundColor: '#fff', borderRadius: 14, padding: 4, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  detailIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  detailDivider: { height: 1, backgroundColor: '#f8fafc', marginHorizontal: 12 },

  descriptionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  descriptionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  descriptionText: { fontSize: 14, color: '#64748b', lineHeight: 20 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#0d9488', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14, alignSelf: 'flex-start' },
  addBtnText: { fontSize: 13, color: '#0d9488', fontWeight: '600' },

  expenseSummary: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  expenseSummaryItem: { flex: 1, alignItems: 'center' },
  expenseSummaryAmount: { fontSize: 18, fontWeight: '800', color: '#0d9488' },
  expenseSummaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  expenseSummaryDivider: { width: 1, backgroundColor: '#f1f5f9' },

  expenseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  expenseIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  expenseMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  expenseAmountWrap: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  expensePerPerson: { fontSize: 11, color: '#94a3b8' },

  noteCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  noteCardPinned: { borderLeftWidth: 3, borderLeftColor: '#0d9488' },
  noteCategoryChip: { backgroundColor: '#f0fdfa', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  noteCategoryText: { fontSize: 11, color: '#0d9488', fontWeight: '600', textTransform: 'capitalize' },
  noteText: { fontSize: 14, color: '#334155', lineHeight: 20 },

  pollCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  pollTotal: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  pollOption: { marginBottom: 8 },
  pollOptionBar: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  pollOptionFill: { height: '100%', borderRadius: 3 },
  pollOptionLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  pollOptionText: { fontSize: 13, color: '#334155' },
  pollOptionTextVoted: { color: '#0d9488', fontWeight: '600' },
  pollOptionPct: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  memberInitials: { fontSize: 18, fontWeight: '700' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
  adminChip: { backgroundColor: '#f0fdfa', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  adminChipText: { fontSize: 11, color: '#0d9488', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 100 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0d9488', alignItems: 'center' },
  modalSaveText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
