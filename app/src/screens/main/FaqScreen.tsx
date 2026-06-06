import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import { FaqAccordionList } from '../../components/common/FaqAccordion';
import colors from '../../theme/colors';
import { GATHERGO_FAQS } from '../../content/faqs';

export default function FaqScreen({ navigation }: { navigation: any }) {
  return (
    <AppScreenLayout navigation={navigation}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>FAQ</Text>
        <Text style={styles.subtitle}>Common questions about GatherrGo</Text>

        <FaqAccordionList items={GATHERGO_FAQS} />
      </ScrollView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },
});
