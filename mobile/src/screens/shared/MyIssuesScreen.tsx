import React from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme';
import { issuesApi, type Issue, type IssueStatus } from '@/api/endpoints/issuesApi';

// ─── « Mes signalements » mobile (Moteur Ménage 4B) — lecture seule ──────────
// Suivi des anomalies signalées par CE pro (GET /issues?mine=true) : statut de
// qualification, coût suggéré si chiffré. La qualification reste côté gestion.

const MY_ISSUES_KEY = ['issues', 'mine'];

export function MyIssuesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const issuesQuery = useQuery({ queryKey: MY_ISSUES_KEY, queryFn: () => issuesApi.listMine() });

  const statusColor = (status: IssueStatus): string => {
    switch (status) {
      case 'OPEN': return theme.colors.warning.main;
      case 'QUALIFIED': return theme.colors.primary.main;
      case 'CONVERTED': return theme.colors.success.main;
      case 'DISMISSED': default: return theme.colors.text.secondary;
    }
  };

  const issues = issuesQuery.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={issuesQuery.isRefetching} onRefresh={() => issuesQuery.refetch()} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{t('myIssues.title')}</Text>
        </View>

        {issuesQuery.isLoading && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{t('common.loading')}</Text>
        )}
        {issuesQuery.isError && (
          <Card>
            <Text style={{ ...theme.typography.body2, color: theme.colors.error.main }}>{t('myIssues.loadError')}</Text>
          </Card>
        )}

        {!issuesQuery.isLoading && !issuesQuery.isError && issues.length === 0 && (
          <EmptyState
            iconName="checkmark-done-outline"
            title={t('myIssues.emptyTitle')}
            description={t('myIssues.emptyDescription')}
          />
        )}

        {issues.map((issue: Issue) => (
          <Card key={issue.id} style={{ marginBottom: theme.SPACING.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.SPACING.sm }}>
              <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary, flex: 1 }} numberOfLines={2}>
                {issue.title}
              </Text>
              <View style={{
                borderRadius: 7,
                paddingHorizontal: 7,
                paddingVertical: 2,
                backgroundColor: `${statusColor(issue.status)}1F`,
              }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: statusColor(issue.status) }}>
                  {t(`myIssues.status.${issue.status}`)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginTop: 4, flexWrap: 'wrap' }}>
              {issue.propertyName != null && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {issue.propertyName}
                </Text>
              )}
              {issue.suggestedCost != null && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontVariant: ['tabular-nums'] }}>
                  {t('myIssues.suggestedCost', { amount: issue.suggestedCost })}
                </Text>
              )}
              {issue.createdAt && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  {new Date(issue.createdAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
