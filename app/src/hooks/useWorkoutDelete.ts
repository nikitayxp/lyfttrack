import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppToast } from '@/context/ToastContext';
import { deleteWorkout, getErrorMessage } from '@/services/workoutService';

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
    const description = t('workoutDetails.deleteConfirmDescription');

    // An Alert with buttons is ignored on web, so the browser prompt stands in.
    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      return confirmFn ? confirmFn(description) : true;
    }

    return await new Promise((resolve) => {
      Alert.alert(t('workoutDetails.deleteConfirmTitle'), description, [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('workoutDetails.deleteConfirmAction'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
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
