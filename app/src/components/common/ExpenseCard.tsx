import React, { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MoreVertical, Pen, Trash2 } from 'lucide-react-native';
import CachedImage from './CachedImage';

type BalanceLabel = { text: string; color: string } | null;

type Props = {
  description: string;
  paidByName: string;
  paidByAvatarUrl?: string | null;
  date: string;
  splitLine?: string;
  amountLabel: string;
  balanceLabel?: BalanceLabel;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ExpenseCard({
  description,
  paidByName,
  paidByAvatarUrl,
  date,
  splitLine,
  amountLabel,
  balanceLabel,
  onEdit,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setAnchor({ top: y + height + 4, right: screenWidth - (x + width) });
      setMenuOpen(true);
    });
  };

  const initial = paidByName ? paidByName[0].toUpperCase() : '?';
  const metaLine = [date, splitLine].filter(Boolean).join('  ·  ');

  return (
    <View style={styles.row}>
      <View style={styles.avatarBox}>
        {paidByAvatarUrl ? (
          <CachedImage uri={paidByAvatarUrl} style={styles.avatarImg} resizeMode="cover" priority="normal" />
        ) : (
          <Text style={styles.avatarInitial}>{initial}</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>{description}</Text>
          <View style={styles.amtRow}>
            <Text style={styles.amt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {amountLabel}
            </Text>
            <TouchableOpacity
              ref={menuBtnRef}
              style={styles.menuBtn}
              onPress={openMenu}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={16} color="#64748b" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.bottomLine}>
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">{metaLine}</Text>
          {balanceLabel && (
            <Text style={[styles.balanceText, { color: balanceLabel.color }]} numberOfLines={1}>
              {balanceLabel.text}
            </Text>
          )}
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.sheet,
              anchor ? { top: anchor.top, right: anchor.right } : { bottom: '40%', right: 16 },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.8}
              onPress={() => { setMenuOpen(false); onEdit(); }}
            >
              <Pen size={14} color="#64748b" strokeWidth={2} />
              <Text style={styles.menuText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemBorder]}
              activeOpacity={0.8}
              onPress={() => { setMenuOpen(false); onDelete(); }}
            >
              <Trash2 size={14} color="#ef4444" strokeWidth={2} />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0fdf9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d9488',
  },
  body: {
    flex: 1,
    marginLeft: 10,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  name: { fontSize: 14, fontWeight: '400', color: '#0d9488', flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: '#94a3b8', flex: 1, marginRight: 8 },
  amtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  amt: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  menuBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: {
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 140,
    flexShrink: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    width: 148,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  menuTextDanger: {
    color: '#ef4444',
  },
});
