import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileVisibility, ShareChoice } from '@/components/workout/ShareWorkoutSheet';
import { useAppToast } from '@/context/ToastContext';
import { getPublicProfileById } from '@/services/profileService';
import { buildWorkoutUrl } from '@/utils/shareLinks';
import { copyToClipboard, type ShareWorkoutInput } from '@/utils/shareWorkout';

export type ShareNotice = { message: string; tone: 'info' | 'error' };

/**
 * The share flow, kept in one place because the feed card and the details
 * screen must behave identically — including the privacy rule, which is easy to
 * get subtly different if it is written twice.
 */
export function useWorkoutShare() {
  const { t } = useTranslation();
  const { showToast } = useAppToast();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [shareInput, setShareInput] = useState<ShareWorkoutInput | null>(null);
  const [ownerVisibility, setOwnerVisibility] = useState<ProfileVisibility | null>(null);
  const [notice, setNotice] = useState<ShareNotice | null>(null);

  const openShare = useCallback(
    (input: { workoutId: string; ownerId: string | null; title: string; summary: string }) => {
      setShareInput({
        title: input.title,
        summary: input.summary,
        url: buildWorkoutUrl(input.workoutId),
      });
      setOwnerVisibility(null);
      setNotice(null);
      setSheetVisible(true);

      if (!input.ownerId) {
        return;
      }

      // Whether the recipient can open the link depends on the owner's profile,
      // not on the workout, so it has to be read before promising anything.
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

  const closeShare = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const chooseShare = useCallback(
    async (choice: ShareChoice) => {
      if (!shareInput) {
        return;
      }

      // Copy while the sheet is still open (user gesture + focus). Closing
      // first makes mobile web report success with an empty clipboard.
      const text = choice === 'link' ? shareInput.url : `${shareInput.title}\n${shareInput.summary}\n${shareInput.url}`;
      const copied = await copyToClipboard(text);

      if (copied) {
        setSheetVisible(false);
        setNotice(null);
        showToast({
          message: choice === 'link' ? t('feed.shareLinkCopied') : t('feed.shareTextCopied'),
          tone: 'info',
        });
        return;
      }

      // Keep the sheet open so the selectable preview can be long-pressed.
      setNotice({
        message: t('feed.shareCopyFailed'),
        tone: 'error',
      });
    },
    [shareInput, showToast, t]
  );

  return {
    sheetVisible,
    shareInput,
    ownerVisibility,
    notice,
    openShare,
    closeShare,
    chooseShare,
    dismissNotice: useCallback(() => setNotice(null), []),
  };
}
