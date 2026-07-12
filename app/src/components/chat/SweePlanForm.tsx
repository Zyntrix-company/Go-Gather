/**
 * SweePlanForm — interactive trip / event planning cards rendered inline in the
 * Swee chat. Swee sets `pendingAction.showForm` and the card collects the
 * structured fields the mockups ask for. Tapping "Create My Trip" / "Create
 * Event" IS the confirmation — it builds a ready-to-create PendingAction and
 * hands it to the existing execute flow.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Calendar,
  Users,
  UsersRound,
  Wallet,
  Sparkles,
  DollarSign,
  PartyPopper,
  Clock,
  MapPin,
  FileText,
  Minus,
  Plus,
  Check,
  ArrowRight,
  ChevronDown,
} from 'lucide-react-native';
import AppDatePicker from '../common/AppDatePicker';
import CurrencyPickerDropdown from '../common/CurrencyPickerDropdown';
import { getCurrencyDef } from '../../utils/currency';
import type { PendingAction } from '../../api/ai.api';

const PRIMARY = '#0d9488';

// ─── Option sets (mirror the mockups) ────────────────────────────────────────
const TRIP_GROUP_TYPES = ['Couple', 'Friends', 'Family', 'Colleagues', 'Others'];
const EVENT_GROUP_TYPES = ['Friends', 'Family', 'Colleagues', 'Couple', 'Others'];
const BUDGET_TIERS = ['Saver', 'Comfort', 'Premium', 'Luxury'];
const TRAVEL_FOCUS = [
  { key: 'Food', label: '🍜  Food' },
  { key: 'Nature', label: '🌿  Nature' },
  { key: 'Nightlife', label: '🌃  Nightlife' },
  { key: 'Culture & History', label: '🏛️  Culture & History' },
  { key: 'Adventure', label: '🧗  Adventure' },
  { key: 'Shopping', label: '🛍️  Shopping' },
];
const MAX_FOCUS = 3;

// ─── Small building blocks ───────────────────────────────────────────────────
function SectionLabel({ icon, children, hint }: { icon: React.ReactNode; children: string; hint?: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      {icon}
      <Text style={styles.sectionLabel}>{children}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && !selected && styles.chipDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled && !selected}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {selected && <Check size={13} color="#fff" strokeWidth={3} style={{ marginLeft: 5 }} />}
    </TouchableOpacity>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
          activeOpacity={0.7}
        >
          <Minus size={16} color={value <= min ? '#cbd5e1' : PRIMARY} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value + 1)} activeOpacity={0.7}>
          <Plus size={16} color={PRIMARY} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Time helpers ────────────────────────────────────────────────────────────
function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

function TimeField({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const [show, setShow] = useState(false);

  const asDate = useMemo(() => {
    const d = new Date();
    if (value) {
      const [h, m] = value.split(':').map((n) => parseInt(n, 10));
      if (!Number.isNaN(h)) d.setHours(h, m || 0, 0, 0);
    }
    return d;
  }, [value]);

  const commit = (d: Date) => {
    onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)} activeOpacity={0.8}>
        <Clock size={16} color={PRIMARY} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value ? formatTime12(value) : 'Time'}
        </Text>
        <ChevronDown size={16} color="#64748b" />
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={asDate}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, date) => {
            setShow(false);
            if (event.type === 'set' && date) commit(date);
          }}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <View style={styles.timeOverlay}>
            <View style={styles.timeSheet}>
              <DateTimePicker value={asDate} mode="time" is24Hour={false} display="spinner" onChange={(_e, date) => date && commit(date)} />
              <TouchableOpacity style={styles.timeDone} onPress={() => setShow(false)} activeOpacity={0.8}>
                <Text style={styles.timeDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ─── Shared props ────────────────────────────────────────────────────────────
type FormProps = {
  draft?: Record<string, any>;
  submitting?: boolean;
  onSubmit: (action: PendingAction) => void;
};

// ─── Trip planning card ──────────────────────────────────────────────────────
export function TripPlanForm({ draft = {}, submitting, onSubmit }: FormProps) {
  const [startDate, setStartDate] = useState<string>(draft.startDate || '');
  const [endDate, setEndDate] = useState<string>(draft.endDate || '');
  const [adults, setAdults] = useState<number>(Number(draft.adults) > 0 ? Number(draft.adults) : 1);
  const [kids, setKids] = useState<number>(Number(draft.kids) || 0);
  const [seniors, setSeniors] = useState<number>(Number(draft.seniors) || 0);
  const [groupType, setGroupType] = useState<string>(draft.groupType || '');
  const [budget, setBudget] = useState<string>(draft.budgetTier || draft.budget || '');
  const [focus, setFocus] = useState<string[]>(Array.isArray(draft.travelFocus) ? draft.travelFocus : []);
  const [currency, setCurrency] = useState<string>(draft.currency || 'USD');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  // Destination normally comes from the conversation; only editable here as a
  // fallback if Swee didn't capture it.
  const [destination, setDestination] = useState<string>(draft.destination || '');
  const needsDestination = !draft.destination;

  const datesValid = !!startDate && !!endDate && endDate >= startDate;
  const canCreate = datesValid && !!destination.trim() && !submitting;

  const toggleFocus = (key: string) => {
    setFocus((prev) => {
      if (prev.includes(key)) return prev.filter((f) => f !== key);
      if (prev.length >= MAX_FOCUS) return prev;
      return [...prev, key];
    });
  };

  const submit = () => {
    if (!canCreate) return;
    onSubmit({
      intent: 'create_trip',
      readyToCreate: true,
      draft: {
        ...draft,
        destination: destination.trim(),
        name: draft.name,
        startDate,
        endDate,
        adults,
        kids,
        seniors,
        groupType: groupType || undefined,
        budgetTier: budget || undefined,
        travelFocus: focus.length ? focus : undefined,
        currency,
        activities: draft.activities,
      },
    });
  };

  const currencyDef = getCurrencyDef(currency);

  return (
    <View style={styles.card}>
      {needsDestination && (
        <>
          <SectionLabel icon={<MapPin size={17} color="#0f172a" />}>Destination</SectionLabel>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="Where to?"
              placeholderTextColor="#94a3b8"
              selectionColor={PRIMARY}
            />
          </View>
        </>
      )}

      {/* Dates */}
      <SectionLabel icon={<Calendar size={17} color="#0f172a" />}>Dates</SectionLabel>
      <View style={styles.dateRow}>
        <View style={styles.dateCell}>
          <AppDatePicker value={startDate} onChange={setStartDate} mode="future" placeholder="Start" format="medium" />
        </View>
        <ArrowRight size={18} color="#94a3b8" />
        <View style={styles.dateCell}>
          <AppDatePicker
            value={endDate}
            onChange={setEndDate}
            mode="future"
            minDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
            placeholder="End"
            format="medium"
          />
        </View>
      </View>

      {/* Travellers */}
      <SectionLabel icon={<Users size={17} color="#0f172a" />}>Travellers</SectionLabel>
      <View style={styles.travellerRow}>
        <Stepper label="Adults" value={adults} onChange={setAdults} min={1} />
        <Stepper label="Kids" value={kids} onChange={setKids} />
        <Stepper label="Seniors" value={seniors} onChange={setSeniors} />
      </View>

      {/* Group Type */}
      <SectionLabel icon={<UsersRound size={17} color="#0f172a" />}>Group Type</SectionLabel>
      <View style={styles.chipWrap}>
        {TRIP_GROUP_TYPES.map((g) => (
          <Chip key={g} label={g} selected={groupType === g} onPress={() => setGroupType(groupType === g ? '' : g)} />
        ))}
      </View>

      {/* Budget */}
      <SectionLabel icon={<Wallet size={17} color="#0f172a" />}>Budget</SectionLabel>
      <View style={styles.chipWrap}>
        {BUDGET_TIERS.map((b) => (
          <Chip key={b} label={b} selected={budget === b} onPress={() => setBudget(budget === b ? '' : b)} />
        ))}
      </View>

      {/* Travel Focus */}
      <SectionLabel icon={<Sparkles size={17} color="#0f172a" />} hint="(select up to 3)">
        Travel Focus
      </SectionLabel>
      <View style={styles.chipWrap}>
        {TRAVEL_FOCUS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={focus.includes(f.key)}
            onPress={() => toggleFocus(f.key)}
            disabled={focus.length >= MAX_FOCUS}
          />
        ))}
      </View>

      {/* Currency */}
      <SectionLabel icon={<DollarSign size={17} color="#0f172a" />}>Preferred Currency</SectionLabel>
      <TouchableOpacity style={styles.field} onPress={() => setCurrencyOpen((o) => !o)} activeOpacity={0.8}>
        <Text style={styles.fieldText} numberOfLines={1}>
          {currencyDef ? `${currencyDef.code} – ${currencyDef.name}` : currency}
        </Text>
        <ChevronDown size={16} color="#64748b" />
      </TouchableOpacity>
      <CurrencyPickerDropdown
        visible={currencyOpen}
        selectedCode={currency}
        onSelect={(code) => {
          setCurrency(code);
          setCurrencyOpen(false);
        }}
      />

      {/* Submit */}
      <TouchableOpacity style={[styles.submitBtn, !canCreate && styles.submitBtnDisabled]} onPress={submit} disabled={!canCreate} activeOpacity={0.85}>
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Sparkles size={17} color="#fff" />
            <Text style={styles.submitText}>Create My Trip</Text>
          </>
        )}
      </TouchableOpacity>
      {!datesValid && <Text style={styles.helperText}>Pick start and end dates to continue.</Text>}
    </View>
  );
}

// ─── Event planning card ─────────────────────────────────────────────────────
export function EventPlanForm({ draft = {}, submitting, onSubmit }: FormProps) {
  const [name, setName] = useState<string>(draft.name || '');
  const [eventDate, setEventDate] = useState<string>(draft.eventDate || '');
  const [eventTime, setEventTime] = useState<string>(draft.eventTime || '');
  const [groupType, setGroupType] = useState<string>(draft.groupType || '');
  const [location, setLocation] = useState<string>(draft.location || '');
  const [description, setDescription] = useState<string>(draft.description || '');

  const canCreate = !!name.trim() && !!eventDate && !!location.trim() && !submitting;

  const submit = () => {
    if (!canCreate) return;
    onSubmit({
      intent: 'create_event',
      readyToCreate: true,
      draft: {
        ...draft,
        name: name.trim(),
        eventDate,
        eventTime: eventTime || undefined,
        eventType: draft.eventType,
        groupType: groupType || undefined,
        location: location.trim(),
        description: description.trim() || undefined,
      },
    });
  };

  return (
    <View style={styles.card}>
      {/* Event Name */}
      <SectionLabel icon={<PartyPopper size={17} color="#0f172a" />}>Event Name</SectionLabel>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => setName(t.slice(0, 60))}
          placeholder="e.g. Friday Night Party"
          placeholderTextColor="#94a3b8"
          selectionColor={PRIMARY}
        />
        <Text style={styles.counter}>{name.length}/60</Text>
      </View>

      {/* Date & Time */}
      <SectionLabel icon={<Calendar size={17} color="#0f172a" />}>Date & Time</SectionLabel>
      <View style={styles.dateRow}>
        <View style={styles.dateCell}>
          <AppDatePicker value={eventDate} onChange={setEventDate} mode="future" placeholder="Date" format="medium" />
        </View>
        <View style={styles.dateCell}>
          <TimeField value={eventTime} onChange={setEventTime} />
        </View>
      </View>

      {/* Group Type */}
      <SectionLabel icon={<UsersRound size={17} color="#0f172a" />}>Group Type</SectionLabel>
      <View style={styles.chipWrap}>
        {EVENT_GROUP_TYPES.map((g) => (
          <Chip key={g} label={g} selected={groupType === g} onPress={() => setGroupType(groupType === g ? '' : g)} />
        ))}
      </View>

      {/* Location */}
      <SectionLabel icon={<MapPin size={17} color="#0f172a" />}>Location</SectionLabel>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Taj Vivanta, MG Road, Bangalore"
          placeholderTextColor="#94a3b8"
          selectionColor={PRIMARY}
        />
      </View>

      {/* Description */}
      <SectionLabel icon={<FileText size={17} color="#0f172a" />} hint="(optional)">
        Description
      </SectionLabel>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 200))}
          placeholder="What's this event about?"
          placeholderTextColor="#94a3b8"
          selectionColor={PRIMARY}
          multiline
        />
        <Text style={styles.counter}>{description.length}/200</Text>
      </View>

      {/* Submit */}
      <TouchableOpacity style={[styles.submitBtn, !canCreate && styles.submitBtnDisabled]} onPress={submit} disabled={!canCreate} activeOpacity={0.85}>
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Sparkles size={17} color="#fff" />
            <Text style={styles.submitText}>Create Event</Text>
          </>
        )}
      </TouchableOpacity>
      {!canCreate && !submitting && <Text style={styles.helperText}>Add a name, date and location to continue.</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginTop: 8,
    marginBottom: 2,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  sectionHint: { fontSize: 12, color: '#94a3b8', fontWeight: '400' },

  // Dates
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateCell: { flex: 1 },

  // Travellers
  travellerRow: { flexDirection: 'row', gap: 8 },
  stepper: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
  },
  stepperLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  // Text fields
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    minHeight: 42,
  },
  fieldText: { flex: 1, fontSize: 14, color: '#0f172a' },
  fieldPlaceholder: { color: '#94a3b8' },

  inputWrap: { position: 'relative' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  counter: { position: 'absolute', right: 10, bottom: 8, fontSize: 11, color: '#94a3b8' },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: '#cbd5e1' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  helperText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 },

  // iOS time picker sheet
  timeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  timeSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  timeDone: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  timeDoneText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
