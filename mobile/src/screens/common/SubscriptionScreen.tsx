import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface ForfaitPlan {
  key: string;
  label: string;
  description: string;
  features: string[];
  icon: IoniconsName;
  color: string;
  recommended?: boolean;
}

const FORFAIT_PLANS: ForfaitPlan[] = [
  {
    key: 'essentiel',
    label: 'Essentiel',
    description: 'Pour demarrer la gestion de vos proprietes',
    features: [
      'Gestion des proprietes',
      'Interventions manuelles',
      'Suivi basique',
    ],
    icon: 'leaf-outline',
    color: '#6B8A9A',
  },
  {
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
    recommended: true,
  },
  {
    key: 'premium',
    label: 'Premium',
    description: 'L\'experience complete pour les professionnels',
    features: [
      'Tout le forfait Confort',
      'Rapports & analytics',
      'Support prioritaire',
      'API dediee',
    ],
    icon: 'diamond-outline',
    color: '#C8924A',
  },
];

const FORFAIT_ORDER = ['essentiel', 'confort', 'premium'];

function getForfaitIndex(forfait?: string): number {
  if (!forfait) return -1;
  return FORFAIT_ORDER.indexOf(forfait.toLowerCase());
}

export function SubscriptionScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const currentForfait = user?.forfait?.toLowerCase() || '';
  const currentIndex = getForfaitIndex(currentForfait);

  const handleUpgrade = (targetForfait: string) => {
    navigation.navigate('SubscriptionCheckout', { forfait: targetForfait });
  };

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
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: pressed ? theme.colors.background.surface : theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.xs,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Mon forfait
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* Current plan banner */}
          {currentForfait && (
            <Card variant="filled" style={{ marginBottom: theme.SPACING.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: `${theme.colors.primary.main}14`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name={FORFAIT_PLANS.find((p) => p.key === currentForfait)?.icon || 'diamond-outline'}
                    size={22}
                    color={theme.colors.primary.main}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                    Forfait actuel
                  </Text>
                  <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, marginTop: 2 }}>
                    {FORFAIT_PLANS.find((p) => p.key === currentForfait)?.label || currentForfait}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.BORDER_RADIUS.lg,
                  backgroundColor: `${theme.colors.success.main}14`,
                }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.success.main, fontWeight: '700' }}>
                    Actif
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Plans list */}
          {FORFAIT_PLANS.map((plan) => {
            const planIndex = getForfaitIndex(plan.key);
            const isCurrent = plan.key === currentForfait;
            const isDowngrade = planIndex < currentIndex;
            const isUpgrade = planIndex > currentIndex;

            return (
              <Card
                key={plan.key}
                style={{
                  marginBottom: theme.SPACING.md,
                  borderWidth: plan.recommended ? 2 : isCurrent ? 1.5 : 0,
                  borderColor: plan.recommended
                    ? theme.colors.primary.main
                    : isCurrent ? theme.colors.success.main : 'transparent',
                }}
              >
                {/* Recommended badge */}
                {plan.recommended && (
                  <View style={{
                    position: 'absolute',
                    top: -11,
                    right: theme.SPACING.lg,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: theme.BORDER_RADIUS.lg,
                    backgroundColor: theme.colors.primary.main,
                  }}>
                    <Text style={{ ...theme.typography.caption, color: '#fff', fontWeight: '700', fontSize: 10 }}>
                      Recommande
                    </Text>
                  </View>
                )}

                {/* Plan header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${plan.color}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: theme.SPACING.md,
                  }}>
                    <Ionicons name={plan.icon} size={20} color={plan.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                      <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
                        {plan.label}
                      </Text>
                      {isCurrent && (
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: theme.BORDER_RADIUS.sm,
                          backgroundColor: `${theme.colors.success.main}14`,
                        }}>
                          <Text style={{ ...theme.typography.caption, color: theme.colors.success.main, fontWeight: '700', fontSize: 10 }}>
                            Actuel
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                      {plan.description}
                    </Text>
                  </View>
                </View>

                {/* Features */}
                <View style={{ marginBottom: theme.SPACING.md }}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isCurrent ? theme.colors.success.main : plan.color}
                      />
                      <Text style={{
                        ...theme.typography.body2,
                        color: isCurrent ? theme.colors.text.secondary : theme.colors.text.primary,
                      }}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Action button */}
                {isCurrent ? (
                  <View style={{
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: `${theme.colors.success.main}08`,
                    alignItems: 'center',
                  }}>
                    <Text style={{ ...theme.typography.body2, color: theme.colors.success.main, fontWeight: '600' }}>
                      Votre forfait actuel
                    </Text>
                  </View>
                ) : isUpgrade ? (
                  <Button
                    title={`Passer au ${plan.label}`}
                    onPress={() => handleUpgrade(plan.key)}
                    fullWidth
                    icon={<Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />}
                  />
                ) : isDowngrade ? (
                  <View style={{
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: theme.colors.background.surface,
                    alignItems: 'center',
                  }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                      Inclus dans votre forfait
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })}

          {/* Help text */}
          <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.lg }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, textAlign: 'center' }}>
              Le changement de forfait prend effet immediatement.{'\n'}
              Paiement securise par carte, Apple Pay ou Google Pay.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
