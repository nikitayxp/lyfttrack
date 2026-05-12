import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

const palette = Colors.dark;

type IconName = ComponentProps<typeof Ionicons>['name'];

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
  actionButtonStyle?: StyleProp<ViewStyle>;
  actionLabelStyle?: StyleProp<TextStyle>;
};

export function EmptyState({
  icon = 'trophy-outline',
  title,
  description,
  actionLabel,
  onActionPress,
  containerStyle,
  titleStyle,
  descriptionStyle,
  actionButtonStyle,
  actionLabelStyle,
}: EmptyStateProps) {
  const shouldRenderAction = Boolean(actionLabel && onActionPress);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={palette.accent} />
      </View>

      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <Text style={[styles.description, descriptionStyle]}>{description}</Text>

      {shouldRenderAction ? (
        <TouchableOpacity style={[styles.actionButton, actionButtonStyle]} activeOpacity={ACTIVE_OPACITY} onPress={onActionPress}>
          <Text style={[styles.actionLabel, actionLabelStyle]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 12,
    minHeight: 34,
    borderRadius: Radius.xs,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionLabel: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
