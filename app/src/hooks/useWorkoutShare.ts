import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileVisibility, ShareChoice } from '@/components/workout/ShareWorkoutSheet';
import { getPublicProfileById } from '@/services/profileService';
import { buildWorkoutUrl } from '@/utils/shareLinks';
import { copyToClipboard, type ShareWorkoutInput } from '@/utils/shareWorkout';

export type ShareNotice = { message: string; tone: 'info' | 'error' };

/**
 * Share payload + privacy + copy. The parent owns the bottom-sheet visibility
 * so menu → share can keep the same backdrop.
 */
export function useWorkoutShare() {
  const { t } = useTranslation();

  const [shareInput, setShareInput] = useState<ShareWorkoutInput | null>(null);
  const [ownerVisibility, setOwnerVisibility] = useState<ProfileVisibility | null>(null);
  const [notice, setNotice] = useState<ShareNotice | null>(null);

  const prepareShare = useCallback(
    (input: { workoutId: string; ownerId: string | null; title: string; summary: string }) => {
      setShareInput({
        title: input.title,
        summary: input.summary,
        url: buildWorkoutUrl(input.workoutId),
      });
      setOwnerVisibility(null);
      setNotice(null);

      if (!input.ownerId) {
        return;
      }

      void getPublicProfileById(input.ownerId)
        .then((profile) => {
          setOwnerVisibility((profile?.visibility as ProfileVisibility | undefined) ?? null);
        })
        .catch(() => {
          setOwnerVisibility(null);
        });
    },
    []
  );

  const resetShare = useCallback(() => {
    setShareInput(null);
    setOwnerVisibility(null);
    setNotice(null);
  }, []);

  const chooseShare = useCallback(
    async (
      choice: ShareChoice
    ): Promise<{ status: 'copied'; message: string } | { status: 'failed' }> => {
      if (!shareInput) {
        return { status: 'failed' };
      }

      const text =
        choice === 'link' ? shareInput.url : `${shareInput.title}\n${shareInput.summary}\n${shareInput.url}`;
      const copied = await copyToClipboard(text);

      if (copied) {
        setNotice(null);
        return {
          status: 'copied',
          message: choice === 'link' ? t('feed.shareLinkCopied') : t('feed.shareTextCopied'),
        };
      }

      setNotice({
        message: t('feed.shareCopyFailed'),
        tone: 'error',
      });
      return { status: 'failed' };
    },
    [shareInput, t]
  );

  return {
    shareInput,
    ownerVisibility,
    notice,
    prepareShare,
    resetShare,
    chooseShare,
    dismissNotice: useCallback(() => setNotice(null), []),
  };
}
