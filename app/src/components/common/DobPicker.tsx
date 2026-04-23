import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildYears(): string[] {
  const result: string[] = [];
  for (let y = new Date().getFullYear() - 5; y >= 1900; y--) result.push(String(y));
  return result;
}
const ALL_YEARS = buildYears();

function daysInMonth(month1Based: number | null, year: number | null): number {
  if (!month1Based || !year) return 31;
  return new Date(year, month1Based, 0).getDate();
}

function parseIso(iso: string) {
  if (!iso) return { day: '', month: '', year: '' };
  const [y, m, d] = iso.split('-');
  return {
    year: y || '',
    month: m ? (MONTHS[parseInt(m, 10) - 1] ?? '') : '',
    day: d ? String(parseInt(d, 10)) : '',
  };
}

// ─── Inner picker modal (reusable for each column) ────────────────────────────
function ColModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.handle} />
          <Text style={ms.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={i => i}
            initialNumToRender={20}
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[ms.option, item === selected && ms.optionActive]}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}>
                <Text style={[ms.optionText, item === selected && ms.optionTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={ms.cancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={ms.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '70%' },
  handle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  option: { height: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingHorizontal: 8 },
  optionActive: { backgroundColor: '#f0fdfa' },
  optionText: { fontSize: 15, color: '#0f172a' },
  optionTextActive: { color: '#0d9488', fontWeight: '600' },
  cancel: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});

// ─── Chevron icon ─────────────────────────────────────────────────────────────
function Chev() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
type Props = {
  value: string;        // '' or 'YYYY-MM-DD'
  onChange: (iso: string) => void;
  error?: string;
  disabled?: boolean;
};

export default function DobPicker({ value, onChange, error, disabled }: Props) {
  const init = parseIso(value);
  const [day, setDay] = useState(init.day);
  const [month, setMonth] = useState(init.month);
  const [year, setYear] = useState(init.year);
  const [open, setOpen] = useState<'day' | 'month' | 'year' | null>(null);

  // Sync when external value changes (e.g. pre-populated from social login)
  useEffect(() => {
    const p = parseIso(value);
    setDay(p.day);
    setMonth(p.month);
    setYear(p.year);
  }, [value]);

  const monthIdx = MONTHS.indexOf(month) + 1;   // 1-based, 0 if not set
  const yearNum = year ? parseInt(year, 10) : null;
  const maxDays = daysInMonth(monthIdx || null, yearNum);
  const dayOptions = Array.from({ length: maxDays }, (_, i) => String(i + 1));

  function emit(d: string, m: string, y: string) {
    if (!d || !m || !y) return;
    const mi = MONTHS.indexOf(m) + 1;
    onChange(`${y}-${String(mi).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`);
  }

  function pickDay(d: string) {
    setDay(d);
    emit(d, month, year);
  }

  function pickMonth(m: string) {
    const mi = MONTHS.indexOf(m) + 1;
    const max = daysInMonth(mi, yearNum);
    const nd = day && parseInt(day, 10) > max ? '' : day;
    setMonth(m);
    setDay(nd);
    emit(nd, m, year);
  }

  function pickYear(y: string) {
    const yn = parseInt(y, 10);
    const max = daysInMonth(monthIdx || null, yn);
    const nd = day && parseInt(day, 10) > max ? '' : day;
    setYear(y);
    setDay(nd);
    emit(nd, month, y);
  }

  const hasError = !!error;

  return (
    <>
      <ColModal visible={open === 'day'} title="Day" options={dayOptions} selected={day} onSelect={pickDay} onClose={() => setOpen(null)} />
      <ColModal visible={open === 'month'} title="Month" options={MONTHS} selected={month} onSelect={pickMonth} onClose={() => setOpen(null)} />
      <ColModal visible={open === 'year'} title="Year" options={ALL_YEARS} selected={year} onSelect={pickYear} onClose={() => setOpen(null)} />

      <View style={[s.row, hasError && s.rowError]}>
        {/* Day */}
        <TouchableOpacity
          style={[s.col, s.colDay, open === 'day' && s.colFocused]}
          onPress={() => !disabled && setOpen('day')}
          activeOpacity={0.8}
          disabled={disabled}>
          <Text style={[s.colText, !day && s.placeholder]}>{day || 'DD'}</Text>
          <Chev />
        </TouchableOpacity>

        {/* Month */}
        <TouchableOpacity
          style={[s.col, s.colMonth, open === 'month' && s.colFocused]}
          onPress={() => !disabled && setOpen('month')}
          activeOpacity={0.8}
          disabled={disabled}>
          <Text style={[s.colText, !month && s.placeholder]} numberOfLines={1}>{month || 'Month'}</Text>
          <Chev />
        </TouchableOpacity>

        {/* Year */}
        <TouchableOpacity
          style={[s.col, s.colYear, open === 'year' && s.colFocused]}
          onPress={() => !disabled && setOpen('year')}
          activeOpacity={0.8}
          disabled={disabled}>
          <Text style={[s.colText, !year && s.placeholder]}>{year || 'YYYY'}</Text>
          <Chev />
        </TouchableOpacity>
      </View>

      {hasError && <Text style={s.errorText}>{error}</Text>}
    </>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowError: {
    // tint border on all cols via colFocused override applied through error state
  },
  col: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colFocused: {
    borderColor: '#0d9488',
  },
  colDay: { flex: 1 },
  colMonth: { flex: 2 },
  colYear: { flex: 1.4 },
  colText: { fontSize: 13, color: '#0f172a', flex: 1 },
  placeholder: { color: '#94a3b8' },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: -6,
    marginBottom: 10,
    fontWeight: '500',
  },
});
