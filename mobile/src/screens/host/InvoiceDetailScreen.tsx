import React from 'react';
import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';
import type { Invoice } from './InvoiceListScreen';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  InvoiceDetail: { invoiceId: number; invoice: Invoice };
};

const STATUS_CONFIG: Record<string, { label: string; badgeColor: 'success' | 'warning' | 'info' | 'error' | 'neutral' }> = {
  DRAFT: { label: 'Brouillon', badgeColor: 'neutral' },
  SENT: { label: 'Envoyee', badgeColor: 'info' },
  PAID: { label: 'Payee', badgeColor: 'success' },
  OVERDUE: { label: 'En retard', badgeColor: 'error' },
  CANCELLED: { label: 'Annulee', badgeColor: 'neutral' },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

export function InvoiceDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'InvoiceDetail'>>();
  const { invoice } = route.params;
  const queryClient = useQueryClient();

  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.DRAFT;

  const markPaidMutation = useMutation({
    mutationFn: () => apiClient.put(`/invoices/${invoice.id}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      Alert.alert('Succes', 'Facture marquee comme payee', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert('Erreur', 'Impossible de mettre a jour la facture');
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: () => apiClient.post(`/invoices/${invoice.id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      Alert.alert('Succes', 'Facture envoyee par email');
    },
    onError: () => {
      Alert.alert('Erreur', 'Impossible d\'envoyer la facture');
    },
  });

  const handleDownloadPdf = () => {
    Alert.alert('Info', 'Le telechargement du PDF sera disponible prochainement');
  };

  const handleMarkPaid = () => {
    Alert.alert(
      'Marquer comme payee',
      'Voulez-vous marquer cette facture comme payee ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => markPaidMutation.mutate() },
      ],
    );
  };

  const handleSendEmail = () => {
    Alert.alert(
      'Envoyer par email',
      `Envoyer la facture a ${invoice.clientEmail || invoice.clientName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: () => sendEmailMutation.mutate() },
      ],
    );
  };

  const lineItems = invoice.lineItems ?? [];
  const subtotal = invoice.amount ?? lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = invoice.taxAmount ?? 0;
  const total = invoice.totalAmount ?? subtotal + tax;

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
          Facture
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice header */}
        <Card elevated style={{ marginBottom: theme.SPACING.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.md }}>
            <View>
              <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{invoice.number}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 4 }}>
                {invoice.clientName}
              </Text>
            </View>
            <Badge label={statusCfg.label} color={statusCfg.badgeColor} />
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.SPACING.md }}>
            <View>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Date d'emission</Text>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 2 }}>{formatDate(invoice.date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Date d'echeance</Text>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 2 }}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </Card>

        {/* Line items */}
        <SectionHeader title="Details" iconName="list-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {/* Table header */}
          <View style={{ flexDirection: 'row', paddingBottom: theme.SPACING.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border.light }}>
            <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.text.secondary, flex: 3 }}>Description</Text>
            <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.text.secondary, flex: 1, textAlign: 'center' }}>Qte</Text>
            <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.text.secondary, flex: 1.5, textAlign: 'right' }}>P.U.</Text>
            <Text style={{ ...theme.typography.caption, fontWeight: '700', color: theme.colors.text.secondary, flex: 1.5, textAlign: 'right' }}>Total</Text>
          </View>

          {lineItems.length > 0 ? (
            lineItems.map((item, idx) => (
              <View key={item.id ?? idx} style={{ flexDirection: 'row', paddingVertical: theme.SPACING.sm, borderBottomWidth: idx < lineItems.length - 1 ? 0.5 : 0, borderBottomColor: theme.colors.border.light }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 3 }} numberOfLines={2}>{item.description}</Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1, textAlign: 'center' }}>{item.quantity}</Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1.5, textAlign: 'right' }}>{formatAmount(item.unitPrice)} €</Text>
                <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary, flex: 1.5, textAlign: 'right' }}>{formatAmount(item.total)} €</Text>
              </View>
            ))
          ) : (
            <View style={{ paddingVertical: theme.SPACING.lg, alignItems: 'center' }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Aucun detail disponible</Text>
            </View>
          )}

          {/* Totals */}
          <Divider style={{ marginTop: theme.SPACING.md }} />
          <View style={{ gap: theme.SPACING.xs, paddingTop: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Sous-total HT</Text>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>{formatAmount(subtotal)} €</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>TVA</Text>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>{formatAmount(tax)} €</Text>
            </View>
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>Total TTC</Text>
              <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main }}>{formatAmount(total)} €</Text>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <SectionHeader title="Actions" iconName="settings-outline" />
        <View style={{ gap: theme.SPACING.sm }}>
          <Button
            title="Telecharger PDF"
            variant="outlined"
            onPress={handleDownloadPdf}
            fullWidth
            icon={<Ionicons name="download-outline" size={18} color={theme.colors.primary.main} />}
          />
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
            <>
              <Button
                title="Envoyer par email"
                variant="soft"
                onPress={handleSendEmail}
                loading={sendEmailMutation.isPending}
                fullWidth
                icon={<Ionicons name="mail-outline" size={18} color={theme.colors.primary.main} />}
              />
              <Button
                title="Marquer comme payee"
                color="success"
                onPress={handleMarkPaid}
                loading={markPaidMutation.isPending}
                fullWidth
                icon={<Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success.contrastText} />}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
