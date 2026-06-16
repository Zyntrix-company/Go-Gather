import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

type GalleryTravelersVisibilityToggleProps = {
  hidden: boolean;
  onToggle: () => void;
  saving?: boolean;
};

export default function GalleryTravelersVisibilityToggle({
  hidden,
  onToggle,
  saving = false,
}: GalleryTravelersVisibilityToggleProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <Text style={styles.label}>Travelers on your gallery</Text>
        <Text style={styles.hint}>
          {hidden ? 'Hidden from friends viewing this album' : 'Visible to friends viewing this album'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        style={[styles.btn, hidden && styles.btnHidden]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        disabled={saving}
        accessibilityLabel={hidden ? 'Show travelers on your gallery' : 'Hide travelers on your gallery'}
      >
        {saving
          ? <ActivityIndicator size="small" color={hidden ? '#64748b' : '#0d9488'} />
          : hidden
            ? <EyeOff size={18} color="#64748b" />
            : <Eye size={18} color="#0d9488" />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  textCol: { flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHidden: {
    backgroundColor: '#f1f5f9',
  },
});
