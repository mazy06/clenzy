import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';
import type { PaymentRecord } from '@/api/endpoints/paymentsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  PaymentDetail: { paymentId: number; payment: PaymentRecord };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName; badgeColor: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  PAID: { label: 'Paye', color: '#059669', icon: 'checkmark-circle', badgeColor: 'success' },
  PENDING: { label: 'En attente', color: '#D97706', icon: 'time-outline', badgeColor: 'warning' },
  PROCESSING: { label: 'En cours', color: '#3B82F6', icon: 'sync-outline', badgeColor: 'info' },
  FAILED: { label: 'Echoue', color: '#EF4444', icon: 'close-circle', badgeColor: 'error' },
  REFUNDED: { label: 'Rembourse', color: '#4A7C8E', icon: 'arrow-undo-outline', badgeColor: 'info' },
  CANCELLED: { label: 'Annule', color: '#6B7280', icon: 'ban-outline', badgeColor: 'neutral' },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InfoRow({ icon, label, value, theme }: {
  icon: IoniconsName;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: theme.SPACING.md }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${theme.colors.primary.main}08`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={theme.colors.primary.main} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{label}</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

function TimelineEvent({ label, date, icon, color, isLast, theme }: {
  label: string;
  date: string;
  icon: IoniconsName;
  color: string;
  isLast: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${color}14`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        {!isLast && (
          <View style={{ width: 2, flex: 1, backgroundColor: theme.colors.border.light, marginVertical: 4 }} />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : theme.SPACING.md }}>
        <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>{label}</Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 2 }}>{date}</Text>
      </View>
    </View>
  );
}

export function PaymentDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PaymentDetail'>>();
  const { payment } = route.params;
  const queryClient = useQueryClient();

  const [showRefundInput, setShowRefundInput] = useState(false);
  const [refundAmount, setRefundAmount] = useState(String(payment.amount));

  const statusCfg = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.PENDING;

  const refundMutation = useMutation({
    mutationFn: (amount: number) =>
      apiClient.post(`/payments/${payment.id}/refund`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      Alert.alert('Succes', 'Remboursement initie', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert('Erreur', 'Impossible d\'initier le remboursement');
    },
  });

  const handleRefund = useCallback(() => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > payment.amount) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    Alert.alert(
      'Confirmer le remboursement',
      `Rembourser ${formatAmount(amount)} € ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Rembourser', style: 'destructive', onPress: () => refundMutation.mutate(amount) },
      ],
    );
  }, [refundAmount, payment.amount, refundMutation]);

  const timelineEvents = [
    { label: 'Transaction creee', date: formatDateTime(payment.createdAt), icon: 'add-circle-outline' as IoniconsName, color: theme.colors.info.main },
    ...(payment.status === 'PAID' ? [{ label: 'Paiement recu', date: formatDateTime(payment.transactionDate), icon: 'checkmark-circle' as IoniconsName, color: '#059669' }] : []),
    ...(payment.status === 'REFUNDED' ? [{ label: 'Remboursement effectue', date: formatDateTime(payment.transactionDate), icon: 'arrow-undo-outline' as IoniconsName, color: '#EF4444' }] : []),
    ...(payment.status === 'FAILED' ? [{ label: 'Paiement echoue', date: formatDateTime(payment.transactionDate), icon: 'close-circle' as IoniconsName, color: '#EF4444' }] : []),
  ];

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
          Detail du paiement
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount hero */}
        <Card elevated style={{ alignItems: 'center', paddingVertical: theme.SPACING['2xl'], marginBottom: theme.SPACING.lg }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: `${statusCfg.color}14`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.SPACING.md,
          }}>
            <Ionicons name={statusCfg.icon} size={28} color={statusCfg.color} />
          </View>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
            {formatAmount(payment.amount)} €
          </Text>
          <Badge label={statusCfg.label} color={statusCfg.badgeColor} style={{ marginTop: theme.SPACING.sm }} />
        </Card>

        {/* Payment info */}
        <SectionHeader title="Informations" iconName="information-circle-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <InfoRow icon="receipt-outline" label="Transaction" value={`#${payment.id}`} theme={theme} />
          <Divider />
          <InfoRow icon="calendar-outline" label="Date" value={formatDate(payment.transactionDate)} theme={theme} />
          <Divider />
          <InfoRow icon="card-outline" label="Methode" value={payment.paymentMethod || 'Carte bancaire'} theme={theme} />
          <Divider />
          <InfoRow icon="construct-outline" label="Intervention" value={payment.interventionTitle || `#${payment.interventionId}`} theme={theme} />
          <Divider />
          <InfoRow icon="home-outline" label="Propriete" value={payment.propertyName || '—'} theme={theme} />
        </Card>

        {/* Timeline */}
        <SectionHeader title="Historique" iconName="time-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {timelineEvents.map((event, idx) => (
            <TimelineEvent
              key={idx}
              label={event.label}
              date={event.date}
              icon={event.icon}
              color={event.color}
              isLast={idx === timelineEvents.length - 1}
              theme={theme}
            />
          ))}
        </Card>

        {/* Actions */}
        {payment.status === 'PAID' && (
          <>
            <SectionHeader title="Actions" iconName="settings-outline" />
            {showRefundInput ? (
              <Card style={{ marginBottom: theme.SPACING.md }}>
                <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
                  Montant du remboursement
                </Text>
                <Input
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  containerStyle={{ marginBottom: theme.SPACING.md }}
                />
                <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                  <Button
                    title="Annuler"
                    variant="outlined"
                    onPress={() => setShowRefundInput(false)}
                    style={{ flex: 1 }}
                    size="small"
                  />
                  <Button
                    title="Rembourser"
                    color="error"
                    onPress={handleRefund}
                    loading={refundMutation.isPending}
                    style={{ flex: 1 }}
                    size="small"
                  />
                </View>
              </Card>
            ) : (
              <View style={{ gap: theme.SPACING.sm }}>
                <Button
                  title="Rembourser"
                  variant="soft"
                  color="error"
                  onPress={() => setShowRefundInput(true)}
                  fullWidth
                  icon={<Ionicons name="arrow-undo-outline" size={18} color={theme.colors.error.main} />}
                />
                <Button
                  title="Telecharger le recu"
                  variant="outlined"
                  onPress={() => Alert.alert('Info', 'Fonctionnalite a venir')}
                  fullWidth
                  icon={<Ionicons name="download-outline" size={18} color={theme.colors.primary.main} />}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
