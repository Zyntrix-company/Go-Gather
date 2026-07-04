/**
 * AppDatePicker — a unified, reusable date picker for the entire app.
 *
 * UI: Tapping the field opens a centered calendar with Month/Year dropdowns
 * at the top and a 7×N day grid below. Tapping a day selects it and closes
 * the modal — optimised for fast picking.
 *
 * Modes:
 *   'trip' | 'event' | 'future'  →  today  ..  today + 365 days (cap)
 *   'dob'                        →  today − 100y  ..  today − 13y
 *   'past'                       →  ..  today
 *   'any' (default)              →  no constraint
 *
 * Explicit `minDate` / `maxDate` always override the mode defaults.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  FlatList,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

// ─── Colour & layout tokens ──────────────────────────────────────────────────
const C = {
  primary: '#0d9488',
  primarySoft: '#a6f4d8',     // today pill
  primarySolid: '#0d9488',    // selected pill
  text: '#0f172a',
  textMute: '#94a3b8',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  borderFocus: '#0d9488',
  surface: '#ffffff',
  surfaceMute: '#f1f5f9',
  rowSelectedBg: '#dbeafe',  // active option in dropdown (matches reference)
  error: '#ef4444',
};

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ─── Date helpers ────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');

function startOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampDate(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return new Date(min.getTime());
  if (max && d > max) return new Date(max.getTime());
  return d;
}

// ─── Mode → range resolver ───────────────────────────────────────────────────
export type DatePickerMode = 'trip' | 'event' | 'future' | 'dob' | 'past' | 'any';

function resolveRange(
  mode: DatePickerMode | undefined,
  minDate?: Date,
  maxDate?: Date,
): { min?: Date; max?: Date } {
  const today = startOfDay(new Date());
  let min: Date | undefined;
  let max: Date | undefined;

  switch (mode) {
    case 'trip':
    case 'event': {
      max = new Date(today.getTime());
      max.setDate(max.getDate() + 365);
      break;
    }
    case 'future': {
      min = today;
      max = new Date(today.getTime());
      max.setDate(max.getDate() + 365);
      break;
    }
    case 'dob': {
      max = new Date(today.getTime());
      max.setFullYear(max.getFullYear() - 13);
      min = new Date(today.getTime());
      min.setFullYear(min.getFullYear() - 100);
      break;
    }
    case 'past': {
      max = today;
      break;
    }
    case 'any':
    default:
      break;
  }

  if (minDate) min = startOfDay(minDate);
  if (maxDate) max = startOfDay(maxDate);
  return { min, max };
}

// ─── Display formatter ───────────────────────────────────────────────────────
export type DateDisplayFormat = 'dd/mm/yy' | 'dd/mm/yyyy' | 'long' | 'medium';

export function formatPickedDate(iso: string, fmt: DateDisplayFormat = 'medium'): string {
  const d = parseIso(iso);
  if (!d) return '';
  switch (fmt) {
    case 'dd/mm/yy':
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
    case 'dd/mm/yyyy':
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    case 'long':
      return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
    case 'medium':
    default:
      return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }
}

// ─── Calendar icon ───────────────────────────────────────────────────────────
function CalendarIcon({ color = C.primary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDown({ color = C.textSecondary }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Public Component ────────────────────────────────────────────────────────
export type AppDatePickerProps = {
  /** Selected date as ISO 'YYYY-MM-DD' (or '' / undefined for none). */
  value?: string;
  /** Fires with new ISO date when user picks a day. */
  onChange: (iso: string) => void;
  /** Convenience preset for min/max range. */
  mode?: DatePickerMode;
  /** Hard min date (overrides mode). */
  minDate?: Date;
  /** Hard max date (overrides mode). */
  maxDate?: Date;
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** Display format for the trigger label. */
  format?: DateDisplayFormat;
  /** Inline error message — also tints the trigger border red. */
  error?: string | null;
  /** Disable interaction. */
  disabled?: boolean;
  /** Calendar modal title (defaults to 'Select date'). */
  title?: string;
  /** Trigger container style. */
  triggerStyle?: StyleProp<ViewStyle>;
  /** Called when the modal closes (selection or cancel). */
  onClose?: () => void;
};

export default function AppDatePicker({
  value,
  onChange,
  mode = 'any',
  minDate,
  maxDate,
  placeholder = 'DD/MM/YY',
  format = 'dd/mm/yy',
  error,
  disabled,
  title = 'Select date',
  triggerStyle,
  onClose,
}: AppDatePickerProps) {
  const { min, max } = useMemo(
    () => resolveRange(mode, minDate, maxDate),
    [mode, minDate?.getTime(), maxDate?.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [visible, setVisible] = useState(false);
  const hasError = !!error;
  const hasValue = !!value;

  const display = hasValue ? formatPickedDate(value!, format) : placeholder;

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.8}
        disabled={disabled}
        style={[
          styles.trigger,
          hasError && styles.triggerError,
          disabled && styles.triggerDisabled,
          triggerStyle,
        ]}>
        <Text style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]} numberOfLines={1}>
          {display}
        </Text>
        <CalendarIcon color={hasError ? C.error : C.primary} />
      </TouchableOpacity>

      {hasError && !!error?.trim() && <Text style={styles.errorText}>{error}</Text>}

      {visible && (
        <CalendarModal
          visible={visible}
          title={title}
          value={value}
          min={min}
          max={max}
          onSelect={iso => {
            onChange(iso);
            setVisible(false);
            onClose?.();
          }}
          onCancel={() => {
            setVisible(false);
            onClose?.();
          }}
        />
      )}
    </>
  );
}

// ─── Calendar Modal ──────────────────────────────────────────────────────────
function CalendarModal({
  visible,
  title,
  value,
  min,
  max,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  title: string;
  value?: string;
  min?: Date;
  max?: Date;
  onSelect: (iso: string) => void;
  onCancel: () => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = parseIso(value);

  // Pick an initial view that's actually within range. Prefer:
  //   1. The current selected date
  //   2. Today (if in range)
  //   3. The nearest boundary (min or max)
  const initialView = useMemo(() => {
    if (selected) return clampDate(selected, min, max);
    if ((!min || today >= min) && (!max || today <= max)) return today;
    if (min && today < min) return min;
    if (max && today > max) return max;
    return today;
  }, [selected, min, max, today]);

  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth()); // 0-11
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);

  // Re-init view when modal re-opens with different value/range.
  useEffect(() => {
    setViewYear(initialView.getFullYear());
    setViewMonth(initialView.getMonth());
    setMonthOpen(false);
    setYearOpen(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Year list (descending — same order as the reference UI dropdown) ──
  const yearOptions = useMemo(() => {
    const minY = min ? min.getFullYear() : 1900;
    const maxY = max ? max.getFullYear() : new Date().getFullYear() + 50;
    const arr: number[] = [];
    for (let y = maxY; y >= minY; y--) arr.push(y);
    return arr;
  }, [min, max]);

  // ── Day grid for the visible month ──
  const daysGrid = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const totalDays = daysInMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  function isMonthInRange(year: number, month0: number): boolean {
    if (!min && !max) return true;
    const monthEnd = new Date(year, month0, daysInMonth(year, month0));
    const monthStart = new Date(year, month0, 1);
    if (max && monthStart > max) return false;
    if (min && monthEnd < min) return false;
    return true;
  }

  function isDayInRange(year: number, month0: number, day: number): boolean {
    const d = new Date(year, month0, day);
    if (min && d < min) return false;
    if (max && d > max) return false;
    return true;
  }

  function pickDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    onSelect(toIso(d));
  }

  function pickMonth(month0: number) {
    setViewMonth(month0);
    setMonthOpen(false);
  }

  function pickYear(year: number) {
    let newMonth = viewMonth;
    if (!isMonthInRange(year, newMonth)) {
      // Snap to the closest month inside range for that year.
      const firstValid = MONTHS_FULL.findIndex((_, i) => isMonthInRange(year, i));
      if (firstValid !== -1) newMonth = firstValid;
    }
    setViewYear(year);
    setViewMonth(newMonth);
    setYearOpen(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={styles.card}
          onPress={() => {
            // Tap inside card closes any open dropdown but keeps modal open.
            setMonthOpen(false);
            setYearOpen(false);
          }}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Header row — Month + Year selectors */}
          <View style={styles.headerRow}>
            <View style={styles.headerCell}>
              <TouchableOpacity
                style={[styles.selectField, monthOpen && styles.selectFieldFocused]}
                onPress={() => {
                  setMonthOpen(p => !p);
                  setYearOpen(false);
                }}
                activeOpacity={0.8}>
                <Text style={styles.selectText}>{MONTHS_FULL[viewMonth]}</Text>
                <ChevronDown />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCell}>
              <TouchableOpacity
                style={[styles.selectField, yearOpen && styles.selectFieldFocused]}
                onPress={() => {
                  setYearOpen(p => !p);
                  setMonthOpen(false);
                }}
                activeOpacity={0.8}>
                <Text style={styles.selectText}>{viewYear}</Text>
                <ChevronDown />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map(w => (
              <View key={w} style={styles.weekCell}>
                <Text style={styles.weekLabel}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Day grid — row-based to avoid % rounding dropping Saturday */}
          <View>
            {Array.from({ length: daysGrid.length / 7 }, (_, wi) => (
              <View key={wi} style={styles.gridRow}>
                {daysGrid.slice(wi * 7, wi * 7 + 7).map((d, di) => {
                  const idx = wi * 7 + di;
                  if (d === null) return <View key={`e-${idx}`} style={styles.dayCell} />;
                  const date = new Date(viewYear, viewMonth, d);
                  const inRange = isDayInRange(viewYear, viewMonth, d);
                  const isToday = isSameDay(date, today);
                  const isSelected = selected ? isSameDay(date, selected) : false;
                  return (
                    <TouchableOpacity
                      key={`d-${d}`}
                      style={styles.dayCell}
                      onPress={() => inRange && pickDay(d)}
                      activeOpacity={inRange ? 0.6 : 1}
                      disabled={!inRange}>
                      <View
                        style={[
                          styles.dayPill,
                          isToday && !isSelected && styles.dayPillToday,
                          isSelected && styles.dayPillSelected,
                        ]}>
                        <Text
                          style={[
                            styles.dayText,
                            !inRange && styles.dayTextDisabled,
                            isToday && !isSelected && styles.dayTextToday,
                            isSelected && styles.dayTextSelected,
                          ]}>
                          {d}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const d = new Date();
                if ((!min || d >= min) && (!max || d <= max)) onSelect(toIso(startOfDay(d)));
              }}
              activeOpacity={0.7}
              style={styles.todayBtn}
              disabled={!!(min && today < min) || !!(max && today > max)}>
              <Text
                style={[
                  styles.todayText,
                  ((min && today < min) || (max && today > max)) && { color: C.textMute },
                ]}>
                Today
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Month dropdown overlay ── */}
          {monthOpen && (
            <View style={[styles.dropdown, styles.dropdownMonth]} pointerEvents="auto">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}>
                {MONTHS_FULL.map((m, i) => {
                  const enabled = isMonthInRange(viewYear, i);
                  const active = i === viewMonth;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => enabled && pickMonth(i)}
                      activeOpacity={enabled ? 0.6 : 1}
                      disabled={!enabled}
                      style={[
                        styles.dropdownItem,
                        active && styles.dropdownItemActive,
                      ]}>
                      <Text
                        style={[
                          styles.dropdownText,
                          active && styles.dropdownTextActive,
                          !enabled && styles.dropdownTextDisabled,
                        ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Year dropdown overlay ── */}
          {yearOpen && (
            <View style={[styles.dropdown, styles.dropdownYear]} pointerEvents="auto">
              <FlatList
                data={yearOptions}
                keyExtractor={y => String(y)}
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
                initialScrollIndex={Math.max(
                  0,
                  Math.min(
                    yearOptions.indexOf(viewYear),
                    Math.max(0, yearOptions.length - 4),
                  ),
                )}
                contentContainerStyle={{ paddingVertical: 4 }}
                renderItem={({ item }) => {
                  const active = item === viewYear;
                  return (
                    <TouchableOpacity
                      onPress={() => pickYear(item)}
                      activeOpacity={0.6}
                      style={[
                        styles.dropdownItem,
                        active && styles.dropdownItemActive,
                      ]}>
                      <Text
                        style={[
                          styles.dropdownText,
                          active && styles.dropdownTextActive,
                        ]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const CARD_PAD_H = 18;
const CELL_SIZE = 36;
const PILL_SIZE = 32;

const styles = StyleSheet.create({
  // Trigger field
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  triggerError: {
    borderColor: C.error,
  },
  triggerDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.6,
  },
  triggerText: {
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  triggerPlaceholder: {
    color: C.textMute,
  },
  errorText: {
    fontSize: 12,
    color: C.error,
    marginTop: 4,
    fontWeight: '500',
  },

  // Modal & card
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: CARD_PAD_H,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
    marginBottom: 12,
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  headerCell: {
    flex: 1,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  selectFieldFocused: {
    borderColor: C.borderFocus,
  },
  selectText: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },

  // Weekdays
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Day grid
  gridRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    height: CELL_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPill: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillToday: {
    backgroundColor: C.primarySoft,
  },
  dayPillSelected: {
    backgroundColor: C.primarySolid,
  },
  dayText: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },
  dayTextDisabled: {
    color: '#cbd5e1',
    fontWeight: '400',
  },
  dayTextToday: {
    color: '#065f5b',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  todayText: {
    color: C.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Dropdowns (overlay over the grid)
  dropdown: {
    position: 'absolute',
    top: 88,                         // sits just under the header row (title 32 + field 40 + small gap)
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    maxHeight: 260,
    overflow: 'hidden',
    zIndex: 50,
  },
  dropdownMonth: {
    left: CARD_PAD_H,
    right: '50%',
    marginRight: 5,                  // matches the gap between header cells (10/2)
  },
  dropdownYear: {
    left: '50%',
    right: CARD_PAD_H,
    marginLeft: 5,
  },
  dropdownItem: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dropdownItemActive: {
    backgroundColor: C.rowSelectedBg,
  },
  dropdownText: {
    fontSize: 14,
    color: C.text,
  },
  dropdownTextActive: {
    color: C.text,
    fontWeight: '600',
  },
  dropdownTextDisabled: {
    color: '#cbd5e1',
  },
});
