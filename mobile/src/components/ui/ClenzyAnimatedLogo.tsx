import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';

const AnimatedView = Animated.createAnimatedComponent(View);

interface ClenzyAnimatedLogoProps {
  scale?: number;
}

// ─── Sous-composants pour respecter les règles des hooks ────

function AnimatedLetter({
  char,
  progress,
  scale,
}: {
  char: string;
  progress: SharedValue<number>;
  scale: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [20, 0]) },
      { scaleY: interpolate(progress.value, [0, 1], [0.4, 1]) },
    ],
  }));

  return (
    <AnimatedView style={style}>
      <Text
        style={{
          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
          fontWeight: '700',
          fontSize: 38 * scale,
          letterSpacing: 0.05 * 38 * scale,
          color: '#5B8FA0',
        }}
      >
        {char}
      </Text>
    </AnimatedView>
  );
}

function AnimatedSparkle({
  appear,
  pulse,
  children,
  style,
}: {
  appear: SharedValue<number>;
  pulse: SharedValue<number>;
  children: React.ReactNode;
  style: object;
}) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: appear.value * pulse.value,
    transform: [
      { scale: appear.value * pulse.value },
      { rotate: `${interpolate(appear.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  return (
    <AnimatedView style={[style, animStyle]}>
      {children}
    </AnimatedView>
  );
}

function AnimatedDot({
  progress,
  size,
}: {
  progress: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value * 0.6,
    transform: [{ scale: progress.value }],
  }));

  return (
    <AnimatedView
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#C8924A',
        },
        style,
      ]}
    />
  );
}

// ─── Composant principal ────────────────────────────────────

const LETTERS = ['C', 'l', 'e', 'n', 'z', 'y'];

export function ClenzyAnimatedLogo({ scale = 1 }: ClenzyAnimatedLogoProps) {
  const s = scale;

  // ─── Shared values ───────────────────────────────────────
  const dropProgress = useSharedValue(0);

  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);
  const sparkle3 = useSharedValue(0);
  const sparkle1Pulse = useSharedValue(1);
  const sparkle2Pulse = useSharedValue(1);
  const sparkle3Pulse = useSharedValue(1);

  // 6 letters
  const lp0 = useSharedValue(0);
  const lp1 = useSharedValue(0);
  const lp2 = useSharedValue(0);
  const lp3 = useSharedValue(0);
  const lp4 = useSharedValue(0);
  const lp5 = useSharedValue(0);
  const letterProgressArr = [lp0, lp1, lp2, lp3, lp4, lp5];

  const lineWidth = useSharedValue(0);
  const subtitleProgress = useSharedValue(0);
  const dot0 = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // Drop falls in
    dropProgress.value = withDelay(50, withTiming(1, { duration: 600, easing: ease }));

    // Letters reveal one by one
    letterProgressArr.forEach((lp, i) => {
      lp.value = withDelay(
        300 + i * 80,
        withTiming(1, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) })
      );
    });

    // Sparkles appear
    sparkle1.value = withDelay(700, withTiming(1, { duration: 500, easing: ease }));
    sparkle2.value = withDelay(900, withTiming(1, { duration: 500, easing: ease }));
    sparkle3.value = withDelay(1100, withTiming(1, { duration: 500, easing: ease }));

    // Sparkle infinite pulse
    sparkle1Pulse.value = withDelay(
      1200,
      withRepeat(withSequence(withTiming(0.4, { duration: 750 }), withTiming(1, { duration: 750 })), -1, true)
    );
    sparkle2Pulse.value = withDelay(
      1400,
      withRepeat(withSequence(withTiming(0.4, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true)
    );
    sparkle3Pulse.value = withDelay(
      1600,
      withRepeat(withSequence(withTiming(0.4, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true)
    );

    // Golden line
    lineWidth.value = withDelay(900, withTiming(1, { duration: 600, easing: ease }));

    // Subtitle
    subtitleProgress.value = withDelay(1200, withTiming(1, { duration: 500, easing: ease }));

    // Dots
    dot0.value = withDelay(1400, withTiming(1, { duration: 300, easing: ease }));
    dot1.value = withDelay(1500, withTiming(1, { duration: 300, easing: ease }));
    dot2.value = withDelay(1600, withTiming(1, { duration: 300, easing: ease }));
  }, []);

  // ─── Animated styles (top-level hooks only) ───────────────
  const dropStyle = useAnimatedStyle(() => ({
    opacity: dropProgress.value,
    transform: [{ translateY: interpolate(dropProgress.value, [0, 1], [-30, 0]) }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: `${lineWidth.value * 100}%` as any,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleProgress.value,
    transform: [{ translateY: interpolate(subtitleProgress.value, [0, 1], [6, 0]) }],
  }));

  // ─── Render ──────────────────────────────────────────────
  return (
    <View style={[styles.container, { gap: 12 * s }]}>
      {/* Goutte + étincelles */}
      <View style={{ position: 'relative', width: 44 * s, height: 60 * s }}>
        <AnimatedView style={[{ width: '100%', height: '100%' }, dropStyle]}>
          <Svg viewBox="0 0 70 95" width={44 * s} height={60 * s}>
            <Defs>
              <LinearGradient id="dropGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#3D6B7A" />
                <Stop offset="100%" stopColor="#6DA3B4" />
              </LinearGradient>
            </Defs>
            <Path
              d="M35 3 C35 3, 5 45, 5 62 C5 80, 18 92, 35 92 C52 92, 65 80, 65 62 C65 45, 35 3, 35 3 Z"
              fill="url(#dropGrad)"
            />
            <Path
              d="M24 48 C24 48, 16 64, 19 73 C20 77, 24 79, 27 76 C30 71, 24 48, 24 48 Z"
              fill="white"
              opacity={0.3}
            />
          </Svg>
        </AnimatedView>

        <AnimatedSparkle
          appear={sparkle1}
          pulse={sparkle1Pulse}
          style={{ position: 'absolute', top: -4 * s, right: -8 * s }}
        >
          <Svg width={16 * s} height={16 * s} viewBox="0 0 24 24">
            <Path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill="#C8924A" />
          </Svg>
        </AnimatedSparkle>

        <AnimatedSparkle
          appear={sparkle2}
          pulse={sparkle2Pulse}
          style={{ position: 'absolute', bottom: 4 * s, right: -10 * s }}
        >
          <Svg width={11 * s} height={11 * s} viewBox="0 0 24 24">
            <Path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill="#D4A65A" />
          </Svg>
        </AnimatedSparkle>

        <AnimatedSparkle
          appear={sparkle3}
          pulse={sparkle3Pulse}
          style={{ position: 'absolute', top: -8 * s, left: 2 * s }}
        >
          <Svg width={8 * s} height={8 * s} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={6} fill="#C8924A" />
          </Svg>
        </AnimatedSparkle>
      </View>

      {/* Texte + ligne + sous-titre */}
      <View style={{ flexDirection: 'column' }}>
        {/* Lettres animées */}
        <View style={{ flexDirection: 'row' }}>
          {LETTERS.map((char, i) => (
            <AnimatedLetter key={i} char={char} progress={letterProgressArr[i]} scale={s} />
          ))}
        </View>

        {/* Ligne dorée */}
        <AnimatedView
          style={[
            { height: 2, borderRadius: 2, backgroundColor: '#C8924A', marginTop: 2 * s },
            lineStyle,
          ]}
        />

        {/* Sous-titre */}
        <AnimatedView style={[{ marginTop: 4 * s }, subtitleStyle]}>
          <Text
            style={{
              fontSize: 8 * s,
              fontWeight: '600',
              letterSpacing: 3 * s,
              color: '#4A7C8E',
            }}
          >
            PROPRETÉ & MULTISERVICES
          </Text>
        </AnimatedView>

        {/* Dots */}
        <View style={{ flexDirection: 'row', gap: 6 * s, marginTop: 4 * s }}>
          <AnimatedDot progress={dot0} size={4 * s} />
          <AnimatedDot progress={dot1} size={4 * s} />
          <AnimatedDot progress={dot2} size={4 * s} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ClenzyAnimatedLogo;
