/**
 * DocTypeIcon — expense-style colored rounded-square icon for a document,
 * chosen from the document's name/mime using lucide-react-native icons.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  FileText, Globe, Plane, ShieldCheck, Car, Syringe, CreditCard,
  Ticket, Image as ImageIcon, type LucideIcon,
} from 'lucide-react-native';

type DocLike = { fileName?: string; name?: string; mimeType?: string };

type DocStyle = { Icon: LucideIcon; bg: string; fg: string };

const STYLES: Record<string, DocStyle> = {
  passport:    { Icon: Globe,       bg: '#dcfce7', fg: '#16a34a' },
  visa:        { Icon: Plane,       bg: '#ede9fe', fg: '#7c3aed' },
  insurance:   { Icon: ShieldCheck, bg: '#dbeafe', fg: '#2563eb' },
  license:     { Icon: Car,         bg: '#fef3c7', fg: '#d97706' },
  vaccination: { Icon: Syringe,     bg: '#fee2e2', fg: '#ef4444' },
  card:        { Icon: CreditCard,  bg: '#d1fae5', fg: '#0d9488' },
  ticket:      { Icon: Ticket,      bg: '#e0e7ff', fg: '#4f46e5' },
  image:       { Icon: ImageIcon,   bg: '#f3e8ff', fg: '#9333ea' },
  default:     { Icon: FileText,    bg: '#eef2f6', fg: '#64748b' },
};

// Ordered keyword → style so the first match wins.
const KEYWORDS: { match: RegExp; key: keyof typeof STYLES }[] = [
  { match: /passport/i,                                key: 'passport' },
  { match: /visa/i,                                    key: 'visa' },
  { match: /insur/i,                                   key: 'insurance' },
  { match: /licen[cs]e|driving|dl\b|permit/i,          key: 'license' },
  { match: /vaccin|vaccine|covid|health|medical/i,     key: 'vaccination' },
  { match: /pan|aadhaar|aadhar|\bid\b|card|ssn/i,      key: 'card' },
  { match: /ticket|boarding|itinerary|flight/i,        key: 'ticket' },
];

export function docStyleFor(doc: DocLike): DocStyle {
  const name = doc.fileName ?? doc.name ?? '';
  for (const { match, key } of KEYWORDS) {
    if (match.test(name)) return STYLES[key];
  }
  if ((doc.mimeType ?? '').startsWith('image/')) return STYLES.image;
  return STYLES.default;
}

export default function DocTypeIcon({ doc, size = 44 }: { doc: DocLike; size?: number }) {
  const { Icon, bg, fg } = docStyleFor(doc);
  const glyph = Math.round(size * 0.5);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.27, backgroundColor: bg }]}>
      <Icon size={glyph} color={fg} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
