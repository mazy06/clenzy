import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import { useAuthStore } from '@/store/authStore';
import { Button, ClenzyAnimatedLogo } from '@/components/ui';
import { useTheme } from '@/theme';

const AnimatedView = Animated.createAnimatedComponent(View);

export function LoginScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const SPARKLE_GOLD = '#C8924A';
  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;
  const usernameActive = usernameFocused || username.trim().length > 0;
  const passwordActive = passwordFocused || password.length > 0;

  // ─── Animated decorative circles ─────────────────────────
  const circle1Appear = useSharedValue(0);
  const circle2Appear = useSharedValue(0);
  const circle1Float = useSharedValue(0);
  const circle2Float = useSharedValue(0);
  const circle1Scale = useSharedValue(1);
  const circle2Scale = useSharedValue(1);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // Fade in + scale up
    circle1Appear.value = withDelay(200, withTiming(1, { duration: 800, easing: ease }));
    circle2Appear.value = withDelay(500, withTiming(1, { duration: 800, easing: ease }));

    // Floating drift (subtle Y movement)
    circle1Float.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ));
    circle2Float.value = withDelay(1500, withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ));

    // Breathing (subtle scale)
    circle1Scale.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(1.15, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ));
    circle2Scale.value = withDelay(1500, withRepeat(
      withSequence(
        withTiming(1.2, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ));
  }, []);

  const circle1Style = useAnimatedStyle(() => ({
    opacity: interpolate(circle1Appear.value, [0, 1], [0, 0.25]),
    transform: [
      { translateY: interpolate(circle1Float.value, [0, 1], [0, -15]) },
      { translateX: interpolate(circle1Float.value, [0, 1], [0, 8]) },
      { scale: interpolate(circle1Appear.value, [0, 1], [0.5, 1]) * circle1Scale.value },
    ],
  }));

  const circle2Style = useAnimatedStyle(() => ({
    opacity: interpolate(circle2Appear.value, [0, 1], [0, 0.22]),
    transform: [
      { translateY: interpolate(circle2Float.value, [0, 1], [0, 12]) },
      { translateX: interpolate(circle2Float.value, [0, 1], [0, -10]) },
      { scale: interpolate(circle2Appear.value, [0, 1], [0.5, 1]) * circle2Scale.value },
    ],
  }));

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Une erreur est survenue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background.default,
      }}
    >
      {/* Decorative animated background circles — même palette que le logo */}
      {/* Cercle haut-droit : dégradé teal (couleur goutte d'eau du logo) */}
      <AnimatedView
        style={[
          { position: 'absolute', top: -60, right: -40, width: 200, height: 200 },
          circle1Style,
        ]}
      >
        <Svg width={200} height={200}>
          <Defs>
            <SvgGradient id="circle1Grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#3D6B7A" />
              <Stop offset="50%" stopColor="#5B8FA0" />
              <Stop offset="100%" stopColor="#89BCC9" />
            </SvgGradient>
          </Defs>
          <SvgCircle cx={100} cy={100} r={100} fill="url(#circle1Grad)" />
        </Svg>
      </AnimatedView>
      {/* Cercle bas-gauche : dégradé doré (couleur sparkles + ligne du logo) */}
      <AnimatedView
        style={[
          { position: 'absolute', bottom: -30, left: -50, width: 160, height: 160 },
          circle2Style,
        ]}
      >
        <Svg width={160} height={160}>
          <Defs>
            <SvgGradient id="circle2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#D4A65A" />
              <Stop offset="60%" stopColor="#C8924A" />
              <Stop offset="100%" stopColor="#A07438" />
            </SvgGradient>
          </Defs>
          <SvgCircle cx={80} cy={80} r={80} fill="url(#circle2Grad)" />
        </Svg>
      </AnimatedView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: theme.SPACING['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo animé */}
          <View style={{ alignItems: 'center', marginBottom: theme.SPACING['3xl'] }}>
            <ClenzyAnimatedLogo scale={1.1} />
          </View>

          {/* Form */}
          <View style={{ gap: theme.SPACING.md, marginBottom: theme.SPACING.xl }}>
            {/* Username / Email */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.background.paper,
                borderRadius: theme.BORDER_RADIUS.md,
                borderWidth: usernameActive ? 1.5 : 1,
                borderColor: usernameActive ? SPARKLE_GOLD : theme.colors.border.light,
                paddingHorizontal: theme.SPACING.md,
              }}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={usernameActive ? SPARKLE_GOLD : theme.colors.text.disabled}
                style={{ marginRight: theme.SPACING.sm }}
              />
              <TextInput
                style={{
                  flex: 1,
                  height: 48,
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 15,
                  letterSpacing: 0.2,
                  color: theme.colors.text.primary,
                }}
                placeholder="Email ou nom d'utilisateur"
                placeholderTextColor={theme.colors.text.disabled}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />
            </View>

            {/* Password */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.background.paper,
                borderRadius: theme.BORDER_RADIUS.md,
                borderWidth: passwordActive ? 1.5 : 1,
                borderColor: passwordActive ? SPARKLE_GOLD : theme.colors.border.light,
                paddingHorizontal: theme.SPACING.md,
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={passwordActive ? SPARKLE_GOLD : theme.colors.text.disabled}
                style={{ marginRight: theme.SPACING.sm }}
              />
              <TextInput
                ref={passwordRef}
                style={{
                  flex: 1,
                  height: 48,
                  fontFamily: 'Poppins_500Medium',
                  fontSize: 15,
                  letterSpacing: 0.2,
                  color: theme.colors.text.primary,
                }}
                placeholder="Mot de passe"
                placeholderTextColor={theme.colors.text.disabled}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={passwordActive ? SPARKLE_GOLD : theme.colors.text.disabled}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View
              style={{
                backgroundColor: `${theme.colors.error.main}12`,
                borderRadius: theme.BORDER_RADIUS.md,
                padding: theme.SPACING.lg,
                marginBottom: theme.SPACING.xl,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.SPACING.sm,
              }}
            >
              <Ionicons name="alert-circle" size={20} color={theme.colors.error.dark} />
              <Text
                style={{
                  ...theme.typography.body2,
                  color: theme.colors.error.dark,
                  flex: 1,
                }}
              >
                {error}
              </Text>
            </View>
          )}

          {/* Login button */}
          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
            size="large"
            icon={<Ionicons name="log-in-outline" size={20} color="#fff" />}
            style={{ backgroundColor: '#4A7C8E' }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Version */}
      <Text
        style={{
          ...theme.typography.caption,
          color: theme.colors.text.disabled,
          textAlign: 'center',
          paddingBottom: theme.SPACING.lg,
        }}
      >
        v1.0.0
      </Text>
    </SafeAreaView>
  );
}
