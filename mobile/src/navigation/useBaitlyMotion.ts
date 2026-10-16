import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useBaitlyTheme } from '@/design-system/theme';
import { useReducedMotion } from 'react-native-reanimated';

export function useBaitlyReducedMotion() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function useBaitlyTabOptions(): BottomTabNavigationOptions {
  const reduced = useBaitlyReducedMotion();
  const colors = useBaitlyTheme();
  return {
    headerShown: false,
    animation: reduced ? 'none' : 'shift',
    transitionSpec: { animation: 'timing', config: { duration: 240, easing: Easing.out(Easing.poly(4)) } },
    sceneStyle: { backgroundColor: colors.background },
  };
}
