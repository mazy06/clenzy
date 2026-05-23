/**
 * PayoutStatsScreen — Tableau de bord statistiques des reversements.
 *
 * Aggregations 100% cote client (pas d'endpoint dedie) :
 *  - Total verse YTD (annee en cours)
 *  - Total verse 12 derniers mois
 *  - Top 5 proprietaires par montant cumule
 *  - Repartition par methode de versement (donut implicite via liste)
 *  - Evolution mensuelle (bar chart 12 mois)
 *
 * Argument de vente conciergerie : "Montre a tes proprietaires ce que tu leur as
 * verse cette annee — clic sur leur nom = relevé envoyé par email."
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePayouts } from '@/hooks/usePayouts';
import {
  PAYOUT_METHOD_LABELS,
  type OwnerPayoutDto,
  type PayoutMethod,
} from '@/api/endpoints/payoutsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatAmountFull(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

interface OwnerAggregate {
  ownerId: number;
  ownerName: string;
  totalPaid: number;
  payoutCount: number;
}

interface MethodAggregate {
  method: PayoutMethod | 'UNDEFINED';
  totalPaid: number;
  count: number;
}

interface MonthBucket {
  monthIndex: number; // 0-11
  total: number;
}

export function PayoutStatsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  // On charge tous les payouts (cap raisonnable pour mobile)
  const { data: payouts, isLoading, isRefetching, refetch } = usePayouts();

  const stats = useMemo(() => {
    const all: OwnerPayoutDto[] = payouts ?? [];
    const paid = all.filter((p) => p.status === 'PAID');

    const now = new Date();
    const currentYear = now.getFullYear();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // ─── Totals ─────────────────────────────────────────────────────────────
    const ytdTotal = paid
      .filter((p) => p.paidAt && new Date(p.paidAt).getFullYear() === currentYear)
      .reduce((sum, p) => sum + p.netAmount, 0);

    const last12mTotal = paid
      .filter((p) => p.paidAt && new Date(p.paidAt).getTime() >= twelveMonthsAgo.getTime())
      .reduce((sum, p) => sum + p.netAmount, 0);

    const ytdCount = paid.filter((p) => p.paidAt && new Date(p.paidAt).getFullYear() === currentYear).length;

    const allTimeTotal = paid.reduce((sum, p) => sum + p.netAmount, 0);

    // ─── Top owners ─────────────────────────────────────────────────────────
    const ownerMap = new Map<number, OwnerAggregate>();
    for (const p of paid) {
      const existing = ownerMap.get(p.ownerId);
      if (existing) {
        existing.totalPaid += p.netAmount;
        existing.payoutCount += 1;
      } else {
        ownerMap.set(p.ownerId, {
          ownerId: p.ownerId,
          ownerName: p.ownerName ?? `Proprietaire #${p.ownerId}`,
          totalPaid: p.netAmount,
          payoutCount: 1,
        });
      }
    }
    const topOwners = Array.from(ownerMap.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 5);

    // ─── Methods breakdown ──────────────────────────────────────────────────
    const methodMap = new Map<PayoutMethod | 'UNDEFINED', MethodAggregate>();
    for (const p of paid) {
      const key = (p.payoutMethod ?? 'UNDEFINED') as PayoutMethod | 'UNDEFINED';
      const existing = methodMap.get(key);
      if (existing) {
        existing.totalPaid += p.netAmount;
        existing.count += 1;
      } else {
        methodMap.set(key, { method: key, totalPaid: p.netAmount, count: 1 });
      }
    }
    const methods = Array.from(methodMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

    // ─── Monthly evolution (12 derniers mois glissants) ─────────────────────
    const monthBuckets: MonthBucket[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({ monthIndex: d.getMonth(), total: 0 });
    }
    for (const p of paid) {
      if (!p.paidAt) continue;
      const paidDate = new Date(p.paidAt);
      const monthsAgo = (now.getFullYear() - paidDate.getFullYear()) * 12 + (now.getMonth() - paidDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo <= 11) {
        monthBuckets[11 - monthsAgo].total += p.netAmount;
      }
    }

    return { ytdTotal, last12mTotal, ytdCount, allTimeTotal, topOwners, methods, monthBuckets, paidCount: paid.length };
  }, [payouts]);

  const isEmpty = !isLoading && stats.paidCount === 0;

  // Chart data prep
  const maxMonthTotal = Math.max(...stats.monthBuckets.map((m) => m.total), 1);
  const barData = stats.monthBuckets.map((m, idx) => ({
    value: m.total,
    label: MONTH_LABELS[m.monthIndex],
    frontColor: idx === stats.monthBuckets.length - 1 ? theme.colors.primary.main : '#94B3C0',
    topLabelComponent: () => null,
  }));

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
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Statistiques reversements
        </Text>
      </View>

      {isLoading ? (
        <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
          <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={180} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={240} borderRadius={theme.BORDER_RADIUS.lg} />
        </View>
      ) : isEmpty ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.SPACING.lg }}>
          <EmptyState
            icon="stats-chart-outline"
            title="Aucun reversement verse"
            description="Une fois les premiers reversements payes, les statistiques apparaitront ici."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.SPACING.lg, gap: theme.SPACING.md, paddingBottom: theme.SPACING['2xl'] }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        >
          {/* Hero card — YTD */}
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            ...theme.shadows.sm,
          }}>
            <Text style={{
              ...theme.typography.caption,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}>
              Total verse cette annee
            </Text>
            <Text style={{
              fontSize: 38,
              fontWeight: '800',
              color: theme.colors.primary.main,
              fontVariant: ['tabular-nums'],
              lineHeight: 44,
            }}>
              {formatAmountFull(stats.ytdTotal)} €
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 6 }}>
              {stats.ytdCount} reversement{stats.ytdCount > 1 ? 's' : ''} effectue{stats.ytdCount > 1 ? 's' : ''} en {new Date().getFullYear()}
            </Text>

            {/* Sub-stats */}
            <View style={{
              flexDirection: 'row',
              marginTop: theme.SPACING.md,
              paddingTop: theme.SPACING.md,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border.light,
              gap: theme.SPACING.md,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
                  12 DERNIERS MOIS
                </Text>
                <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {formatAmount(stats.last12mTotal)} €
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
                  CUMUL TOTAL
                </Text>
                <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {formatAmount(stats.allTimeTotal)} €
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly evolution chart */}
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            ...theme.shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
              <Ionicons name="bar-chart-outline" size={16} color={theme.colors.text.secondary} />
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 6,
              }}>
                Evolution mensuelle
              </Text>
            </View>

            <BarChart
              data={barData}
              width={SCREEN_WIDTH - theme.SPACING.lg * 4}
              height={160}
              barWidth={16}
              spacing={(SCREEN_WIDTH - theme.SPACING.lg * 4 - 12 * 16) / 11}
              barBorderRadius={3}
              noOfSections={4}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={theme.colors.border.light}
              yAxisTextStyle={{ color: theme.colors.text.secondary, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: theme.colors.text.secondary, fontSize: 9 }}
              yAxisLabelWidth={0}
              hideYAxisText
              maxValue={maxMonthTotal * 1.1}
              isAnimated
              animationDuration={500}
            />

            <Text style={{
              ...theme.typography.caption,
              color: theme.colors.text.secondary,
              marginTop: theme.SPACING.sm,
              fontSize: 11,
              textAlign: 'center',
            }}>
              Mois en cours en {theme.colors.primary.main === '#6B8A9A' ? 'bleu' : 'couleur primaire'}
            </Text>
          </View>

          {/* Top 5 owners */}
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            ...theme.shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
              <Ionicons name="trophy-outline" size={16} color={theme.colors.text.secondary} />
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 6,
              }}>
                Top 5 proprietaires
              </Text>
            </View>

            {stats.topOwners.length === 0 ? (
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center', paddingVertical: theme.SPACING.md }}>
                Aucun reversement verse
              </Text>
            ) : (
              <View style={{ gap: theme.SPACING.sm }}>
                {stats.topOwners.map((owner, idx) => {
                  const percent = stats.allTimeTotal > 0 ? (owner.totalPaid / stats.allTimeTotal) * 100 : 0;
                  return (
                    <View key={owner.ownerId}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{
                          ...theme.typography.caption,
                          color: idx === 0 ? '#D4A574' : theme.colors.text.secondary,
                          fontWeight: '800',
                          width: 22,
                        }}>
                          {idx + 1}
                        </Text>
                        <Text style={{
                          ...theme.typography.body2,
                          color: theme.colors.text.primary,
                          flex: 1,
                          fontWeight: '600',
                        }} numberOfLines={1}>
                          {owner.ownerName}
                        </Text>
                        <Text style={{
                          ...theme.typography.body2,
                          color: theme.colors.text.primary,
                          fontWeight: '700',
                          fontVariant: ['tabular-nums'],
                        }}>
                          {formatAmount(owner.totalPaid)} €
                        </Text>
                      </View>
                      <View style={{
                        height: 5,
                        backgroundColor: theme.colors.border.light,
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginLeft: 22,
                      }}>
                        <View style={{
                          height: '100%',
                          width: `${percent}%`,
                          backgroundColor: idx === 0 ? '#D4A574' : theme.colors.primary.main,
                          borderRadius: 3,
                        }} />
                      </View>
                      <Text style={{
                        ...theme.typography.caption,
                        color: theme.colors.text.secondary,
                        fontSize: 10,
                        marginLeft: 22,
                        marginTop: 2,
                      }}>
                        {owner.payoutCount} versement{owner.payoutCount > 1 ? 's' : ''} · {percent.toFixed(1)}% du cumul
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Methods breakdown */}
          {stats.methods.length > 0 && (
            <View style={{
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.lg,
              padding: theme.SPACING.lg,
              ...theme.shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
                <Ionicons name="card-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={{
                  ...theme.typography.caption,
                  color: theme.colors.text.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginLeft: 6,
                }}>
                  Repartition par methode
                </Text>
              </View>

              {stats.methods.map((m, idx) => {
                const label = m.method === 'UNDEFINED' ? 'Non defini' : PAYOUT_METHOD_LABELS[m.method as PayoutMethod];
                const iconByMethod: Record<string, IoniconsName> = {
                  STRIPE_CONNECT: 'card-outline',
                  WISE: 'globe-outline',
                  OPEN_BANKING: 'shield-checkmark-outline',
                  SEPA_TRANSFER: 'document-text-outline',
                  MANUAL: 'create-outline',
                  UNDEFINED: 'help-circle-outline',
                };
                const colorByMethod: Record<string, string> = {
                  STRIPE_CONNECT: '#635BFF',
                  WISE: '#163300',
                  OPEN_BANKING: '#4A9B8E',
                  SEPA_TRANSFER: '#D97706',
                  MANUAL: '#6B7280',
                  UNDEFINED: '#94A3B8',
                };
                const icon = iconByMethod[m.method] || 'card-outline';
                const color = colorByMethod[m.method] || '#94A3B8';

                return (
                  <View
                    key={m.method}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: theme.SPACING.sm,
                      borderBottomWidth: idx < stats.methods.length - 1 ? 1 : 0,
                      borderBottomColor: theme.colors.border.light,
                    }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: `${color}1A`,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: theme.SPACING.md,
                    }}>
                      <Ionicons name={icon} size={16} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                        {label}
                      </Text>
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 11 }}>
                        {m.count} versement{m.count > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={{
                      ...theme.typography.body1,
                      color: theme.colors.text.primary,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {formatAmount(m.totalPaid)} €
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
