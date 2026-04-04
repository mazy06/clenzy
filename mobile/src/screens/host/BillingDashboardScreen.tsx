import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { usePaymentHistory, usePaymentSummary } from '@/hooks/usePayments';
import type { PaymentRecord } from '@/api/endpoints/paymentsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type FilterKey = 'all' | 'PAID' | 'PENDING' | 'REFUNDED';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'PAID', label: 'Paiements' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'REFUNDED', label: 'Remboursements' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName; badgeColor: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  PAID: { label: 'Paye', color: '#059669', icon: 'checkmark-circle', badgeColor: 'success' },
  PENDING: { label: 'En attente', color: '#D97706', icon: 'time-outline', badgeColor: 'warning' },
  PROCESSING: { label: 'En cours', color: '#3B82F6', icon: 'sync-outline', badgeColor: 'info' },
  FAILED: { label: 'Echoue', color: '#EF4444', icon: 'close-circle', badgeColor: 'error' },
  REFUNDED: { label: 'Rembourse', color: '#4A7C8E', icon: 'arrow-undo-outline', badgeColor: 'info' },
  CANCELLED: { label: 'Annule', color: '#6B7280', icon: 'ban-outline', badgeColor: 'neutral' },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getAmountColor(status: string): string {
  if (status === 'PAID' || status === 'PROCESSING') return '#059669';
  if (status === 'PENDING') return '#D97706';
  if (status === 'REFUNDED') return '#EF4444';
  return '#6B7280';
}

function BillingSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2].map((i) => (
          <Skeleton key={i} width="48%" height={90} borderRadius={theme.BORDER_RADIUS.lg} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[3, 4].map((i) => (
          <Skeleton key={i} width="48%" height={90} borderRadius={theme.BORDER_RADIUS.lg} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={80} height={34} borderRadius={20} />
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

function TransactionCard({ payment, onPress }: { payment: PaymentRecord; onPress: () => void }) {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.PENDING;
  const amountColor = getAmountColor(payment.status);
  const isRefund = payment.status === 'REFUNDED';

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${statusCfg.color}10`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={statusCfg.icon} size={20} color={statusCfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}
            numberOfLines={1}
          >
            {payment.interventionTitle || `Transaction #${payment.id}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatDate(payment.transactionDate)}
            </Text>
            {payment.propertyName && (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.text.disabled }} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }} numberOfLines={1}>
                  {payment.propertyName}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...theme.typography.body1, fontWeight: '700', color: amountColor }}>
            {isRefund ? '-' : ''}{formatAmount(payment.amount)} €
          </Text>
          <Badge label={statusCfg.label} color={statusCfg.badgeColor} size="small" style={{ marginTop: 4 }} />
        </View>
      </View>
    </Card>
  );
}

export function BillingDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: historyData, isLoading: historyLoading, isRefetching, refetch } = usePaymentHistory({ size: '500' });
  const { data: summary, isLoading: summaryLoading } = usePaymentSummary();

  const isLoading = historyLoading || summaryLoading;
  const allPayments: PaymentRecord[] = historyData?.content ?? [];

  const filtered = useMemo(() => {
    let list = [...allPayments];
    if (filter === 'PAID') {
      list = list.filter((p) => p.status === 'PAID');
    } else if (filter === 'PENDING') {
      list = list.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
    } else if (filter === 'REFUNDED') {
      list = list.filter((p) => p.status === 'REFUNDED');
    }
    list.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    return list;
  }, [allPayments, filter]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Facturation</Text>
        </View>
        <BillingSkeleton theme={theme} />
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
          Facturation
        </Text>
        <Pressable
          onPress={() => navigation.navigate('InvoiceList')}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="document-text-outline" size={20} color={theme.colors.primary.main} />
        </Pressable>
      </View>

      {/* Summary cards */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.md }}>
        <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: '#059669' }}>
              {formatAmount(summary?.totalPaid ?? 0)} €
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Total paye
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: '#D97706' }}>
              {formatAmount(summary?.totalPending ?? 0)} €
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              En attente
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <Ionicons name="arrow-undo-outline" size={18} color="#EF4444" style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: '#EF4444' }}>
              {formatAmount(summary?.totalRefunded ?? 0)} €
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Rembourse
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <Ionicons name="receipt-outline" size={18} color={theme.colors.primary.main} style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main }}>
              {summary?.transactionCount ?? 0}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Transactions
            </Text>
          </View>
        </View>
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

      {/* Transaction list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`}
          iconName="receipt-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="receipt-outline"
            title="Aucune transaction"
            description="Vos transactions apparaitront ici"
            compact
          />
        ) : (
          filtered.map((payment) => (
            <TransactionCard
              key={payment.id}
              payment={payment}
              onPress={() => navigation.navigate('PaymentDetail', { paymentId: payment.id, payment })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
