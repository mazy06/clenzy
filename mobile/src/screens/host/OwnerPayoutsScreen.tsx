/**
 * OwnerPayoutsScreen — Reversements proprietaires (mobile host).
 *
 * Differenciateur cle de Clenzy pour les conciergeries qui gerent les biens de
 * plusieurs proprietaires. Affiche les reversements en cours (PENDING/APPROVED),
 * verses (PAID), echoues (FAILED) et permet de filtrer.
 *
 * Aligne sur le pattern visuel de `BillingDashboardScreen` pour coherence UX.
 *
 * Roadmap suivante (non incluse ici) :
 *  - Detail page : `OwnerPayoutDetailScreen`
 *  - Genereration manuelle d'un payout (form modal)
 *  - Actions inline : approve / mark-as-paid / execute / retry
 *  - Filtre par proprietaire
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePayouts, usePendingPayoutSummary } from '@/hooks/usePayouts';
import {
  PAYOUT_STATUS_META,
  PAYOUT_METHOD_LABELS,
  type OwnerPayoutDto,
  type PayoutStatus,
} from '@/api/endpoints/payoutsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type FilterKey = 'all' | 'pending' | 'paid' | 'issues';

interface FilterDef {
  key: FilterKey;
  label: string;
  matches: (status: PayoutStatus) => boolean;
}

const FILTERS: FilterDef[] = [
  { key: 'all', label: 'Tous', matches: () => true },
  { key: 'pending', label: 'A verser', matches: (s) => s === 'PENDING' || s === 'APPROVED' || s === 'EXECUTING' },
  { key: 'paid', label: 'Verses', matches: (s) => s === 'PAID' },
  { key: 'issues', label: 'Problemes', matches: (s) => s === 'FAILED' || s === 'CANCELLED' },
];

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriod(periodStart: string, periodEnd: string): string {
  try {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const startStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} → ${endStr}`;
  } catch {
    return `${periodStart} → ${periodEnd}`;
  }
}

function PayoutsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton height={92} borderRadius={theme.BORDER_RADIUS.lg} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={84} height={34} borderRadius={20} />
        ))}
      </View>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={96} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

function PayoutCard({ payout, onPress }: { payout: OwnerPayoutDto; onPress: () => void }) {
  const theme = useTheme();
  const statusMeta = PAYOUT_STATUS_META[payout.status];
  const methodLabel = payout.payoutMethod ? PAYOUT_METHOD_LABELS[payout.payoutMethod] : 'Non defini';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.background.paper,
        borderRadius: theme.BORDER_RADIUS.lg,
        padding: theme.SPACING.md,
        opacity: pressed ? 0.85 : 1,
        ...theme.shadows.sm,
      })}
    >
      {/* Row 1: owner + amount */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.xs }}>
        <View style={{ flex: 1, marginRight: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }} numberOfLines={1}>
            {payout.ownerName ?? `Proprietaire #${payout.ownerId}`}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
            {formatPeriod(payout.periodStart, payout.periodEnd)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...theme.typography.h4, color: statusMeta.color, fontVariant: ['tabular-nums'] }}>
            {formatAmount(payout.netAmount)} €
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10, marginTop: 1 }}>
            net a verser
          </Text>
        </View>
      </View>

      {/* Row 2: status + method */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.SPACING.sm,
        paddingTop: theme.SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.light,
      }}>
        <Ionicons name={statusMeta.icon as IoniconsName} size={14} color={statusMeta.color} />
        <Text style={{ ...theme.typography.caption, color: statusMeta.color, marginLeft: 4, fontWeight: '600' }}>
          {statusMeta.label}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginLeft: theme.SPACING.sm }}>
          · {methodLabel}
        </Text>
        {payout.retryCount > 0 && (
          <Text style={{ ...theme.typography.caption, color: '#D97706', marginLeft: theme.SPACING.sm, fontSize: 10 }}>
            · {payout.retryCount} tentative(s)
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={14} color={theme.colors.text.disabled} />
      </View>

      {/* Optional failure reason */}
      {payout.failureReason && (
        <Text style={{
          ...theme.typography.caption,
          color: '#EF4444',
          marginTop: theme.SPACING.xs,
          fontStyle: 'italic',
          fontSize: 11,
        }} numberOfLines={2}>
          {payout.failureReason}
        </Text>
      )}
    </Pressable>
  );
}

function FloatingActionButton({ onPress, theme }: { onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        bottom: theme.SPACING.lg,
        right: theme.SPACING.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary.main,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      })}
      hitSlop={12}
      accessibilityLabel="Nouveau reversement"
    >
      <Ionicons name="add" size={28} color={theme.colors.primary.contrastText} />
    </Pressable>
  );
}

export function OwnerPayoutsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: payouts, isLoading: payoutsLoading, isRefetching, refetch } = usePayouts();
  const { data: summary, isLoading: summaryLoading } = usePendingPayoutSummary();

  const isLoading = payoutsLoading || summaryLoading;
  const allPayouts: OwnerPayoutDto[] = payouts ?? [];

  const filtered = useMemo(() => {
    const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    return [...allPayouts]
      .filter((p) => activeFilter.matches(p.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allPayouts, filter]);

  const countsByFilter = useMemo(() => {
    const result: Record<FilterKey, number> = { all: 0, pending: 0, paid: 0, issues: 0 };
    for (const p of allPayouts) {
      for (const f of FILTERS) {
        if (f.matches(p.status)) result[f.key] += 1;
      }
    }
    return result;
  }, [allPayouts]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <ScreenHeader
          theme={theme}
          title="Reversements"
          onBack={() => navigation.goBack()}
        />
        <PayoutsSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScreenHeader
        theme={theme}
        title="Reversements"
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'stats-chart-outline',
          onPress: () => navigation.navigate('PayoutStats'),
          accessibilityLabel: 'Statistiques des reversements',
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.SPACING['2xl'] }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
      >
        {/* Summary card "A verser" */}
        <View style={{ paddingHorizontal: theme.SPACING.lg, marginTop: theme.SPACING.md }}>
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            ...theme.shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.xs }}>
              <Ionicons name="cash-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                A verser ce mois
              </Text>
            </View>
            <Text style={{ ...theme.typography.h2, color: '#D97706', fontVariant: ['tabular-nums'] }}>
              {formatAmount(summary?.totalPendingAmount ?? 0)} €
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 4 }}>
              {summary?.pendingCount ?? 0} reversement{(summary?.pendingCount ?? 0) > 1 ? 's' : ''} en attente
            </Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md, gap: theme.SPACING.xs }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = countsByFilter[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: theme.SPACING.md,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: active ? theme.colors.primary.main : theme.colors.background.paper,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary.main : theme.colors.border.light,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{
                  ...theme.typography.caption,
                  color: active ? theme.colors.primary.contrastText : theme.colors.text.primary,
                  fontWeight: '600',
                }}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <Text style={{
                    ...theme.typography.caption,
                    color: active ? theme.colors.primary.contrastText : theme.colors.text.secondary,
                    fontSize: 11,
                    fontVariant: ['tabular-nums'],
                  }}>
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* List */}
        <View style={{ paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.sm }}>
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: theme.SPACING['2xl'] }}>
              <EmptyState
                icon="cash-outline"
                title={filter === 'all' ? "Aucun reversement" : "Aucun resultat"}
                description={filter === 'all'
                  ? "Les reversements aux proprietaires apparaitront ici une fois generes."
                  : "Aucun reversement ne correspond a ce filtre."}
              />
            </View>
          ) : (
            filtered.map((payout) => (
              <PayoutCard
                key={payout.id}
                payout={payout}
                onPress={() => navigation.navigate('OwnerPayoutDetail', { id: payout.id })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <FloatingActionButton
        theme={theme}
        onPress={() => navigation.navigate('GeneratePayout')}
      />
    </SafeAreaView>
  );
}

function ScreenHeader({
  theme,
  title,
  onBack,
  rightAction,
}: {
  theme: ReturnType<typeof useTheme>;
  title: string;
  onBack: () => void;
  rightAction?: { icon: IoniconsName; onPress: () => void; accessibilityLabel: string };
}) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.lg,
      paddingTop: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
    }}>
      <Pressable
        onPress={onBack}
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
        {title}
      </Text>
      {rightAction && (
        <Pressable
          onPress={rightAction.onPress}
          hitSlop={8}
          accessibilityLabel={rightAction.accessibilityLabel}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={rightAction.icon} size={20} color={theme.colors.primary.main} />
        </Pressable>
      )}
    </View>
  );
}
