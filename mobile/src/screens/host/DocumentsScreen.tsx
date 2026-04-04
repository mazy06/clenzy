import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '@/hooks/useDocuments';
import type { DocumentListItem } from '@/api/endpoints/documentsApi';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type FilterType = 'all' | 'FACTURE' | 'CONTRAT' | 'RECU' | 'ATTESTATION';

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'FACTURE', label: 'Factures' },
  { key: 'CONTRAT', label: 'Contrats' },
  { key: 'RECU', label: 'Recus' },
  { key: 'ATTESTATION', label: 'Attestations' },
];

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

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function DocumentRow({ doc, theme, onPress }: {
  doc: DocumentListItem;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const typeConf = DOC_TYPE_CONFIG[doc.type] ?? { icon: 'document-outline', color: '#607D8B', label: doc.type };
  const statusConf = STATUS_CONFIG[doc.status] ?? { label: doc.status, color: 'info' as const };

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Icon */}
        <View style={{
          width: 44, height: 44, borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${typeConf.color}14`,
          alignItems: 'center', justifyContent: 'center',
          marginRight: theme.SPACING.md,
        }}>
          <Ionicons name={typeConf.icon} size={22} color={typeConf.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.xs, marginBottom: 2 }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {doc.title}
            </Text>
            <Badge label={statusConf.label} color={statusConf.color} size="small" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              {typeConf.label}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatDateShort(doc.createdAt)}
            </Text>
            {doc.propertyName && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }} numberOfLines={1}>
                {doc.propertyName}
              </Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} style={{ marginLeft: theme.SPACING.sm }} />
      </View>
    </Card>
  );
}

function ListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ gap: theme.SPACING.sm }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: theme.SPACING.lg }}>
          <Skeleton width={44} height={44} borderRadius={theme.BORDER_RADIUS.md} />
          <View style={{ flex: 1, marginLeft: theme.SPACING.md, gap: 6 }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={12} width="50%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DocumentsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isRefetching, refetch } = useDocuments();

  const documents = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const filtered = activeFilter === 'all' ? list : list.filter((d) => d.type === activeFilter);
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.propertyName?.toLowerCase().includes(q) ||
        d.guestName?.toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
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
          Documents
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.md }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.md,
          paddingHorizontal: theme.SPACING.md,
          ...theme.shadows.xs,
        }}>
          <Ionicons name="search-outline" size={18} color={theme.colors.text.disabled} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un document..."
            placeholderTextColor={theme.colors.text.disabled}
            style={{
              ...theme.typography.body2,
              color: theme.colors.text.primary,
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: theme.SPACING.sm,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.disabled} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <View style={{ height: 44, marginBottom: theme.SPACING.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.SPACING.lg,
            alignItems: 'center',
          }}
        >
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  marginRight: theme.SPACING.xs,
                  borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: isActive ? theme.colors.primary.main : theme.colors.background.paper,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: theme.colors.border.light,
                }}
              >
              <Text style={{
                ...theme.typography.caption,
                fontWeight: '600',
                color: isActive ? theme.colors.primary.contrastText : theme.colors.text.secondary,
              }}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>

      {/* Document list */}
      {isLoading ? (
        <ListSkeleton theme={theme} />
      ) : documents.length === 0 ? (
        <EmptyState
          iconName="document-outline"
          title="Aucun document"
          description={activeFilter !== 'all'
            ? 'Aucun document ne correspond a ce filtre.'
            : 'Vos factures, contrats et recus apparaitront ici.'}
          actionLabel="Generer un document"
          onAction={() => navigation.navigate('DocumentGenerate')}
        />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
          }
          renderItem={({ item }) => (
            <DocumentRow
              doc={item}
              theme={theme}
              onPress={() => navigation.navigate('DocumentDetail', { documentId: item.id, document: item.kind === 'generation' ? { id: item.id, documentType: item.type, status: item.status, amount: item.amount, propertyName: item.propertyName, guestName: item.guestName, createdAt: item.createdAt, legalNumber: item.title, fileName: item.title } : undefined })}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => navigation.navigate('DocumentGenerate')}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 100,
          right: theme.SPACING.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          transform: pressed ? [{ scale: 0.95 }] : [],
          ...theme.shadows.lg,
        })}
      >
        <Ionicons name="add" size={28} color={theme.colors.primary.contrastText} />
      </Pressable>
    </SafeAreaView>
  );
}
