import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';

const palette = Colors.dark;
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;
/** Short travel + snappy easing reads smoother than a long slow slide on web. */
const ENTER_Y = 240;
const EXIT_Y = 280;
const ENTER_MS = 170;
const EXIT_MS = 140;
const SNAP_SPRING = { damping: 26, stiffness: 420, mass: 0.75, overshootClamping: true } as const;

type DismissibleBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Bottom sheet with enter/exit motion. Changing `children` while `visible`
 * stays true (menu → share) keeps the dimmed backdrop — no flash.
 */
export function DismissibleBottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
}: DismissibleBottomSheetProps) {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(ENTER_Y);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined' || !mounted) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverscroll = html.style.overscrollBehaviorY;
    const previousBodyOverscroll = body.style.overscrollBehaviorY;
    const previousBodyOverflow = body.style.overflow;

    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overscrollBehaviorY = previousHtmlOverscroll;
      body.style.overscrollBehaviorY = previousBodyOverscroll;
      body.style.overflow = previousBodyOverflow;
    };
  }, [isWeb, mounted]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = ENTER_Y;
      backdropOpacity.value = 0;
      translateY.value = withTiming(0, {
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
      });
      return;
    }

    if (!mounted) {
      return;
    }

    backdropOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    translateY.value = withTiming(
      EXIT_Y,
      { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      }
    );
  }, [backdropOpacity, mounted, translateY, visible]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
      backdropOpacity.value = Math.max(0.25, 1 - event.translationY / 280);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        runOnJS(onClose)();
        return;
      }

      translateY.value = withSpring(0, SNAP_SPRING);
      backdropOpacity.value = withSpring(1, SNAP_SPRING);
    });

  // Same drag-to-dismiss on the dimmed area; tap still closes.
  const backdropTap = Gesture.Tap().onEnd(() => {
    runOnJS(onClose)();
  });
  const backdropGesture = Gesture.Exclusive(pan, backdropTap);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <View style={styles.backdropRoot}>
          <GestureDetector gesture={backdropGesture}>
            <Animated.View
              style={[styles.backdropFill, backdropAnimatedStyle]}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
            />
          </GestureDetector>

          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.sheet, isWeb && styles.sheetWeb, sheetStyle, sheetAnimatedStyle]}>
              <View
                style={styles.handleHit}
                accessibilityRole="adjustable"
                accessibilityLabel={t('common.dragToClose', { defaultValue: 'Drag down to close' })}
              >
                <View style={styles.handle} />
              </View>
              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdropRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  sheetWeb: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...(Platform.OS === 'web'
      ? ({ touchAction: 'none', overscrollBehavior: 'contain' } as object)
      : null),
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: palette.border,
  },
});
