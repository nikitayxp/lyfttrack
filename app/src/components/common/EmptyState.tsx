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
        <TouchableOpacity style={[styles.actionButton, actionButtonStyle]} activeOpacity={0.88} onPress={onActionPress}>
          <Text style={[styles.actionLabel, actionLabelStyle]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
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
    marginTop: 14,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
