import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useIntervention } from '@/hooks/useInterventions';
import { useNativePayment, type PaymentState } from '@/hooks/useNativePayment';
import type { DashboardStackParamList } from '@/navigation/HostNavigator';

type IoniconsName = keyof typeof Ionicons.glyphMap;

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const PAYMENT_METHODS: Array<{ icon: IoniconsName; label: string; color: string }> = [
  { icon: 'card-outline', label: 'Carte bancaire', color: '#3B82F6' },
  { icon: 'logo-apple', label: 'Apple Pay', color: '#000000' },
  { icon: 'logo-google', label: 'Google Pay', color: '#4285F4' },
];

function CheckoutLoading({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.lg }}>
      <Skeleton width="60%" height={24} />
      <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={56} borderRadius={theme.BORDER_RADIUS.md} />
    </View>
  );
}

function StatusOverlay({
  state,
  errorMessage,
  onRetry,
  onGoBack,
  theme,
}: {
  state: PaymentState;
  errorMessage: string | null;
  onRetry: () => void;
  onGoBack: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  if (state === 'loading' || state === 'presenting') {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.SPACING['2xl'],
        gap: theme.SPACING.lg,
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' }}>
          {state === 'loading' ? 'Preparation du paiement...' : 'Paiement en cours...'}
        </Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center' }}>
          Veuillez patienter
        </Text>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.SPACING['2xl'],
        gap: theme.SPACING.lg,
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#05966914',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="checkmark-circle" size={48} color="#059669" />
        </View>
        <Text style={{ ...theme.typography.h2, color: '#059669', textAlign: 'center' }}>
          Paiement confirme
        </Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center' }}>
          Votre intervention a ete validee et sera planifiee prochainement.
        </Text>
        <Button
          title="Retour"
          onPress={onGoBack}
          variant="contained"
          fullWidth
          size="large"
          color="success"
        />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.SPACING['2xl'],
        gap: theme.SPACING.lg,
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#EF444414',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="close-circle" size={48} color="#EF4444" />
        </View>
        <Text style={{ ...theme.typography.h2, color: '#EF4444', textAlign: 'center' }}>
          Paiement echoue
        </Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center' }}>
          {errorMessage || 'Une erreur est survenue lors du paiement.'}
        </Text>
        <View style={{ width: '100%', gap: theme.SPACING.sm }}>
          <Button
            title="Reessayer"
            onPress={onRetry}
            variant="contained"
            fullWidth
            size="large"
            color="primary"
          />
          <Button
            title="Retour"
            onPress={onGoBack}
            variant="outlined"
            fullWidth
            size="large"
          />
        </View>
      </View>
    );
  }

  return null;
}

export function PaymentCheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<DashboardStackParamList, 'PaymentCheckout'>>();
  const { interventionId } = route.params;

  const { data: intervention, isLoading, refetch } = useIntervention(interventionId);
  const { state, error: errorMessage, initAndPresentPaymentSheet, reset } = useNativePayment();

  const amount = intervention?.estimatedCost ?? 0;
  const isCheckoutActive = state !== 'idle' && state !== 'cancelled';

  const handlePay = async () => {
    if (!intervention || amount <= 0) return;
    const amountCents = Math.round(amount * 100);
    const success = await initAndPresentPaymentSheet({
      type: 'intervention',
      interventionId,
      amount: amountCents,
    });

    if (success) {
      refetch();
    }
  };

  const handleRetry = () => {
    reset();
    handlePay();
  };

  const handleGoBack = () => {
    reset();
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <CheckoutLoading theme={theme} />
      </SafeAreaView>
    );
  }

  // Show overlay for active checkout states
  if (isCheckoutActive) {
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
            onPress={handleGoBack}
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
            Paiement
          </Text>
        </View>

        <StatusOverlay
          state={state}
          errorMessage={errorMessage}
          onRetry={handleRetry}
          onGoBack={handleGoBack}
          theme={theme}
        />
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
          Paiement
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.SPACING.lg,
          paddingBottom: 40,
          gap: theme.SPACING.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intervention recap card */}
        <Card elevated>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: `${theme.colors.primary.main}14`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: theme.SPACING.md,
            }}>
              <Ionicons name="construct-outline" size={22} color={theme.colors.primary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }} numberOfLines={2}>
                {intervention?.title ?? `Intervention #${interventionId}`}
              </Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                {intervention?.type ?? 'Intervention'}
              </Text>
            </View>
          </View>

          <View style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.light,
            paddingTop: theme.SPACING.md,
            gap: theme.SPACING.sm,
          }}>
            {intervention?.propertyName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                <Ionicons name="home-outline" size={16} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                  {intervention.propertyName}
                </Text>
              </View>
            )}
            {intervention?.scheduledDate && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                  Planifiee le {formatDate(intervention.scheduledDate)}
                </Text>
              </View>
            )}
            {intervention?.description && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.SPACING.sm }}>
                <Ionicons name="document-text-outline" size={16} color={theme.colors.text.disabled} style={{ marginTop: 2 }} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1 }} numberOfLines={3}>
                  {intervention.description}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Amount card */}
        <Card elevated style={{ alignItems: 'center', paddingVertical: theme.SPACING['2xl'] }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: theme.SPACING.sm }}>
            Montant a payer
          </Text>
          <Text style={{
            fontSize: 40,
            fontWeight: '800',
            color: theme.colors.text.primary,
            letterSpacing: -1,
          }}>
            {formatAmount(amount)}<Text style={{ fontSize: 24, fontWeight: '600' }}>€</Text>
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: theme.SPACING.xs }}>
            TTC
          </Text>
        </Card>

        {/* Payment methods */}
        <Card variant="filled">
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
            Methodes de paiement acceptees
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
            {PAYMENT_METHODS.map((method) => (
              <View
                key={method.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: theme.SPACING.md,
                  borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: theme.colors.background.paper,
                  gap: 6,
                }}
              >
                <Ionicons name={method.icon} size={24} color={method.color} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10, textAlign: 'center' }}>
                  {method.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Security notice */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, paddingHorizontal: theme.SPACING.sm }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.text.disabled} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 1 }}>
            Paiement securise par Stripe. Vos donnees bancaires ne sont jamais stockees.
          </Text>
        </View>

        {/* Pay button */}
        <Button
          title={`Payer ${formatAmount(amount)}€`}
          onPress={handlePay}
          variant="contained"
          size="large"
          fullWidth
          disabled={amount <= 0}
          loading={false}
          icon={<Ionicons name="lock-closed" size={18} color="#FFFFFF" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
