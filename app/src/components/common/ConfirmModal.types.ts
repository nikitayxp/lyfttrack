import type { Ionicons } from '@expo/vector-icons';

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
