import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import {
  housekeeperPayoutsApi,
  type PayoutRecord,
  type PayoutStatus,
} from '@/api/endpoints/housekeeperPayoutsApi';

// ─── « Mes versements » mobile (Moteur Ménage 4B) ────────────────────────────
// Historique des versements de missions + onboarding Stripe Connect Express.
// Les composants embarqués @stripe/connect-js étant WEB-ONLY, l'onboarding
// mobile passe par un AccountLink hébergé ouvert dans un navigateur in-app
// (expo-web-browser, même pattern que useStripeCheckout) ; au retour, l'écran
// re-synchronise le statut via /refresh-status.

const PAYOUTS_KEY = ['housekeeper-payouts', 'me'];

export function MyPayoutsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER') ?? false;

  const payoutsQuery = useQuery({ queryKey: PAYOUTS_KEY, queryFn: () => housekeeperPayoutsApi.getMy() });

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const { url } = await housekeeperPayoutsApi.createOnboardingLink();
      // Navigateur in-app : revient ici à la fermeture (return_url Stripe ou geste user).
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      // Au retour : re-synchronise le statut d'onboarding depuis Stripe.
      return housekeeperPayoutsApi.refreshStatus();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PAYOUTS_KEY, data);
    },
  });

  const openMission = useCallback((interventionId: number) => {
    // CTA preuve manquante : le détail mission (photos) vit dans le stack
    // « Aujourd'hui » du housekeeper. Pas d'équivalent technicien (payout ménage).
    navigation.navigate('Today', { screen: 'CleaningChecklist', params: { interventionId } });
  }, [navigation]);

  const statusColor = (status: PayoutStatus): string => {
    switch (status) {
      case 'SENT': return theme.colors.success.main;
      case 'PENDING': return theme.colors.warning.main;
      case 'FAILED': return theme.colors.error.main;
      case 'BLOCKED': default: return theme.colors.text.secondary;
    }
  };

  const reasonLabel = (reason: string | null): string | null => {
    if (!reason) return null;
    if (reason === 'PROOF_MISSING') return t('myPayouts.reason.proofMissing');
    if (reason === 'ONBOARDING_INCOMPLETE') return t('myPayouts.reason.onboardingIncomplete');
    return reason;
  };

  const data = payoutsQuery.data;
  const onboardingState: 'none' | 'inProgress' | 'complete' =
    data?.onboardingCompleted ? 'complete' : data?.accountCreated ? 'inProgress' : 'none';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={payoutsQuery.isRefetching} onRefresh={() => payoutsQuery.refetch()} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{t('myPayouts.title')}</Text>
        </View>

        {payoutsQuery.isLoading && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{t('common.loading')}</Text>
        )}
        {payoutsQuery.isError && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.error.main }}>{t('myPayouts.loadError')}</Text>
          </Card>
        )}

        {data && (
          <>
            {/* ── Compte de versement (onboarding) ── */}
            <Card style={{ marginBottom: theme.SPACING.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.sm }}>
                <Ionicons
                  name={onboardingState === 'complete' ? 'checkmark-circle' : 'card-outline'}
                  size={22}
                  color={onboardingState === 'complete' ? theme.colors.success.main : theme.colors.primary.main}
                />
                <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }}>
                  {t('myPayouts.accountSection')}
                </Text>
              </View>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.md }}>
                {onboardingState === 'complete'
                  ? t('myPayouts.accountComplete')
                  : onboardingState === 'inProgress'
                    ? t('myPayouts.accountInProgress')
                    : t('myPayouts.accountNone')}
              </Text>
              {onboardingState !== 'complete' && (
                <Button
                  title={onboardingState === 'inProgress' ? t('myPayouts.resumeOnboarding') : t('myPayouts.startOnboarding')}
                  onPress={() => onboardingMutation.mutate()}
                  loading={onboardingMutation.isPending}
                  fullWidth
                />
              )}
              {onboardingMutation.isError && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, marginTop: theme.SPACING.sm }}>
                  {t('myPayouts.onboardingError')}
                </Text>
              )}
            </Card>

            {/* ── Historique ── */}
            <Card>
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
                {t('myPayouts.historySection')}
              </Text>
              {data.records.length === 0 ? (
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, fontStyle: 'italic' }}>
                  {t('myPayouts.noPayouts')}
                </Text>
              ) : (
                data.records.map((record: PayoutRecord, index: number) => (
                  <View
                    key={record.id}
                    style={{
                      paddingVertical: theme.SPACING.sm,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: theme.colors.border.light,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>
                        {t('myPayouts.mission', { id: record.interventionId })}
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, fontVariant: ['tabular-nums'] }}>
                        {record.amount} €
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={{
                        borderRadius: 7,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        backgroundColor: `${statusColor(record.status)}1F`,
                      }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: statusColor(record.status) }}>
                          {t(`myPayouts.status.${record.status}`)}
                        </Text>
                      </View>
                      {record.status === 'BLOCKED' && reasonLabel(record.failureReason) && (
                        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                          {reasonLabel(record.failureReason)}
                        </Text>
                      )}
                      {record.commissionAmount > 0 && (
                        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontVariant: ['tabular-nums'] }}>
                          {t('myPayouts.commission', { amount: record.commissionAmount })}
                        </Text>
                      )}
                      {record.createdAt && (
                        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                          {new Date(record.createdAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    {record.status === 'BLOCKED' && record.failureReason === 'PROOF_MISSING' && isHousekeeper && (
                      <Pressable onPress={() => openMission(record.interventionId)} style={{ marginTop: 6 }}>
                        <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.primary.main }}>
                          {t('myPayouts.completeMission')}
                        </Text>
                      </Pressable>
                    )}
                    {record.status === 'BLOCKED' && record.failureReason === 'ONBOARDING_INCOMPLETE' && onboardingState !== 'complete' && (
                      <Pressable onPress={() => onboardingMutation.mutate()} style={{ marginTop: 6 }}>
                        <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.primary.main }}>
                          {t('myPayouts.finishOnboarding')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
