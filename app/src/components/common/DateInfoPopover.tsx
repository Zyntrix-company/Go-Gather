/**
 * DateInfoPopover — small popup dialog for date validation info
 * Dynamically positioned based on the clicked info icon location
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

interface DateInfoPopoverProps {
  visible: boolean;
  onClose: () => void;
  iconX?: number;
  iconY?: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POPOVER_WIDTH = 260;
const POPOVER_HEIGHT = 85;
const ARROW_SIZE = 10;
const ARROW_OFFSET = 15; // Distance below icon

export default function DateInfoPopover({ visible, onClose, iconX = SCREEN_W / 2, iconY = 100 }: DateInfoPopoverProps) {
  const [popoverPos, setPopoverPos] = useState({ top: iconY + ARROW_OFFSET, left: SCREEN_W / 2 - POPOVER_WIDTH / 2 });
  const [arrowPos, setArrowPos] = useState(POPOVER_WIDTH / 2);
  const [showAbove, setShowAbove] = useState(false);

  useEffect(() => {
    if (!visible || iconX === 0) return;

    // Calculate position below icon (default)
    let calculatedTop = iconY + ARROW_OFFSET;
    let showBelow = true;

    // Check if there's enough space below
    if (calculatedTop + POPOVER_HEIGHT > SCREEN_H - 50) {
      calculatedTop = iconY - POPOVER_HEIGHT - ARROW_OFFSET;
      showBelow = false;
    }

    // Calculate left position (center on icon)
    let calculatedLeft = iconX - POPOVER_WIDTH / 2;

    // Adjust if goes off-screen horizontally
    if (calculatedLeft < 12) {
      calculatedLeft = 12;
    } else if (calculatedLeft + POPOVER_WIDTH > SCREEN_W - 12) {
      calculatedLeft = SCREEN_W - POPOVER_WIDTH - 12;
    }

    // Calculate arrow position (always points to icon)
    const arrowPosition = iconX - calculatedLeft;

    setPopoverPos({ top: calculatedTop, left: calculatedLeft });
    setArrowPos(arrowPosition);
    setShowAbove(!showBelow);
  }, [visible, iconX, iconY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View
          style={[
            styles.popover,
            {
              top: popoverPos.top,
              left: popoverPos.left,
            },
          ]}
        >
          <View
            style={[
              showAbove ? styles.arrowTop : styles.arrowBottom,
              { left: Math.max(12, Math.min(POPOVER_WIDTH - ARROW_SIZE - 8, arrowPos - ARROW_SIZE / 2)) },
            ]}
          />
          <View style={styles.content}>
            <Text style={styles.text}>You can only select dates within 365 days from today.</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 14,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    zIndex: 100,
  },
  arrowBottom: {
    position: 'absolute',
    top: -ARROW_SIZE,
    width: ARROW_SIZE * 2,
    height: ARROW_SIZE * 2,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: '#e0e7ff',
    borderLeftColor: '#e0e7ff',
    transform: [{ rotate: '45deg' }],
  },
  arrowTop: {
    position: 'absolute',
    bottom: -ARROW_SIZE,
    width: ARROW_SIZE * 2,
    height: ARROW_SIZE * 2,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: '#e0e7ff',
    borderRightColor: '#e0e7ff',
    transform: [{ rotate: '45deg' }],
  },
  content: {
    paddingRight: 24,
  },
  text: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
    fontWeight: '500',
  },
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  closeBtnText: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '300',
    lineHeight: 20,
  },
});
