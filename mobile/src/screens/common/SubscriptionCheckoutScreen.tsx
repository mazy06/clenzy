import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { useNativePayment } from '@/hooks/useNativePayment';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface ForfaitInfo {
  key: string;
  label: string;
  description: string;
  features: string[];
  icon: IoniconsName;
  color: string;
  priceLabel: string;
}

const FORFAIT_INFO: Record<string, ForfaitInfo> = {
  essentiel: {
    key: 'essentiel',
    label: 'Essentiel',
    description: 'Pour demarrer la gestion de vos proprietes',
    features: ['Gestion des proprietes', 'Interventions manuelles', 'Suivi basique'],
    icon: 'leaf-outline',
    color: '#6B8A9A',
    priceLabel: '5,00',
  },
  confort: {
    key: 'confort',
    label: 'Confort',
    description: 'Automatisez la gestion de vos reservations',
    features: [
      'Planning interactif',
      'Import iCal automatique',
      'Interventions automatiques',
      'Notifications avancees',
    ],
    icon: 'star-outline',
    color: '#4A7C8E',
    priceLabel: '5,00',
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    description: "L'experience complete pour les professionnels",
    features: [
      'Tout le forfait Confort',
      'Rapports & analytics',
      'Support prioritaire',
      'API dediee',
    ],
    icon: 'diamond-outline',
    color: '#C8924A',
    priceLabel: '5,00',
  },
};

type ParamList = {
  SubscriptionCheckout: { forfait: string };
};

export function SubscriptionCheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'SubscriptionCheckout'>>();
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);

  const targetForfait = route.params.forfait;
  const plan = FORFAIT_INFO[targetForfait] || FORFAIT_INFO.confort;
  const currentForfait = user?.forfait?.toLowerCase() || 'essentiel';
  const currentPlan = FORFAIT_INFO[currentForfait] || FORFAIT_INFO.essentiel;

  const { state, error, initAndPresentPaymentSheet, reset } = useNativePayment();

  const [billingAddress, setBillingAddress] = useState('');

  const handlePay = async () => {
    const success = await initAndPresentPaymentSheet({
      type: 'subscription',
      forfait: targetForfait,
    });

    if (success) {
      // Recharger les donnees utilisateur pour mettre a jour le forfait
      await loadUser();
      Alert.alert(
        'Paiement confirme',
        `Votre forfait a ete mis a jour vers ${plan.label}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else if (state === 'error' && error) {
      Alert.alert('Erreur de paiement', error);
    }
  };

  const isProcessing = state === 'loading' || state === 'presenting';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.md,
        paddingBottom: theme.SPACING.md,
        gap: theme.SPACING.md,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          disabled={isProcessing}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: pressed ? theme.colors.background.surface : theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.xs,
            opacity: isProcessing ? 0.5 : 1,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Paiement
        </Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: theme.BORDER_RADIUS.lg,
          backgroundColor: `${theme.colors.success.main}0C`,
        }}>
          <Ionicons name="lock-closed" size={12} color={theme.colors.success.main} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.success.main, fontWeight: '600', fontSize: 10 }}>
            Securise
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* Upgrade summary */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <Text style={{
              ...theme.typography.body2,
              fontWeight: '700',
              color: theme.colors.text.primary,
              marginBottom: theme.SPACING.md,
            }}>
              Changement de forfait
            </Text>

            {/* Current → Target */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.SPACING.md,
              marginBottom: theme.SPACING.lg,
            }}>
              {/* Current plan */}
              <View style={{
                flex: 1,
                padding: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: theme.colors.background.surface,
                alignItems: 'center',
              }}>
                <Ionicons name={currentPlan.icon} size={24} color={theme.colors.text.disabled} />
                <Text style={{
                  ...theme.typography.caption,
                  color: theme.colors.text.disabled,
                  marginTop: 4,
                }}>
                  Actuel
                </Text>
                <Text style={{
                  ...theme.typography.body2,
                  fontWeight: '600',
                  color: theme.colors.text.secondary,
                  marginTop: 2,
                }}>
                  {currentPlan.label}
                </Text>
              </View>

              {/* Arrow */}
              <Ionicons name="arrow-forward" size={20} color={theme.colors.primary.main} />

              {/* Target plan */}
              <View style={{
                flex: 1,
                padding: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${plan.color}0C`,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: `${plan.color}30`,
              }}>
                <Ionicons name={plan.icon} size={24} color={plan.color} />
                <Text style={{
                  ...theme.typography.caption,
                  color: plan.color,
                  marginTop: 4,
                  fontWeight: '600',
                }}>
                  Nouveau
                </Text>
                <Text style={{
                  ...theme.typography.body2,
                  fontWeight: '700',
                  color: plan.color,
                  marginTop: 2,
                }}>
                  {plan.label}
                </Text>
              </View>
            </View>

            {/* Features included */}
            <Text style={{
              ...theme.typography.caption,
              fontWeight: '600',
              color: theme.colors.text.secondary,
              marginBottom: theme.SPACING.sm,
            }}>
              Inclus dans {plan.label} :
            </Text>
            {plan.features.map((feature) => (
              <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
                  {feature}
                </Text>
              </View>
            ))}
          </Card>

          {/* Order summary */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <Text style={{
              ...theme.typography.body2,
              fontWeight: '700',
              color: theme.colors.text.primary,
              marginBottom: theme.SPACING.md,
            }}>
              Resume de la commande
            </Text>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: theme.SPACING.sm,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary }}>
                  Forfait {plan.label}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  Abonnement mensuel
                </Text>
              </View>
              <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                {plan.priceLabel} EUR
              </Text>
            </View>

            <View style={{
              borderTopWidth: 1,
              borderTopColor: theme.colors.border.light,
              paddingTop: theme.SPACING.md,
              marginTop: theme.SPACING.sm,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
                Total
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main }}>
                  {plan.priceLabel} EUR
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  par mois, TTC
                </Text>
              </View>
            </View>
          </Card>

          {/* Payment info */}
          <Card variant="filled" style={{ marginBottom: theme.SPACING.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.SPACING.md }}>
              <Ionicons name="card-outline" size={20} color={theme.colors.primary.main} />
              <View style={{ flex: 1 }}>
                <Text style={{
                  ...theme.typography.body2,
                  fontWeight: '600',
                  color: theme.colors.text.primary,
                  marginBottom: 4,
                }}>
                  Paiement securise
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  Vous pouvez payer par carte bancaire, Apple Pay ou Google Pay.
                  Votre moyen de paiement sera sauvegarde pour les prochaines echeances.
                </Text>
              </View>
            </View>
          </Card>

          {/* Pay button */}
          <Button
            title={isProcessing ? 'Traitement en cours...' : `Payer ${plan.priceLabel} EUR / mois`}
            onPress={handlePay}
            disabled={isProcessing}
            loading={isProcessing}
            fullWidth
            size="large"
            icon={!isProcessing ? <Ionicons name="shield-checkmark-outline" size={20} color="#fff" /> : undefined}
            style={{ marginBottom: theme.SPACING.md }}
          />

          {/* Error display */}
          {state === 'error' && error && (
            <View style={{
              padding: theme.SPACING.md,
              borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: `${theme.colors.error.main}0C`,
              marginBottom: theme.SPACING.md,
            }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.error.main }}>
                {error}
              </Text>
              <Pressable onPress={reset} style={{ marginTop: theme.SPACING.sm }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
                  Reessayer
                </Text>
              </Pressable>
            </View>
          )}

          {/* Terms */}
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.disabled,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            En procedant au paiement, vous acceptez les conditions generales de vente.
            L'abonnement se renouvelle automatiquement chaque mois.
            Vous pouvez annuler a tout moment.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
