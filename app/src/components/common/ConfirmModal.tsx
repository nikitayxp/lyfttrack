import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

const palette = Colors.dark;

export type ConfirmModalTone = 'danger' | 'primary' | 'warning';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string | null;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  tone?: ConfirmModalTone;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Polished confirmation modal used in place of native Alert.alert when we
 * want the prompt to match the rest of the LyftTrack UI (same palette,
 * typography and animated backdrop).
 */
export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  tone = 'danger',
  icon,
}: ConfirmModalProps) {
  const toneStyles = useMemo(() => {
    switch (tone) {
      case 'primary':
        return {
          iconColor: palette.accent,
          iconBg: 'rgba(59,130,246,0.14)',
          confirmBg: palette.accent,
          confirmText: palette.textPrimary,
        };
      case 'warning':
        return {
          iconColor: palette.warning,
          iconBg: 'rgba(251,191,36,0.14)',
          confirmBg: palette.warning,
          confirmText: palette.chipModeInactiveBg,
        };
      default:
        return {
          iconColor: palette.errorText,
          iconBg: 'rgba(248,113,113,0.14)',
          confirmBg: palette.error,
          confirmText: palette.textPrimary,
        };
    }
  }, [tone]);

  const resolvedIcon: keyof typeof Ionicons.glyphMap =
    icon ?? (tone === 'danger' ? 'warning-outline' : tone === 'warning' ? 'alert-circle-outline' : 'help-circle-outline');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: toneStyles.iconBg }]}>
            <Ionicons name={resolvedIcon} size={26} color={toneStyles.iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>

          {description ? <Text style={styles.description}>{description}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, busy && styles.buttonDisabled]}
              activeOpacity={ACTIVE_OPACITY}
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: toneStyles.confirmBg },
                busy && styles.buttonDisabled,
              ]}
              activeOpacity={ACTIVE_OPACITY}
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              {busy ? (
                <ActivityIndicator size="small" color={toneStyles.confirmText} />
              ) : (
                <Text style={[styles.confirmText, { color: toneStyles.confirmText }]}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 9, 20, 0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.surface,
    borderRadius: Radius.sheet,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: palette.textPrimary,
    textAlign: 'center',
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
