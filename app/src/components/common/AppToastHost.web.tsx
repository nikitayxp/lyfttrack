import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';
import { getTabBarHeight } from '@/constants/tabBar';
import { useAppToast, type AppToastTone } from '@/context/ToastContext';

const palette = Colors.dark;
const AUTO_DISMISS_MS = 3800;
const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 700;

type AppToastHostProps = {
  /** Sit just above the tab bar on main tabs; otherwise above the home indicator. */
  aboveTabBar?: boolean;
};

/**
 * Web-only variant. react-native-web's <Modal> (bottom sheets, the confirm
 * dialog) portals its content into a fresh <div> appended to <body>, which
 * paints above the rest of the app regardless of this component's zIndex —
 * it's a sibling of the app root, not a descendant of it. Toasts fired while
 * a sheet is open (e.g. a validation error inside "create exercise") were
 * rendering invisibly underneath it. Portaling here too, and re-appending on
 * every toast so this node is always the last child of <body>, keeps the
 * toast on top of whatever sheet happens to be open.
 */
export function AppToastHost({ aboveTabBar = false }: AppToastHostProps) {
  const { toast, dismissToast } = useAppToast();
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(true, insets.bottom);
  const bottomOffset = aboveTabBar ? tabBarHeight + 12 : Math.max(insets.bottom, 12) + 12;

  const portalNodeRef = useRef<HTMLDivElement | null>(null);
  if (typeof document !== 'undefined' && !portalNodeRef.current) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '99999';
    el.style.pointerEvents = 'none';
    portalNodeRef.current = el;
  }

  useLayoutEffect(() => {
    const node = portalNodeRef.current;
    if (!node || typeof document === 'undefined' || !toast) {
      return;
    }
    document.body.appendChild(node);
    return () => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    };
  }, [toast]);

  const progress = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useLayoutEffect(() => {
    if (!toast) {
      cancelAnimation(progress);
      progress.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 1;
    progress.value = 1;
    progress.value = withTiming(0, { duration: AUTO_DISMISS_MS }, (finished) => {
      if (finished) {
        runOnJS(dismissToast)();
      }
    });
  }, [dismissToast, opacity, progress, toast, translateX, translateY]);

  const finishDismiss = () => {
    cancelAnimation(progress);
    dismissToast();
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      // Down only — dragging up should not dismiss.
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const sideways =
        Math.abs(event.translationX) > SWIPE_DISTANCE || Math.abs(event.velocityX) > SWIPE_VELOCITY;
      const downward = event.translationY > SWIPE_DISTANCE || event.velocityY > SWIPE_VELOCITY;

      if (sideways || downward) {
        opacity.value = withTiming(0, { duration: 120 });
        runOnJS(finishDismiss)();
        return;
      }

      translateX.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(0, { duration: 160 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const timerStyle = useAnimatedStyle(() => ({
    width: `${Math.max(progress.value, 0) * 100}%`,
  }));

  if (!toast || !portalNodeRef.current) {
    return null;
  }

  const tone: AppToastTone = toast.tone ?? 'info';

  return createPortal(
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.toast, tone === 'error' && styles.toastError, { bottom: bottomOffset, pointerEvents: 'auto' }, cardStyle]}>
          <Pressable
            onPress={finishDismiss}
            style={styles.pressRow}
            accessibilityRole="button"
            accessibilityLabel={toast.message}
          >
            <Ionicons
              name={tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={tone === 'error' ? palette.error : palette.success}
            />
            <Text style={styles.text}>{toast.message}</Text>
          </Pressable>
          <View style={[styles.timerTrack, tone === 'error' && styles.timerTrackError]}>
            <Animated.View
              style={[styles.timerFill, tone === 'error' && styles.timerFillError, timerStyle]}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>,
    portalNodeRef.current
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.35)',
    backgroundColor: 'rgba(12, 24, 16, 0.96)',
    overflow: 'hidden',
    maxWidth: 420,
    alignSelf: 'center',
  },
  toastError: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(28, 12, 12, 0.96)',
  },
  pressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  text: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  timerTrack: {
    height: 3,
    backgroundColor: 'rgba(22,163,74,0.18)',
  },
  timerTrackError: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  timerFill: {
    height: 3,
    backgroundColor: palette.success,
  },
  timerFillError: {
    backgroundColor: palette.error,
  },
});
