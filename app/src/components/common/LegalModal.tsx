import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { fetchLegalDocument, type LegalDocumentResponse } from '../../api/legal.api';

type LegalType = 'terms' | 'privacy';

interface Props {
  visible: boolean;
  type: LegalType;
  onClose: () => void;
}

function formatEffective(iso: string | undefined) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `Effective: ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  } catch {
    return '';
  }
}

const WEB_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 20px 18px 32px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px; color: #334155; line-height: 1.65; background: #f8fafc;
  }
  h1 {
    font-size: 20px; font-weight: 700; color: #0f172a;
    margin: 0 0 4px 0; padding-bottom: 10px;
    border-bottom: 2px solid #0d9488;
  }
  h2 {
    font-size: 15px; font-weight: 700; color: #0d9488;
    margin: 22px 0 8px 0; text-transform: uppercase; letter-spacing: 0.4px;
  }
  h3, h4 { font-size: 14px; font-weight: 600; color: #1e293b; margin: 14px 0 6px 0; }
  p { margin: 0 0 10px 0; }
  p:last-child { margin-bottom: 0; }
  a { color: #0d9488; text-decoration: none; }
  ul, ol { padding-left: 20px; margin: 0 0 10px 0; }
  li { margin-bottom: 6px; }
  li:last-child { margin-bottom: 0; }
  strong { color: #1e293b; }
  em { color: #64748b; font-style: normal; font-size: 13px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
`;

export default function LegalModal({ visible, type, onClose }: Props) {
  const [doc, setDoc] = useState<LegalDocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchLegalDocument(type);
      setDoc(data);
    } catch (e: any) {
      setDoc(null);
      setErr(e?.message || 'Could not load document.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (visible) {
      load();
    } else {
      setDoc(null);
      setErr(null);
    }
  }, [visible, load]);

  const headerSub = doc
    ? `v${doc.version} · ${formatEffective(doc.effectiveAt)}`
    : loading
      ? 'Loading…'
      : '';

  const htmlDoc =
    doc &&
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>
     <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
     <style>${WEB_CSS}</style></head><body>${doc.contentHtml}</body></html>`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <View style={s.headerLeft} />
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>{doc?.title || title}</Text>
            <Text style={s.headerSub} numberOfLines={2}>
              {err || headerSub}
            </Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={s.headerDivider} />

        {loading && (
          <View style={s.centerFill}>
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        )}

        {!loading && err && (
          <View style={s.centerFill}>
            <Text style={s.errText}>{err}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && htmlDoc && (
          <WebView
            style={s.web}
            originWhitelist={['*']}
            source={{ html: htmlDoc }}
            nestedScrollEnabled
            setSupportMultipleWindows={false}
          />
        )}

        <View style={s.footer}>
          <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  headerLeft: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a', letterSpacing: 0.1 },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: { height: 1, backgroundColor: '#e2e8f0' },
  web: { flex: 1, backgroundColor: '#f8fafc' },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errText: { color: '#b91c1c', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  doneBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: 0.1 },
});
