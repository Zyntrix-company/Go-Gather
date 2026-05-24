import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import colors from '../../theme/colors';

type FaqAccordionProps = {
  q: string;
  a: string;
};

export function FaqAccordion({ q, a }: FaqAccordionProps) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen(v => !v)}
      style={[styles.item, open && styles.itemOpen]}>
      <View style={styles.row}>
        <Text style={styles.question}>{q}</Text>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M6 9l6 6 6-6" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
      {open ? <Text style={styles.answer}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export function FaqAccordionList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <View style={styles.list}>
      {items.map(item => (
        <FaqAccordion key={item.q} q={item.q} a={item.a} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
  },
  item: {
    borderRadius: 12,
    paddingRight: 4,
    paddingVertical: 10,
  },
  itemOpen: {
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  question: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  chevron: {
    width: 18,
    alignItems: 'center',
    paddingTop: 2,
    opacity: 1,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  answer: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
    paddingLeft: 14,
    paddingRight: 4,
  },
});
