import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';

export interface MessageTemplate {
  id: number;
  title: string;
  content: string;
  category: TemplateCategory;
  language?: string;
  createdAt?: string;
}

export type TemplateCategory = 'CHECK_IN' | 'CHECK_OUT' | 'WELCOME' | 'REMINDER' | 'CUSTOM';

type RouteParams = {
  MessageTemplates: { onSelect?: (template: MessageTemplate) => void };
};

type FilterKey = 'all' | TemplateCategory;

const CATEGORY_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; badgeColor: 'primary' | 'success' | 'info' | 'warning' | 'secondary' }> = {
  CHECK_IN: { label: 'Check-in', icon: 'log-in-outline', color: '#059669', badgeColor: 'success' },
  CHECK_OUT: { label: 'Check-out', icon: 'log-out-outline', color: '#D97706', badgeColor: 'warning' },
  WELCOME: { label: 'Bienvenue', icon: 'happy-outline', color: '#3B82F6', badgeColor: 'info' },
  REMINDER: { label: 'Rappel', icon: 'alarm-outline', color: '#8B5CF6', badgeColor: 'secondary' },
  CUSTOM: { label: 'Personnalise', icon: 'create-outline', color: '#6B7280', badgeColor: 'primary' },
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'CHECK_IN', label: 'Check-in' },
  { key: 'CHECK_OUT', label: 'Check-out' },
  { key: 'WELCOME', label: 'Bienvenue' },
  { key: 'REMINDER', label: 'Rappel' },
  { key: 'CUSTOM', label: 'Personnalise' },
];

// Fallback templates when API is not available
const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 1,
    title: 'Instructions d\'arrivee',
    content: 'Bonjour {guest_name}, bienvenue ! Voici les instructions pour votre arrivee a {property_name}. Le check-in est possible a partir de {checkin_time}. Le code de la porte est : {door_code}.',
    category: 'CHECK_IN',
  },
  {
    id: 2,
    title: 'Rappel check-in',
    content: 'Bonjour {guest_name}, nous vous rappelons que votre check-in a {property_name} est prevu demain. N\'hesitez pas si vous avez des questions !',
    category: 'CHECK_IN',
  },
  {
    id: 3,
    title: 'Instructions de depart',
    content: 'Bonjour {guest_name}, nous esperons que votre sejour a ete agreable. Pour le check-out, merci de liberer le logement avant {checkout_time}. Laissez les cles sur la table.',
    category: 'CHECK_OUT',
  },
  {
    id: 4,
    title: 'Message de bienvenue',
    content: 'Bienvenue {guest_name} ! Nous sommes ravis de vous accueillir a {property_name}. N\'hesitez pas a nous contacter si vous avez besoin de quoi que ce soit. Bon sejour !',
    category: 'WELCOME',
  },
  {
    id: 5,
    title: 'Rappel reservation',
    content: 'Bonjour {guest_name}, votre reservation a {property_name} du {checkin_date} au {checkout_date} approche. Avez-vous des questions ?',
    category: 'REMINDER',
  },
  {
    id: 6,
    title: 'Remerciement post-sejour',
    content: 'Merci {guest_name} pour votre sejour a {property_name} ! Nous esperons que tout s\'est bien passe. N\'hesitez pas a laisser un avis, cela nous aide beaucoup.',
    category: 'CUSTOM',
  },
];

function TemplatesSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={80} height={34} borderRadius={20} />
        ))}
      </View>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={100} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

function TemplateCard({ template, onSelect }: { template: MessageTemplate; onSelect: (t: MessageTemplate) => void }) {
  const theme = useTheme();
  const catCfg = CATEGORY_CONFIG[template.category] ?? CATEGORY_CONFIG.CUSTOM;

  return (
    <Card onPress={() => onSelect(template)} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.SPACING.md }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: theme.BORDER_RADIUS.sm,
          backgroundColor: `${catCfg.color}10`,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}>
          <Ionicons name={catCfg.icon} size={18} color={catCfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary, flex: 1 }} numberOfLines={1}>
              {template.title}
            </Text>
            <Badge label={catCfg.label} color={catCfg.badgeColor} size="small" />
          </View>
          <Text
            style={{ ...theme.typography.caption, color: theme.colors.text.secondary, lineHeight: 18 }}
            numberOfLines={3}
          >
            {template.content}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function MessageTemplatesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'MessageTemplates'>>();
  const onSelect = route.params?.onSelect;
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      try {
        const result = await apiClient.get<{ content?: MessageTemplate[] } | MessageTemplate[]>('/message-templates');
        return Array.isArray(result) ? result : (result as any)?.content ?? DEFAULT_TEMPLATES;
      } catch {
        return DEFAULT_TEMPLATES;
      }
    },
  });

  const templates: MessageTemplate[] = data ?? DEFAULT_TEMPLATES;

  const filtered = useMemo(() => {
    if (filter === 'all') return templates;
    return templates.filter((t) => t.category === filter);
  }, [templates, filter]);

  const handleSelect = (template: MessageTemplate) => {
    if (onSelect) {
      onSelect(template);
    }
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Modeles</Text>
        </View>
        <TemplatesSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Modeles de messages
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.sm, paddingBottom: theme.SPACING.md }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} modele${filtered.length !== 1 ? 's' : ''}`}
          iconName="document-text-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="document-text-outline"
            title="Aucun modele"
            description="Aucun modele dans cette categorie"
            compact
          />
        ) : (
          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={handleSelect}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
