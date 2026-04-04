import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';

export interface Invoice {
  id: number;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  clientName: string;
  clientEmail?: string;
  propertyName?: string;
  lineItems?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

type FilterKey = 'all' | 'DRAFT' | 'SENT' | 'PAID';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'DRAFT', label: 'Brouillon' },
  { key: 'SENT', label: 'Envoyees' },
  { key: 'PAID', label: 'Payees' },
];

const STATUS_CONFIG: Record<string, { label: string; badgeColor: 'success' | 'warning' | 'info' | 'error' | 'neutral' }> = {
  DRAFT: { label: 'Brouillon', badgeColor: 'neutral' },
  SENT: { label: 'Envoyee', badgeColor: 'info' },
  PAID: { label: 'Payee', badgeColor: 'success' },
  OVERDUE: { label: 'En retard', badgeColor: 'error' },
  CANCELLED: { label: 'Annulee', badgeColor: 'neutral' },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount?: number | null): string {
  if (amount == null) return '0,00';
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InvoiceListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={28} />
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

function InvoiceCard({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${theme.colors.primary.main}08`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="document-text-outline" size={20} color={theme.colors.primary.main} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>
              {invoice.number}
            </Text>
            <Badge label={statusCfg.label} color={statusCfg.badgeColor} size="small" />
          </View>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
            {invoice.clientName}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 2 }}>
            {formatDate(invoice.date)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...theme.typography.body1, fontWeight: '700', color: theme.colors.text.primary }}>
            {formatAmount(invoice.totalAmount)} €
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function InvoiceListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get<{ content: Invoice[] }>('/invoices', { params: { size: '500' } }),
  });

  const allInvoices: Invoice[] = (data as any)?.content ?? (Array.isArray(data) ? data : []);

  const filtered = useMemo(() => {
    let list = [...allInvoices];
    if (filter !== 'all') {
      list = list.filter((inv) => inv.status === filter);
    }
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [allInvoices, filter]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Factures</Text>
        </View>
        <InvoiceListSkeleton theme={theme} />
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
          Factures
        </Text>
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

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} facture${filtered.length !== 1 ? 's' : ''}`}
          iconName="document-text-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="document-text-outline"
            title="Aucune facture"
            description="Vos factures apparaitront ici"
            compact
          />
        ) : (
          filtered.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id, invoice })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
