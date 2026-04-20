import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  BackHandler,
} from 'react-native';
import colors from '../../theme/colors';
import useAlertStore, { AlertButton } from '../../store/alertStore';

export default function ThemedAlert() {
  const { visible, config, hide } = useAlertStore();
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 180,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const hasCancel = config?.buttons?.some((b) => b.style === 'cancel');
      if (hasCancel || !config?.buttons?.length) {
        hide();
        return true;
      }
      return true; // block back on destructive-only dialogs
    });
    return () => sub.remove();
  }, [visible, config]);

  if (!config) return null;

  const buttons: AlertButton[] =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: 'OK', style: 'default' }];

  const hasCancelButton = buttons.some((b) => b.style === 'cancel');

  function handleButton(btn: AlertButton) {
    hide();
    btn.onPress?.();
  }

  function handleOverlayPress() {
    if (hasCancelButton || buttons.length === 1) {
      const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
      hide();
      cancel.onPress?.();
    }
  }

  const isRow = buttons.length === 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (hasCancelButton || !config.buttons?.length) hide();
      }}
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
          // Prevent overlay tap from firing when tapping the card
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>{config.title}</Text>
          {!!config.message && (
            <Text style={styles.message}>{config.message}</Text>
          )}

          <View style={[styles.buttonRow, !isRow && styles.buttonStack]}>
            {buttons.map((btn, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.btn,
                  isRow && styles.btnRowItem,
                  !isRow && styles.btnStackItem,
                  btn.style === 'cancel' && styles.btnCancel,
                  btn.style === 'destructive' && styles.btnDestructive,
                  btn.style === 'default' && styles.btnConfirm,
                  pressed && styles.btnPressed,
                  isRow && i === 0 && styles.btnRowFirst,
                  isRow && i === buttons.length - 1 && styles.btnRowLast,
                ]}
                onPress={() => handleButton(btn)}
                accessibilityRole="button"
                accessibilityLabel={btn.text}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'cancel' && styles.btnTextCancel,
                    btn.style === 'destructive' && styles.btnTextDestructive,
                    btn.style === 'default' && styles.btnTextConfirm,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,2,19,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 0,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  buttonStack: {
    flexDirection: 'column',
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
    borderTopWidth: 0,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  btnRowItem: {
    flex: 1,
  },
  btnRowFirst: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  btnRowLast: {},
  btnStackItem: {
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnCancel: {
    backgroundColor: 'transparent',
  },
  btnDestructive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnConfirm: {
    backgroundColor: colors.accent,
  },
  btnPressed: {
    opacity: 0.72,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  btnTextCancel: {
    color: colors.textSecondary,
  },
  btnTextDestructive: {
    color: colors.error,
  },
  btnTextConfirm: {
    color: colors.accentForeground,
  },
});
