/**
 * DetailSection — labelled section wrapper with optional inline edit button.
 * Used for Description, Highlights, and any other content block in detail screens.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import colors from '../../theme/colors';

interface DetailSectionProps {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function DetailSection({
  title,
  onEdit,
  children,
  style,
}: DetailSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
            <PencilIcon />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
