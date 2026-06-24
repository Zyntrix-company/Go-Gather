import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MoreVertical, Pen, Trash2 } from 'lucide-react-native';
import colors from '../../theme/colors';

type UploadedBy = string | { userId: string; name: string | null; avatarUrl: string | null };

export type DocItemData = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  createdAt?: string;
  uploadedBy: UploadedBy;
};

type Props = {
  doc: DocItemData;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const FALLBACK_COLORS = ['#0d9488', '#0891b2', '#7c3aed', '#db2777', '#f97316'];

function colorFor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return FALLBACK_COLORS[n % FALLBACK_COLORS.length];
}

function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

function mimeLabel(mimeType?: string) {
  if (!mimeType) return 'FILE';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'DOCX';
  if (mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return 'XLSX';
  if (mimeType.includes('presentationml') || mimeType === 'application/vnd.ms-powerpoint') return 'PPTX';
  if (mimeType === 'text/plain') return 'TXT';
  if (mimeType === 'text/csv') return 'CSV';
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  return 'FILE';
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('default', { day: 'numeric', month: 'short' });
}

export default function DocumentItem({ doc, canEdit, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const uploader = typeof doc.uploadedBy === 'object' ? doc.uploadedBy : null;
  const uploaderName = uploader?.name ?? null;
  const uploaderAvatar = uploader?.avatarUrl ?? null;

  const bg = colorFor(uploaderName ?? doc.id);
  const initText = initials(uploaderName);

  const metaParts = [
    formatDate(doc.createdAt),
    mimeLabel(doc.mimeType),
    formatSize(doc.fileSizeBytes),
  ].filter(Boolean);

  return (
    <View style={styles.row}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        {uploaderAvatar ? (
          <Image source={{ uri: uploaderAvatar }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{initText}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.fileName} numberOfLines={1}>{doc.fileName}</Text>
        {metaParts.length > 0 && (
          <Text style={styles.meta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
        )}
      </View>

      {/* Three-dot button */}
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => setMenuOpen(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MoreVertical size={16} color="#64748b" strokeWidth={1.8} />
      </TouchableOpacity>

      {/* Dropdown menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            {canEdit && (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.8}
                onPress={() => { setMenuOpen(false); onEdit(); }}
              >
                <Pen size={14} color="#64748b" strokeWidth={2} />
                <Text style={styles.menuText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.menuItem, canEdit && styles.menuItemBorder]}
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
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  meta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    bottom: '40%',
    right: 16,
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
