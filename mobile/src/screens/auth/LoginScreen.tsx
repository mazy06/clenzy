import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { BaitlyButton, BaitlyField, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyLoginError, nativeAuthRequest } from '@/services/auth/baitlyCredentials';
import { BaitlyNativeCaptcha } from './BaitlyNativeCaptcha';
import { BaitlyDataModeControl } from '@/features/account/BaitlyDataModeControl';

export function LoginScreen() {
  const { t } = useTranslation('mobileV1');
  const login = useAuthStore(s => s.login);
  const lock = useRef(false);
  const passwordInput = useRef<TextInput>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [reset, setReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaVersion, setCaptchaVersion] = useState(0);
  async function connect() {
    if (lock.current || (!reset && captchaRequired && !captchaToken)) return;
    if (!username.trim() || (!reset && !password)) { setError(t('credentialsRequired')); return; }
    if (reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) { setError(t('validEmailRequired')); return; }
    lock.current = true; setLoading(true); setError(undefined); Keyboard.dismiss();
    try {
      if (reset) {
        const response = await nativeAuthRequest('/auth/forgot-password', { email: username.trim() });
        if (!response.ok) throw new BaitlyLoginError('network');
        setSent(true);
      } else { await login(username, password, captchaToken); setPassword(''); }
    } catch (e) {
      if (e instanceof BaitlyLoginError && e.reason === 'captcha') setCaptchaRequired(true);
      setCaptchaToken(undefined); setCaptchaVersion(v => v + 1);
      setError(t(e instanceof BaitlyLoginError ? `loginError.${e.reason}` : 'loginFailed'));
    }
    finally { lock.current = false; setLoading(false); }
  }
  return <BaitlyScreen title="Baitly">
    <BaitlyDataModeControl />
    <Image source={require('../../../assets/baitly/baitly-marketplace-discovery.jpg')} contentFit="cover" accessible={false} style={styles.image} />
    <View style={styles.intro}>
      <BaitlyText variant="title">{t(reset ? 'resetPassword' : 'mobileWelcome')}</BaitlyText>
      <BaitlyText muted>{t(reset ? 'resetPasswordHelp' : 'nativeLoginIntro')}</BaitlyText>
    </View>
    <BaitlyField label={t('emailOrUsername')} value={username} onChangeText={setUsername}
      autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username"
      editable={!loading} keyboardType="email-address" returnKeyType={reset ? 'send' : 'next'}
      onSubmitEditing={reset ? () => { void connect(); } : () => passwordInput.current?.focus()} />
    {!reset ? <View style={styles.password}>
      <BaitlyField inputRef={passwordInput} label={t('password')} value={password} onChangeText={setPassword} secureTextEntry={!visible}
        autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password"
        editable={!loading} returnKeyType="go" onSubmitEditing={() => { void connect(); }} />
      <Pressable accessibilityRole="button" accessibilityState={{ selected: visible }} onPress={() => setVisible(!visible)} style={styles.link}>
        <BaitlyText variant="meta">{t(visible ? 'hidePassword' : 'showPassword')}</BaitlyText>
      </Pressable>
    </View> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
    {sent ? <BaitlyNotice>{t('resetSent')}</BaitlyNotice> : null}
    {!reset && captchaRequired ? <BaitlyNativeCaptcha key={captchaVersion} onToken={setCaptchaToken} /> : null}
    <BaitlyButton title={t(loading ? 'loading' : reset ? 'sendReset' : 'login')} onPress={() => { void connect(); }} busy={loading}
      disabled={!reset && captchaRequired && !captchaToken} />
    <Pressable accessibilityRole="button" disabled={loading} style={styles.link} onPress={() => { setReset(!reset); setPassword(''); setError(undefined); setSent(false); }}>
      <BaitlyText variant="meta">{t(reset ? 'backToLogin' : 'forgotPassword')}</BaitlyText>
    </Pressable>
    <BaitlyText variant="meta" muted>{t('existingAccountHelp')}</BaitlyText>
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  image: { width: '100%', height: 124, borderRadius: 16 },
  intro: { gap: 8, paddingTop: 4, paddingBottom: 8 }, password: { gap: 4 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
});
