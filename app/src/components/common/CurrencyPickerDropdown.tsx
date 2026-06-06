import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { CurrencyDef } from '../../utils/currency';
import { filterCurrencies } from '../../utils/currency';

type Props = {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  /** Optional styles merged onto the outer container (e.g. screen dropdown). */
  style?: object;
  itemStyle?: object;
};

function CurrencyRow({
  item,
  selected,
  itemStyle,
  onPress,
}: {
  item: CurrencyDef;
  selected: boolean;
  itemStyle?: object;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.item, itemStyle, selected && styles.itemSelected]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
        {item.symbol} {item.code} — {item.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function CurrencyPickerDropdown({
  visible,
  selectedCode,
  onSelect,
  style,
  itemStyle,
}: Props) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const { popular, others } = filterCurrencies(query);
    const result: { title: string; data: CurrencyDef[] }[] = [];
    if (popular.length > 0) result.push({ title: 'Popular', data: popular });
    if (others.length > 0) result.push({ title: 'All currencies', data: others });
    return result;
  }, [query]);

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.search}
        placeholder="Search currency..."
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <ScrollView
        style={styles.list}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        {sections.length === 0 ? (
          <Text style={styles.empty}>No currencies match your search</Text>
        ) : (
          sections.map(section => (
            <View key={section.title}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              {section.data.map(item => (
                <CurrencyRow
                  key={item.code}
                  item={item}
                  selected={item.code === selectedCode}
                  itemStyle={itemStyle}
                  onPress={() => {
                    onSelect(item.code);
                    setQuery('');
                  }}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  search: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  list: {
    maxHeight: 220,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#f8fafc',
  },
  item: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemSelected: {
    backgroundColor: '#f0fdfa',
  },
  itemText: {
    fontSize: 13,
    color: '#0f172a',
  },
  itemTextSelected: {
    color: '#0d9488',
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
