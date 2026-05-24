import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import { FaqAccordionList } from '../../components/common/FaqAccordion';
import colors from '../../theme/colors';
import { GATHERGO_FAQS } from '../../content/faqs';

export default function FaqScreen({ navigation }: { navigation: any }) {
  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.logoBtn}>
            <Logo size="small" />
          </TouchableOpacity>
          <Text style={styles.title}>FAQ</Text>
          <Text style={styles.subtitle}>Common questions about GatherrGo</Text>

          <FaqAccordionList items={GATHERGO_FAQS} />
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  logoBtn: { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },
});
