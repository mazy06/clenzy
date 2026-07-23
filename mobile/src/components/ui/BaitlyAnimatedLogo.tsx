import React, { useEffect, useState } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface BaitlyAnimatedLogoProps {
  scale?: number;
  /** Affiche le wordmark « baitly » à côté du mark (défaut true). */
  showWordmark?: boolean;
}

/**
 * Logo Baitly (mobile) — mark « maison + flux request/response ».
 *
 * Portage du nouveau logo web ({@code BaitlyMarkLogo}) : une maison tracée en
 * un trait continu, sur laquelle circulent deux packets — un aller « request »
 * (bleu) puis un retour « response » (ambre). Remplace l'ancien
 * {@code ClenzyAnimatedLogo} (goutte d'eau + « PROPRETÉ & MULTISERVICES »),
 * conservé pour référence.
 *
 * L'animation CSS du web (stroke-dashoffset via keyframes) est reproduite ici
 * en Reanimated : une {@code progress} 0→1 en boucle 5s pilote le dashoffset des
 * deux packets. Si « réduire les animations » est actif, seul le trait maison
 * est rendu (packets masqués), logo parfaitement lisible et immobile.
 */

// Path de la maison (coordonnées viewBox 1024, centre ~511,511). Partagé par
// le mark et les deux packets qui circulent dessus.
const MARK_PATH =
  'M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 ' +
  'A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 ' +
  'L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 ' +
  'A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 ' +
  'A30.25 30.25 0 0 1 559 590.25';

const MARK_VIEWBOX = '251 251 522 522';
const STROKE_WIDTH = 21;

// react-native-svg ne supporte pas l'attribut `pathLength` de façon fiable :
// on travaille donc en unités absolues du path. Longueur totale ≈ 2050 (mesurée
// par sommation des segments/arcs). K = longueur / 100 = échelle depuis les
// valeurs normalisées du logo web (dasharray "6 400", offset 10 → -100).
const PATH_LENGTH = 2050;
const K = PATH_LENGTH / 100;
const DASH = 9 * K;          // longueur du packet (~185)
const GAP = PATH_LENGTH * 2; // gap > longueur → un seul packet visible, qui wrap
const OFF_START = 10 * K;    // 205
const OFF_END = -100 * K;    // -2050

// Packets légèrement plus épais que le trait maison : ils « chevauchent » le
// tracé et restent lisibles aux petites tailles (aligné sur le logo web).
const PACKET_STROKE_WIDTH = STROKE_WIDTH + 6;

// Teintes signature du flux (request bleu / response ambre — complémentaire du
// bleu, jamais confondable avec le trait vert-gris), déclinées par thème
// (aligné sur PACKET_COLORS du logo web BaitlyMarkLogo).
const PACKET_COLORS = {
  light: { request: '#2563EB', response: '#D97706' },
  dark: { request: '#60A5FA', response: '#FBBF24' },
} as const;

export function BaitlyAnimatedLogo({ scale = 1, showWordmark = true }: BaitlyAnimatedLogoProps) {
  const theme = useTheme();
  // Gris de marque Baitly canonique (aligné sur le logo web BaitlyMarkLogo) :
  // #6B8A9A en clair, éclairci à #89B1C2 en sombre pour garder le contraste.
  // On n'utilise PAS theme.colors.primary.main (#4A7C8E) qui est plus foncé.
  const markColor = theme.isDark ? '#89B1C2' : '#6B8A9A';
  const packetColors = PACKET_COLORS[theme.isDark ? 'dark' : 'light'];
  const wordmarkColor = theme.colors.text.primary;

  const markSize = 54 * scale;
  const fontSize = 34 * scale;

  const [reduceMotion, setReduceMotion] = useState(false);

  // Entrée : fade + léger translate.
  const enter = useSharedValue(0);
  // Cycle infini 5s pilotant les deux packets.
  const progress = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    enter.value = withDelay(50, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    if (!reduceMotion) {
      progress.value = 0;
      progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    } else {
      progress.value = 0;
    }
  }, [reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [8, 0]) }],
  }));

  // Request : avance sur la première moitié du cycle (0 → 45%), puis attend.
  const requestProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 0.45, 1], [OFF_START, OFF_END, OFF_END]),
  }));

  // Response : attend la première moitié (0 → 50%), puis revient (50% → 95%).
  const responseProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 0.5, 0.95, 1], [OFF_END, OFF_END, OFF_START, OFF_START]),
  }));

  return (
    <Animated.View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * scale },
        containerStyle,
      ]}
    >
      <Svg width={markSize} height={markSize} viewBox={MARK_VIEWBOX}>
        {/* Trait maison */}
        <Path
          d={MARK_PATH}
          fill="none"
          stroke={markColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Packets (masqués si réduction des animations) */}
        {!reduceMotion && (
          <>
            <AnimatedPath
              d={MARK_PATH}
              fill="none"
              stroke={packetColors.request}
              strokeWidth={PACKET_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[DASH, GAP]}
              animatedProps={requestProps}
            />
            <AnimatedPath
              d={MARK_PATH}
              fill="none"
              stroke={packetColors.response}
              strokeWidth={PACKET_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[DASH, GAP]}
              animatedProps={responseProps}
            />
          </>
        )}
      </Svg>

      {showWordmark && (
        <Text
          style={{
            fontWeight: '600',
            fontSize,
            letterSpacing: -0.015 * fontSize,
            color: wordmarkColor,
          }}
        >
          baitly
        </Text>
      )}
    </Animated.View>
  );
}

export default BaitlyAnimatedLogo;
