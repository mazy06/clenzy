import React, { useEffect, useState } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withRepeat, cancelAnimation, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH, FLOW_STROKE_WIDTH, FLOW_LENGTH, FLOW_END, FLOW_LEG_MS, MARK_PATH_LENGTH, WORDMARK_SIZE_RATIO, WORDMARK_GAP_RATIO, WORDMARK_OFFSET_RATIO } from '@shared/brand/baitlyLogo';

const AnimatedPath = Animated.createAnimatedComponent(Path);
interface BaitlyAnimatedLogoProps {
  scale?: number;
  showWordmark?: boolean;
  disableAnimation?: boolean;
}

/** Même silhouette, proportions et va-et-vient monochrome que le SVG approuvé. */
export function BaitlyAnimatedLogo({ scale = 1, showWordmark = true, disableAnimation = false }: BaitlyAnimatedLogoProps) {
  const theme = useTheme();
  const color = theme.isDark ? '#FFFFFF' : '#1B2A35';
  const markSize = 54 * scale;
  const fontSize = markSize * WORDMARK_SIZE_RATIO;
  const [reduceMotion, setReduceMotion] = useState(true);
  const progress = useSharedValue(0);
  const animated = !reduceMotion && !disableAnimation;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (animated) progress.value = withRepeat(withTiming(1, { duration: FLOW_LEG_MS, easing: Easing.bezier(.37, 0, .63, 1) }), -1, true);
    return () => cancelAnimation(progress);
  }, [animated, progress]);
  const flowProps = useAnimatedProps(() => ({ strokeDashoffset: progress.value * FLOW_END * MARK_PATH_LENGTH / 100 }));
  return (
    <View accessibilityRole="image" accessibilityLabel="Baitly" style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center', gap: markSize * WORDMARK_GAP_RATIO }}>
      <Svg width={markSize} height={markSize} viewBox={MARK_VIEWBOX}>
        <Path d={MARK_PATH} fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" opacity={animated ? .42 : 1} />
        {animated && <AnimatedPath d={MARK_PATH} fill="none" stroke={color} strokeWidth={FLOW_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[FLOW_LENGTH * MARK_PATH_LENGTH / 100, 4 * MARK_PATH_LENGTH]} animatedProps={flowProps} />}
      </Svg>
      {showWordmark && <Text style={{ fontFamily: 'BaitlyWordmark', fontSize, letterSpacing: -.025 * fontSize, color, transform: [{ translateY: markSize * WORDMARK_OFFSET_RATIO }] }}>baitly.</Text>}
    </View>
  );
}
export default BaitlyAnimatedLogo;
