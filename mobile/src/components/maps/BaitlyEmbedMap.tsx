import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import i18n from '@/i18n/config';
import { API_CONFIG } from '@/config/api';
import type { SectorMap } from '@/api/endpoints/sectorMapApi';

export type SectorMode = 'merged' | 'byProvider';

interface BaitlyEmbedMapProps {
  map: SectorMap | undefined;
  mode: SectorMode;
  dark: boolean;
  onPropertyPress?: (propertyId: number) => void;
}

/**
 * Carte Baitly du PMS (`/embed-map.html`) dans une WebView : même rendu que le web.
 *
 * <p>La page ne reçoit aucun jeton : l'app charge les données avec sa session et les
 * injecte une fois la carte prête ({@code ready}), puis à chaque changement.</p>
 */
export function BaitlyEmbedMap({ map, mode, dark, onPropertyPress }: BaitlyEmbedMapProps) {
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const language = ['fr', 'en', 'ar'].includes(i18n.language) ? i18n.language : 'fr';
  const uri = `${API_CONFIG.WEB_URL}/embed-map.html?lang=${language}&theme=${dark ? 'dark' : 'light'}`;

  const send = useCallback(() => {
    if (!ready || !map) return;
    const message = JSON.stringify({ type: 'sectors', map, mode });
    webView.current?.injectJavaScript(`window.baitlyMap && window.baitlyMap.receive(${message}); true;`);
  }, [ready, map, mode]);

  useEffect(send, [send]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') setReady(true);
      if (message.type === 'propertyPress' && typeof message.propertyId === 'number') onPropertyPress?.(message.propertyId);
    } catch {
      // Message étranger au protocole de la carte : ignoré.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        key={uri}
        ref={webView}
        source={{ uri }}
        onMessage={onMessage}
        onLoadStart={() => setReady(false)}
        originWhitelist={[API_CONFIG.WEB_URL]}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        style={styles.web}
      />
      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
