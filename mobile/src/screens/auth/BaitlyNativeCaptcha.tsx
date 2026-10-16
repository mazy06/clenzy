import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyNotice } from '@/design-system/components';

// Public widget configuration, never a secret. The origin must be allowed by
// both the Turnstile widget and the backend's existing hostname validation.
const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const origin = process.env.EXPO_PUBLIC_AUTH_WEB_URL || 'https://app.baitly.fr';
const jsValue = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');

export function BaitlyNativeCaptcha({ onToken }: { onToken: (token: string | undefined) => void }) {
  const { t, i18n } = useTranslation('mobileV1');
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:transparent"><div id="challenge"></div><script>
    function send(token){window.ReactNativeWebView.postMessage(JSON.stringify({token:token}));}
    function ready(){turnstile.render('#challenge',{sitekey:${jsValue(siteKey)},action:'login',language:${jsValue(i18n.language.split('-')[0])},
      theme:'auto',size:'flexible',callback:send,'expired-callback':function(){send(null)},'error-callback':function(){send(null)}});}
    </script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&amp;render=explicit" async defer></script></body></html>`, [i18n.language]);
  if (!siteKey) return <BaitlyNotice error>{t('captchaUnavailable')}</BaitlyNotice>;
  return <View style={{ gap: 8 }}>
    <WebView key={retry} source={{ html, baseUrl: origin }} style={{ flex: 0, height: 90, backgroundColor: 'transparent' }}
      originWhitelist={[origin, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']}
      javaScriptEnabled domStorageEnabled scrollEnabled={false}
      onError={() => { onToken(undefined); setFailed(true); }}
      onMessage={({ nativeEvent }) => {
        try {
          const data = JSON.parse(nativeEvent.data);
          const token = typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 2048 ? data.token : undefined;
          onToken(token); setFailed(!token);
        } catch { onToken(undefined); setFailed(true); }
      }} />
    {failed ? <BaitlyButton title={t('retry')} secondary onPress={() => { onToken(undefined); setFailed(false); setRetry(retry + 1); }} /> : null}
  </View>;
}
