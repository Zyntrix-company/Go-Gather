import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LocationAutocomplete from './LocationAutocomplete';
import type { LocationPoint } from '../../utils/locations';
import { MAX_LOCATIONS } from '../../utils/locations';

interface Props {
  value: LocationPoint[];
  onChange: (locations: LocationPoint[]) => void;
  maxLocations?: number;
  placeholder?: string;
  variant?: 'create' | 'edit';
}

export default function LocationMultiPicker({
  value,
  onChange,
  maxLocations = MAX_LOCATIONS,
  placeholder = 'Search and add location...',
  variant = 'create',
}: Props) {
  const [draft, setDraft] = useState('');
  const [pickerKey, setPickerKey] = useState(0);

  const addLocation = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.length >= maxLocations) return;
    if (value.some((loc) => loc.name.toLowerCase() === trimmed.toLowerCase())) return;

    onChange([
      ...value,
      { name: trimmed, sortOrder: value.length },
    ]);
    setDraft('');
    setPickerKey((k) => k + 1);
  }, [maxLocations, onChange, value]);

  const removeLocation = (index: number) => {
    onChange(
      value
        .filter((_, i) => i !== index)
        .map((loc, i) => ({ ...loc, sortOrder: i })),
    );
  };

  const atMax = value.length >= maxLocations;

  return (
    <View style={styles.root}>
      {value.length > 0 && (
        <View style={styles.chips}>
          {value.map((loc, index) => (
            <View key={`${loc.id ?? loc.name}-${index}`} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{loc.name}</Text>
              <TouchableOpacity
                onPress={() => removeLocation(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Remove ${loc.name}`}
                activeOpacity={0.7}
              >
                <Text style={styles.chipRemove}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {!atMax ? (
        <LocationAutocomplete
          key={pickerKey}
          initialValue={draft}
          onChangeText={setDraft}
          onSelect={addLocation}
          placeholder={placeholder}
          variant={variant}
        />
      ) : (
        <Text style={styles.maxHint}>Maximum {maxLocations} locations reached</Text>
      )}

      {value.length === 0 && !atMax ? (
        <Text style={styles.hint}>Add at least one destination</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    color: '#0f766e',
    maxWidth: 220,
  },
  chipRemove: {
    fontSize: 16,
    lineHeight: 18,
    color: '#ef4444',
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  maxHint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
