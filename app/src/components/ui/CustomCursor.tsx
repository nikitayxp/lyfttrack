import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

type CustomCursorProps = {
  enabled: boolean;
};

const CURSOR_SIZE = 132;
const HIDDEN_POSITION = -9999;
const SPRING_STIFFNESS = 0.16;
const SPRING_DAMPING = 0.78;
const MAX_VELOCITY = 38;
const SNAP_DISTANCE = 0.35;
const SNAP_VELOCITY = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function CustomCursor({ enabled }: CustomCursorProps) {
  const translateX = useRef(new Animated.Value(HIDDEN_POSITION)).current;
  const translateY = useRef(new Animated.Value(HIDDEN_POSITION)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const targetPositionRef = useRef({ x: HIDDEN_POSITION, y: HIDDEN_POSITION });
  const currentPositionRef = useRef({ x: HIDDEN_POSITION, y: HIDDEN_POSITION });
  const velocityRef = useRef({ x: 0, y: 0 });
  const isPointerVisibleRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const hideCursor = () => {
      isPointerVisibleRef.current = false;
      targetPositionRef.current = { x: HIDDEN_POSITION, y: HIDDEN_POSITION };
      currentPositionRef.current = { x: HIDDEN_POSITION, y: HIDDEN_POSITION };
      velocityRef.current = { x: 0, y: 0 };
      translateX.setValue(HIDDEN_POSITION);
      translateY.setValue(HIDDEN_POSITION);
      opacity.setValue(0);
    };

    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      hideCursor();
      return;
    }

    const hasFinePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;

    if (!hasFinePointer) {
      hideCursor();
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const activeStiffness = prefersReducedMotion ? 0.34 : SPRING_STIFFNESS;
    const activeDamping = prefersReducedMotion ? 0.62 : SPRING_DAMPING;

    const animate = () => {
      if (isPointerVisibleRef.current) {
        const target = targetPositionRef.current;
        const current = currentPositionRef.current;
        const velocity = velocityRef.current;

        const deltaX = target.x - current.x;
        const deltaY = target.y - current.y;

        velocity.x = clamp((velocity.x + deltaX * activeStiffness) * activeDamping, -MAX_VELOCITY, MAX_VELOCITY);
        velocity.y = clamp((velocity.y + deltaY * activeStiffness) * activeDamping, -MAX_VELOCITY, MAX_VELOCITY);

        current.x += velocity.x;
        current.y += velocity.y;

        if (Math.abs(deltaX) < SNAP_DISTANCE && Math.abs(velocity.x) < SNAP_VELOCITY) {
          current.x = target.x;
          velocity.x = 0;
        }

        if (Math.abs(deltaY) < SNAP_DISTANCE && Math.abs(velocity.y) < SNAP_VELOCITY) {
          current.y = target.y;
          velocity.y = 0;
        }

        translateX.setValue(current.x);
        translateY.setValue(current.y);
      }

      frameRef.current = window.requestAnimationFrame(animate);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const wasPointerVisible = isPointerVisibleRef.current;
      const nextX = event.clientX - CURSOR_SIZE / 2;
      const nextY = event.clientY - CURSOR_SIZE / 2;

      isPointerVisibleRef.current = true;
      targetPositionRef.current = { x: nextX, y: nextY };

      if (currentPositionRef.current.x === HIDDEN_POSITION || currentPositionRef.current.y === HIDDEN_POSITION) {
        currentPositionRef.current = { x: nextX, y: nextY };
        velocityRef.current = { x: 0, y: 0 };
        translateX.setValue(nextX);
        translateY.setValue(nextY);
      }

      if (!wasPointerVisible) {
        opacity.stopAnimation();
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }
    };

    const handleMouseLeave = () => {
      isPointerVisibleRef.current = false;
      opacity.stopAnimation();

      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !isPointerVisibleRef.current) {
          hideCursor();
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      hideCursor();
    };
  }, [enabled, opacity, translateX, translateY]);

  if (!enabled) {
    return null;
  }

  return (
    <View style={styles.layer}>
      <Animated.View
        style={[
          styles.glow,
          {
            opacity,
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        <View style={styles.core} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    zIndex: 9999,
  },
  glow: {
    position: 'absolute',
    width: CURSOR_SIZE,
    height: CURSOR_SIZE,
    borderRadius: CURSOR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.36)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
  },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(186, 230, 253, 0.85)',
    shadowColor: '#BAE6FD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
});
