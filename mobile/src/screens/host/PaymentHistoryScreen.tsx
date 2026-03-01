import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { usePaymentHistory, usePaymentSummary } from '@/hooks/usePayments';
import type { PaymentRecord } from '@/api/endpoints/paymentsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type FilterKey = 'all' | 'PAID' | 'PENDING' | 'REFUNDED';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'PAID', label: 'Payes' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'REFUNDED', label: 'Rembourses' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  PAID: { label: 'Paye', color: '#059669', icon: 'checkmark-circle' },
  PENDING: { label: 'En attente', color: '#D97706', icon: 'time-outline' },
  PROCESSING: { label: 'En cours', color: '#3B82F6', icon: 'sync-outline' },
  FAILED: { label: 'Echoue', color: '#EF4444', icon: 'close-circle' },
  REFUNDED: { label: 'Rembourse', color: '#4A7C8E', icon: 'arrow-undo-outline' },
  CANCELLED: { label: 'Annule', color: '#6B7280', icon: 'ban-outline' },
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PaymentHistorySkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={28} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width="31%" height={70} borderRadius={theme.BORDER_RADIUS.lg} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={70} height={34} borderRadius={20} />
        ))}
      </View>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={90} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

export function PaymentHistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: historyData, isLoading: historyLoading, isRefetching, refetch } = usePaymentHistory({ size: '500' });
  const { data: summary, isLoading: summaryLoading } = usePaymentSummary();

  const allPayments: PaymentRecord[] = historyData?.content ?? [];

  const filtered = useMemo(() => {
    let list = [...allPayments];

    if (filter !== 'all') {
      if (filter === 'PENDING') {
        list = list.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
      } else if (filter === 'REFUNDED') {
        list = list.filter((p) => p.status === 'REFUNDED' || p.status === 'CANCELLED');
      } else {
        list = list.filter((p) => p.status === filter);
      }
    }

    // Most recent first
    list.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return list;
  }, [allPayments, filter]);

  const isLoading = historyLoading || summaryLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <PaymentHistorySkeleton theme={theme} />
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
          Paiements
        </Text>
      </View>

      {/* Summary cards */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginBottom: 4 }} />
          <Text style={{ ...theme.typography.h4, color: '#059669' }}>
            {formatAmount(summary?.totalPaid ?? 0)}€
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>Payes</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginBottom: 4 }} />
          <Text style={{ ...theme.typography.h4, color: '#D97706' }}>
            {formatAmount(summary?.totalPending ?? 0)}€
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>En attente</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Ionicons name="arrow-undo-outline" size={18} color="#4A7C8E" style={{ marginBottom: 4 }} />
          <Text style={{ ...theme.typography.h4, color: '#4A7C8E' }}>
            {formatAmount(summary?.totalRefunded ?? 0)}€
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>Rembourses</Text>
        </View>
      </View>

      {/* Transaction count */}
      <View style={{
        paddingHorizontal: theme.SPACING.lg,
        marginBottom: theme.SPACING.md,
      }}>
        <Card variant="filled" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
          <Ionicons name="receipt-outline" size={16} color={theme.colors.primary.main} style={{ marginRight: theme.SPACING.sm }} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
            {summary?.transactionCount ?? 0} transaction{(summary?.transactionCount ?? 0) > 1 ? 's' : ''} au total
          </Text>
        </Card>
      </View>

      {/* Filter chips */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {/* Payment list */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.SPACING.lg,
          paddingBottom: 120,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} paiement${filtered.length > 1 ? 's' : ''}`}
          iconName="card-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="card-outline"
            title="Aucun paiement"
            description={
              filter === 'PAID'
                ? 'Aucun paiement effectue'
                : filter === 'PENDING'
                  ? 'Aucun paiement en attente'
                  : filter === 'REFUNDED'
                    ? 'Aucun remboursement'
                    : 'Aucun paiement trouve'
            }
            compact
          />
        ) : (
          filtered.map((payment) => {
            const config = STATUS_CONFIG[payment.status] ?? {
              label: payment.status,
              color: theme.colors.text.disabled,
              icon: 'help-circle-outline' as IoniconsName,
            };

            return (
              <Card key={payment.id} style={{ marginBottom: theme.SPACING.md }}>
                {/* Top row: icon + title + amount */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: `${config.color}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: theme.SPACING.sm,
                  }}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                  </View>

                  <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
                    <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }} numberOfLines={1}>
                      {payment.interventionTitle}
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }} numberOfLines={1}>
                      {payment.propertyName}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      ...theme.typography.h4,
                      color: payment.status === 'REFUNDED' ? '#4A7C8E' : payment.status === 'PAID' ? '#059669' : theme.colors.text.primary,
                      fontSize: 16,
                    }}>
                      {payment.status === 'REFUNDED' ? '-' : ''}{formatAmount(payment.amount)}€
                    </Text>
                  </View>
                </View>

                {/* Bottom row: status badge + date + pay button */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: theme.SPACING.sm,
                  paddingTop: theme.SPACING.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border.light,
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${config.color}14`,
                  }}>
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: config.color,
                      marginRight: 6,
                    }} />
                    <Text style={{ ...theme.typography.caption, color: config.color, fontWeight: '700', fontSize: 11 }}>
                      {config.label}
                    </Text>
                  </View>

                  {(payment.status === 'PENDING' || payment.status === 'PROCESSING') ? (
                    <Pressable
                      onPress={() => navigation.navigate('Dashboard', {
                        screen: 'PaymentCheckout',
                        params: { interventionId: payment.interventionId },
                      })}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderRadius: theme.BORDER_RADIUS.full,
                        backgroundColor: pressed ? `${theme.colors.primary.main}CC` : theme.colors.primary.main,
                        gap: 4,
                      })}
                    >
                      <Ionicons name="card-outline" size={14} color="#FFFFFF" />
                      <Text style={{ ...theme.typography.caption, color: '#FFFFFF', fontWeight: '700', fontSize: 11 }}>
                        Payer
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                      {formatDate(payment.transactionDate)}
                    </Text>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
