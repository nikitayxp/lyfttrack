import { useConfirmDialog } from '@/context/ConfirmContext';
import { ConfirmModal } from './ConfirmModal';

export function ConfirmHost() {
  const { pending, settlePending } = useConfirmDialog();

  return (
    <ConfirmModal
      visible={pending !== null}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel ?? ''}
      cancelLabel={pending?.cancelLabel ?? ''}
      tone={pending?.tone}
      icon={pending?.icon}
      onConfirm={() => settlePending(true)}
      onCancel={() => settlePending(false)}
    />
  );
}
