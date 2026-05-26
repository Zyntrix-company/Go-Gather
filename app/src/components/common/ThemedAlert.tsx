import React, { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  BackHandler,
  Easing,
} from 'react-native';
import colors from '../../theme/colors';
import useAlertStore, { AlertButton } from '../../store/alertStore';

const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.48)';
const DESTRUCTIVE_BG = 'rgba(239, 68, 68, 0.07)';
const DESTRUCTIVE_BORDER = 'rgba(239, 68, 68, 0.18)';

const ENTER_DURATION = 240;
const EXIT_DURATION = 180;

export default function ThemedAlert() {
  const { visible, config, hide } = useAlertStore();
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);

  const dismissAnimated = useCallback(
    (after?: () => void) => {
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: EXIT_DURATION,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: EXIT_DURATION - 20,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: EXIT_DURATION + 40,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        scaleAnim.setValue(0.94);
        opacityAnim.setValue(0);
        overlayAnim.setValue(0);
        dismissingRef.current = false;
        after?.();
      });
    },
    [scaleAnim, opacityAnim, overlayAnim],
  );

  useEffect(() => {
    if (!visible || !config) return;
    scaleAnim.setValue(0.94);
    opacityAnim.setValue(0);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 24,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ENTER_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: ENTER_DURATION + 30,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, config, scaleAnim, opacityAnim, overlayAnim]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const hasCancel = config?.buttons?.some((b) => b.style === 'cancel');
      if (hasCancel || !config?.buttons?.length) {
        dismissAnimated(() => {
          hide();
          const cancel = config?.buttons?.find((b) => b.style === 'cancel');
          cancel?.onPress?.();
        });
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, [visible, config, hide, dismissAnimated]);

  if (!config) return null;

  const buttons: AlertButton[] =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: 'OK', style: 'default' }];

  const hasCancelButton = buttons.some((b) => b.style === 'cancel');
  const isRow = buttons.length === 2;

  function handleButton(btn: AlertButton) {
    dismissAnimated(() => {
      hide();
      btn.onPress?.();
    });
  }

  function handleOverlayPress() {
    if (hasCancelButton || buttons.length === 1) {
      const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
      dismissAnimated(() => {
        hide();
        cancel.onPress?.();
      });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (hasCancelButton || !config.buttons?.length) {
          dismissAnimated(() => {
            hide();
            const cancel = config.buttons?.find((b) => b.style === 'cancel');
            cancel?.onPress?.();
          });
        }
      }}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleOverlayPress} />
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{config.title}</Text>
            {!!config.message && (
              <Text style={styles.message}>{config.message}</Text>
            )}
          </View>

          <View style={[styles.actions, isRow ? styles.actionsRow : styles.actionsStack]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isDefault = btn.style === 'default' || (!isCancel && !isDestructive);

              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.btn,
                    isRow && styles.btnRow,
                    isRow && i > 0 && styles.btnRowDivider,
                    !isRow && styles.btnStack,
                    !isRow && isCancel && styles.btnStackCancel,
                    !isRow && isDestructive && styles.btnStackDestructive,
                    !isRow && isDefault && styles.btnStackDefault,
                    pressed && (isRow ? styles.btnRowPressed : styles.btnStackPressed),
                  ]}
                  onPress={() => handleButton(btn)}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isRow && isCancel && styles.btnTextRowCancel,
                      isRow && isDestructive && styles.btnTextRowDestructive,
                      isRow && isDefault && styles.btnTextRowDefault,
                      !isRow && isCancel && styles.btnTextStackCancel,
                      !isRow && isDestructive && styles.btnTextStackDestructive,
                      !isRow && isDefault && styles.btnTextStackDefault,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  content: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  actions: {
    marginTop: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionsStack: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flex: 1,
    paddingVertical: 14,
  },
  btnRowDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  btnRowPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  btnStack: {
    borderRadius: 12,
    paddingVertical: 13,
  },
  btnStackCancel: {
    backgroundColor: colors.surfaceSecondary,
  },
  btnStackDestructive: {
    backgroundColor: DESTRUCTIVE_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESTRUCTIVE_BORDER,
  },
  btnStackDefault: {
    backgroundColor: colors.accent,
  },
  btnStackPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  btnTextRowCancel: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  btnTextRowDestructive: {
    color: colors.error,
  },
  btnTextRowDefault: {
    color: colors.accent,
  },
  btnTextStackCancel: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  btnTextStackDestructive: {
    color: colors.error,
  },
  btnTextStackDefault: {
    color: colors.accentForeground,
  },
});
