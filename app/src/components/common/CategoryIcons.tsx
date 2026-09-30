import React from 'react';
import { View, Text, type TextStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Package,
  UtensilsCrossed,
  Car,
  Hotel,
  Clapperboard,
  ShoppingBag,
  Globe,
  FileText,
  Lightbulb,
  AlertTriangle,
  CheckSquare,
} from 'lucide-react-native';

export type ExpenseCategorySlug =
  | 'general'
  | 'food'
  | 'transportation'
  | 'accommodation'
  | 'entertainment'
  | 'shopping'
  | 'other';

export type NoteCategoryKey = 'general' | 'idea' | 'important' | 'todo';

export type ExpenseCategoryDef = {
  label: string;
  slug: ExpenseCategorySlug;
  Icon: LucideIcon;
  color: string;
};

export type NoteCategoryDef = {
  key: NoteCategoryKey;
  label: string;
  Icon: LucideIcon;
  color: string;
};

export const EXPENSE_CATS: ExpenseCategoryDef[] = [
  { label: 'General', slug: 'general', Icon: Package, color: '#19A69C' },
  { label: 'Food & Dining', slug: 'food', Icon: UtensilsCrossed, color: '#E8B84A' },
  { label: 'Transport', slug: 'transportation', Icon: Car, color: '#4A90C2' },
  { label: 'Stay', slug: 'accommodation', Icon: Hotel, color: '#D96C68' },
  { label: 'Entertainment', slug: 'entertainment', Icon: Clapperboard, color: '#8B72C1' },
  { label: 'Shopping', slug: 'shopping', Icon: ShoppingBag, color: '#ca8a04' },
  { label: 'Other', slug: 'other', Icon: Globe, color: '#64748b' },
];

export const EXPENSE_CAT_SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATS.map(c => [c.slug, c.label]),
);

export const NOTE_CATS: NoteCategoryDef[] = [
  { key: 'general', label: 'General', Icon: FileText, color: '#0d9488' },
  { key: 'idea', label: 'Idea', Icon: Lightbulb, color: '#ca8a04' },
  { key: 'important', label: 'Important', Icon: AlertTriangle, color: '#dc2626' },
  { key: 'todo', label: 'To-Do', Icon: CheckSquare, color: '#2563eb' },
];

export function resolveExpenseCategory(category: string): ExpenseCategoryDef {
  const raw = (category || 'general').trim();
  const slug = raw.toLowerCase();
  const bySlug = EXPENSE_CATS.find(c => c.slug === slug);
  if (bySlug) return bySlug;
  return EXPENSE_CATS.find(c => c.label === raw) ?? EXPENSE_CATS[0];
}

export function resolveNoteCategory(categoryKey: string): NoteCategoryDef {
  return NOTE_CATS.find(c => c.key === categoryKey) ?? NOTE_CATS[0];
}

export function ExpenseCategoryIcon({
  category,
  size = 18,
}: {
  category: string;
  size?: number;
}) {
  const { Icon, color } = resolveExpenseCategory(category);
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export function NoteCategoryIcon({
  categoryKey,
  size = 18,
}: {
  categoryKey: string;
  size?: number;
}) {
  const { Icon, color } = resolveNoteCategory(categoryKey);
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export function ExpenseCatRow({
  cat,
  size = 16,
  textStyle,
  fontSize = 13,
}: {
  cat: ExpenseCategoryDef;
  size?: number;
  textStyle?: TextStyle;
  fontSize?: number;
}) {
  const { Icon, color, label } = cat;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon size={size} color={color} strokeWidth={2} />
      <Text style={[{ fontSize, color: '#0f172a' }, textStyle]}>{label}</Text>
    </View>
  );
}

export function NoteCatRow({
  cat,
  size = 16,
  textStyle,
  fontSize = 13,
}: {
  cat: NoteCategoryDef;
  size?: number;
  textStyle?: TextStyle;
  fontSize?: number;
}) {
  const { Icon, color, label } = cat;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon size={size} color={color} strokeWidth={2} />
      <Text style={[{ fontSize, color: '#0f172a' }, textStyle]}>{label}</Text>
    </View>
  );
}
