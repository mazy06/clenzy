import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/theme';

type RouteParams = {
  PdfViewer: {
    uri: string;
    title?: string;
  };
};

export function PdfViewerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PdfViewer'>>();
  const { uri, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const loadedRef = useRef(false);

  // Safety timeout: if WebView hasn't loaded after 8s, dismiss spinner
  // and fall back to external viewer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        setLoading(false);
        setHasError(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleLoadEnd = useCallback(() => {
    loadedRef.current = true;
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    loadedRef.current = true;
    setLoading(false);
    setHasError(true);
  }, []);

  const handleOpenExternal = useCallback(async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document.');
    }
  }, [uri]);

  // On iOS, WebView renders PDFs natively via WKWebView.
  // originWhitelist={['*']} is critical to allow file:// URIs,
  // otherwise WebView delegates to Linking.openURL which backgrounds the app.
  // We also set setSupportMultipleWindows=false to prevent the WebView
  // from trying to open the PDF in a new window/tab.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text
          style={{
            ...theme.typography.h4,
            color: theme.colors.text.primary,
            flex: 1,
            marginLeft: 12,
          }}
          numberOfLines={1}
        >
          {title || 'Document PDF'}
        </Text>
        <Pressable
          onPress={handleOpenExternal}
          hitSlop={12}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="open-outline" size={20} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      {/* PDF content */}
      {hasError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="document-outline" size={48} color={theme.colors.text.disabled} />
          <Text style={{ ...theme.typography.body1, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 16 }}>
            Impossible d'afficher le document dans l'application.
          </Text>
          <Pressable
            onPress={handleOpenExternal}
            style={{
              marginTop: 20,
              paddingHorizontal: 24, paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: theme.colors.primary.main,
            }}
          >
            <Text style={{ ...theme.typography.button, color: '#fff' }}>
              Ouvrir avec une autre application
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri }}
            style={{ flex: 1, backgroundColor: theme.colors.background.default }}
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            setSupportMultipleWindows={false}
            javaScriptEnabled={false}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onHttpError={handleError}
            onShouldStartLoadWithRequest={(request) => {
              // Only allow file:// and about: URIs — block any external navigation
              // that would take the user out of the app
              if (request.url.startsWith('file://') || request.url.startsWith('about:')) {
                return true;
              }
              return false;
            }}
          />
          {loading && (
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.colors.background.default,
            }}>
              <ActivityIndicator size="large" color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 12 }}>
                Chargement du document...
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
