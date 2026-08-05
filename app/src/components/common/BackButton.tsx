import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { goBack } from '@/utils/navigation';

const palette = Colors.dark;

type BackButtonProps = {
  /**
   * Where to land when there is no history to pop — opening a screen from a
   * link or a refresh on web leaves nothing behind, and router.back() is then a
   * silent no-op that reads as a dead button.
   */
  fallback?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ fallback = '/(tabs)', onPress, style }: BackButtonProps) {
  const { t } = useTranslation();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    goBack(fallback);
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={ACTIVE_OPACITY}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Ionicons name="arrow-back" size={21} color={palette.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
