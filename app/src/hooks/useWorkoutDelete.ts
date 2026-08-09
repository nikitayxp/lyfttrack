import { useCallback, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppToast } from '@/context/ToastContext';
import { confirmAction } from '@/utils/confirmAction';
import { deleteWorkout, getErrorMessage } from '@/services/workoutService';

export const WORKOUT_DELETED_EVENT = 'lyfttrack:workout-deleted';

/**
 * Confirm, delete, and report. Lives in a hook because the menu that offers
 * deleting shows up on the workout screen and on every feed card, and the three
 * of them must not drift apart.
 */
export function useWorkoutDelete() {
  const { t } = useTranslation();
  const { showToast } = useAppToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = useCallback(async (): Promise<boolean> => {
    return confirmAction({
      title: t('workoutDetails.deleteConfirmTitle'),
      description: t('workoutDetails.deleteConfirmDescription'),
      confirmLabel: t('workoutDetails.deleteConfirmAction'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
  }, [t]);

  const confirmAndDelete = useCallback(
    async (workoutId: string): Promise<boolean> => {
      if (!workoutId || isDeleting) {
        return false;
      }

      const shouldDelete = await confirmDelete();

      if (!shouldDelete) {
        return false;
      }

      setIsDeleting(true);

      try {
        await deleteWorkout(workoutId);
        DeviceEventEmitter.emit(WORKOUT_DELETED_EVENT, { workoutId });
        showToast({ message: t('workoutDetails.deleteSuccess'), tone: 'info' });
        return true;
      } catch (error) {
        showToast({ message: getErrorMessage(error), tone: 'error' });
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [confirmDelete, isDeleting, showToast, t]
  );

  return { confirmAndDelete, isDeleting };
}
