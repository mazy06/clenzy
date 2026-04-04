import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { documentsApi, type DocumentGenerationDto } from '@/api/endpoints/documentsApi';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { DocumentDetail: { documentId: number } };

const DOC_TYPE_CONFIG: Record<string, { icon: IoniconsName; color: string; label: string }> = {
  FACTURE: { icon: 'receipt-outline', color: '#2196F3', label: 'Facture' },
  CONTRAT: { icon: 'document-text-outline', color: '#9C27B0', label: 'Contrat' },
  RECU: { icon: 'card-outline', color: '#4CAF50', label: 'Recu' },
  ATTESTATION: { icon: 'ribbon-outline', color: '#FF9800', label: 'Attestation' },
};

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'info' }> = {
  DRAFT: { label: 'Brouillon', color: 'warning' },
  SENT: { label: 'Envoye', color: 'info' },
  PAID: { label: 'Paye', color: 'success' },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} \u20AC`;
}

function InfoRow({ icon, label, value, theme }: {
  icon: IoniconsName;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: theme.SPACING.sm,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${theme.colors.primary.main}0A`,
        alignItems: 'center', justifyContent: 'center',
        marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={16} color={theme.colors.primary.main} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{label}</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

function DetailSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton width={90} height={26} borderRadius={20} />
        <Skeleton width={90} height={26} borderRadius={20} />
      </View>
      <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

export function DocumentDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'DocumentDetail'>>();
  const { documentId } = route.params;
  // Try to get doc from route params first (passed from list), fallback to API
  const passedDoc = (route.params as any)?.document as DocumentGenerationDto | undefined;

  const { data: fetchedDoc, isLoading, isError, error, isRefetching, refetch } = useQuery({
    queryKey: ['documents', 'detail', documentId],
    queryFn: async () => {
      // Fetch all generations and find by ID
      const res = await documentsApi.getGenerations(0, 200);
      const list = Array.isArray(res) ? res : res.content ?? [];
      return list.find((d) => d.id === documentId) ?? null;
    },
    enabled: documentId > 0 && !passedDoc,
  });

  const document = passedDoc ?? fetchedDoc;
  const { accessToken } = useAuthStore();

  const apiBaseUrl = require('@/config/api').API_CONFIG.BASE_URL;
  const downloadUrl = `${apiBaseUrl}/api/documents/generations/${documentId}/download`;

  /** Download PDF with auth token to local cache, return local URI */
  const downloadPdfToLocal = useCallback(async (): Promise<string> => {
    const fileName = document?.legalNumber ?? `document-${documentId}`;
    const localUri = `${FileSystem.cacheDirectory}${fileName}.pdf`;

    const result = await FileSystem.downloadAsync(downloadUrl, localUri, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (result.status !== 200) {
      throw new Error(`Erreur serveur (${result.status})`);
    }

    // Validate it's actually a PDF (not an HTML error page)
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || fileInfo.size < 100) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error('Le fichier telecharge est invalide. Veuillez reessayer.');
    }

    // Check content-type header if available
    const contentType = result.headers?.['content-type'] || result.headers?.['Content-Type'] || '';
    if (contentType.includes('text/html')) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error('Session expiree. Veuillez vous reconnecter.');
    }

    return result.uri;
  }, [downloadUrl, accessToken, document?.legalNumber, documentId]);

  const handleViewPdf = useCallback(async () => {
    try {
      const localUri = await downloadPdfToLocal();
      (navigation as any).navigate('PdfViewer', {
        uri: localUri,
        title: document?.legalNumber ?? 'Document PDF',
      });
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible d\'ouvrir le document.');
    }
  }, [downloadPdfToLocal, document?.legalNumber, navigation]);

  const handleDownload = useCallback(async () => {
    try {
      const localUri = await downloadPdfToLocal();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de telecharger le document.');
    }
  }, [downloadPdfToLocal]);

  const handleSendEmail = useCallback(() => {
    Alert.alert('Info', 'L\'envoi par email sera disponible prochainement.');
  }, []);

  const handleMarkPaid = useCallback(() => {
    Alert.alert('Info', 'Le marquage comme paye sera disponible prochainement.');
  }, []);

  /* --- Loading --- */
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute', top: theme.SPACING.lg, left: theme.SPACING.lg, zIndex: 10,
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            ...theme.shadows.md,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ marginTop: 56 }}>
          <DetailSkeleton theme={theme} />
        </View>
      </SafeAreaView>
    );
  }

  /* --- Error --- */
  if (isError || !document) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <EmptyState
          iconName="warning-outline"
          title="Document introuvable"
          description={error ? (error instanceof Error ? error.message : JSON.stringify(error)) : undefined}
          actionLabel="Retour"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const typeConf = DOC_TYPE_CONFIG[document.documentType] ?? { icon: 'document-outline', color: '#607D8B', label: document.documentType };
  const statusConf = STATUS_CONFIG[document.status] ?? { label: document.status, color: 'info' as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Header bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING.lg,
          paddingBottom: theme.SPACING.md,
        }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{
              width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: theme.colors.background.paper,
              alignItems: 'center', justifyContent: 'center',
              marginRight: theme.SPACING.md,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
            Document
          </Text>
        </View>

        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* Type badge + status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${typeConf.color}14`,
            }}>
              <Ionicons name={typeConf.icon} size={14} color={typeConf.color} />
              <Text style={{ ...theme.typography.caption, fontWeight: '600', color: typeConf.color }}>
                {typeConf.label}
              </Text>
            </View>
            <Badge label={statusConf.label} color={statusConf.color} dot />
          </View>

          {/* Title card */}
          <Card elevated style={{ marginBottom: theme.SPACING.lg, alignItems: 'center', paddingVertical: theme.SPACING.xl }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: `${typeConf.color}14`,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: theme.SPACING.md,
            }}>
              <Ionicons name={typeConf.icon} size={32} color={typeConf.color} />
            </View>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' }}>
              {document.legalNumber ?? document.fileName ?? `Document #${document.id}`}
            </Text>
            {document.amount != null && (
              <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main, marginTop: theme.SPACING.xs }}>
                {formatCurrency(document.amount)}
              </Text>
            )}
          </Card>

          {/* Details */}
          <SectionHeader title="Informations" iconName="information-circle-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <InfoRow icon="calendar-outline" label="Date" value={formatDate(document.createdAt)} theme={theme} />
            {document.propertyName && (
              <InfoRow icon="home-outline" label="Propriete" value={document.propertyName} theme={theme} />
            )}
            {document.reservationCode && (
              <InfoRow icon="bookmark-outline" label="Reservation" value={document.reservationCode} theme={theme} />
            )}
            {document.guestName && (
              <InfoRow icon="person-outline" label="Voyageur" value={document.guestName} theme={theme} />
            )}
          </Card>

          {/* Actions */}
          <SectionHeader title="Actions" iconName="flash-outline" />
          <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
            <Button
              title="Voir le document"
              onPress={handleViewPdf}
              variant="contained"
              fullWidth
              icon={<Ionicons name="eye-outline" size={18} color="#fff" />}
            />
            <Button
              title="Telecharger PDF"
              onPress={handleDownload}
              variant="soft"
              fullWidth
              icon={<Ionicons name="download-outline" size={18} color={theme.colors.primary.main} />}
            />
            <Button
              title="Envoyer par email"
              onPress={handleSendEmail}
              variant="outlined"
              fullWidth
              loading={false}
              icon={<Ionicons name="mail-outline" size={18} color={theme.colors.primary.main} />}
            />
            {document.status !== 'PAID' && (
              <Button
                title="Marquer comme paye"
                onPress={handleMarkPaid}
                variant="soft"
                color="success"
                fullWidth
                loading={false}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success.main} />}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
