import { requestConfirmation } from '@/context/ConfirmContext';

type ConfirmActionOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/**
 * Same in-app modal on every screen and every platform now — no more
 * window.confirm() standing in on web.
 */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return requestConfirmation({
    title: options.title,
    description: options.description,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
    tone: options.destructive ? 'danger' : 'primary',
  });
}
