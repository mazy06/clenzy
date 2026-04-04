import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge, PriorityBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useTheme } from '@/theme';

type RouteParams = { InterventionDetail: { interventionId: number } };
type NavType = NativeStackNavigationProp<{
  InterventionList: undefined;
  InterventionDetail: { interventionId: number };
  TaskValidation: { interventionId: number };
}>;

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'info' | 'error' }> = {
  PAID: { label: 'Paye', color: 'success' },
  PENDING: { label: 'A payer', color: 'warning' },
  REFUNDED: { label: 'Rembourse', color: 'info' },
};

function formatAmount(amount?: number | null): string {
  if (amount == null) return '—';
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InterventionDetailScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'InterventionDetail'>>();
  const navigation = useNavigation<NavType>();
  const { interventionId } = route.params;
  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  const [editingCost, setEditingCost] = useState(false);
  const [actualCostInput, setActualCostInput] = useState('');

  const handleValidate = useCallback(() => {
    navigation.navigate('TaskValidation', { interventionId });
  }, [navigation, interventionId]);

  const handleCancel = useCallback(() => {
    Alert.alert('Annuler intervention', 'Confirmer l\'annulation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler intervention',
        style: 'destructive',
        onPress: () => {
          updateMutation.mutate({ id: interventionId, data: { status: 'CANCELLED' } });
        },
      },
    ]);
  }, [interventionId, updateMutation]);

  const handleStartIntervention = useCallback(() => {
    Alert.alert('Demarrer l\'intervention', 'Confirmer le demarrage ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Demarrer',
        onPress: () => {
          updateMutation.mutate({ id: interventionId, data: { status: 'IN_PROGRESS' } });
        },
      },
    ]);
  }, [interventionId, updateMutation]);

  const handleCompleteIntervention = useCallback(() => {
    Alert.alert('Terminer l\'intervention', 'Confirmer la completion ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        onPress: () => {
          updateMutation.mutate({ id: interventionId, data: { status: 'COMPLETED' } });
        },
      },
    ]);
  }, [interventionId, updateMutation]);

  const handleSaveCost = useCallback(() => {
    const cost = parseFloat(actualCostInput);
    if (isNaN(cost) || cost < 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    updateMutation.mutate(
      { id: interventionId, data: { actualCost: cost } },
      { onSuccess: () => setEditingCost(false) },
    );
  }, [interventionId, actualCostInput, updateMutation]);

  if (isLoading || !intervention) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.SPACING.md }}>
          <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{intervention.title || intervention.type}</Text>
            {intervention.propertyName && (
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>{intervention.propertyName}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge status={intervention.status} />
            <PriorityBadge priority={intervention.priority} />
          </View>
        </View>

        {/* Info card */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          {intervention.propertyAddress && (
            <InfoRow label="Adresse" value={intervention.propertyAddress} theme={theme} />
          )}
          {intervention.assignedTechnicianName && (
            <InfoRow label="Assigne a" value={intervention.assignedTechnicianName} theme={theme} />
          )}
          {intervention.teamName && (
            <InfoRow label="Equipe" value={intervention.teamName} theme={theme} />
          )}
          {intervention.startTime && (
            <InfoRow label="Debut" value={new Date(intervention.startTime).toLocaleString('fr-FR')} theme={theme} />
          )}
          {intervention.estimatedDurationHours && (
            <InfoRow label="Duree estimee" value={`${intervention.estimatedDurationHours}h`} theme={theme} />
          )}
          {intervention.estimatedCost != null && (
            <InfoRow label="Cout estime" value={`${intervention.estimatedCost}€`} theme={theme} />
          )}
          {intervention.actualCost != null && (
            <InfoRow label="Cout reel" value={`${intervention.actualCost}€`} theme={theme} />
          )}
        </Card>

        {/* Description */}
        {intervention.description && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.xs }}>Description</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{intervention.description}</Text>
          </Card>
        )}

        {/* Technician notes */}
        {intervention.technicianNotes && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.xs }}>Notes technicien</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{intervention.technicianNotes}</Text>
          </Card>
        )}

        {/* Photos */}
        {(intervention.beforePhotosUrls?.length || intervention.afterPhotosUrls?.length) ? (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Photos</Text>
            {intervention.beforePhotosUrls && intervention.beforePhotosUrls.length > 0 && (
              <>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Avant</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.SPACING.sm }}>
                  {intervention.beforePhotosUrls.map((uri, i) => (
                    <Image key={`before-${i}`} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                  ))}
                </View>
              </>
            )}
            {intervention.afterPhotosUrls && intervention.afterPhotosUrls.length > 0 && (
              <>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Apres</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {intervention.afterPhotosUrls.map((uri, i) => (
                    <Image key={`after-${i}`} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                  ))}
                </View>
              </>
            )}
          </Card>
        ) : null}

        {/* Cost breakdown */}
        {(intervention.estimatedCost != null || intervention.actualCost != null) && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.md }}>
              <Ionicons name="calculator-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>Couts</Text>
            </View>
            <View style={{ gap: theme.SPACING.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Cout estime</Text>
                <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                  {formatAmount(intervention.estimatedCost)} €
                </Text>
              </View>
              <Divider style={{ marginVertical: 0 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Cout reel</Text>
                {editingCost ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Input
                      value={actualCostInput}
                      onChangeText={setActualCostInput}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      containerStyle={{ width: 100 }}
                    />
                    <Pressable onPress={handleSaveCost} hitSlop={8}>
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.success.main} />
                    </Pressable>
                    <Pressable onPress={() => setEditingCost(false)} hitSlop={8}>
                      <Ionicons name="close-circle" size={24} color={theme.colors.error.main} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setActualCostInput(intervention.actualCost != null ? String(intervention.actualCost) : '');
                      setEditingCost(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                      {intervention.actualCost != null ? `${formatAmount(intervention.actualCost)} €` : '—'}
                    </Text>
                    <Ionicons name="create-outline" size={16} color={theme.colors.primary.main} />
                  </Pressable>
                )}
              </View>
              {intervention.estimatedCost != null && intervention.actualCost != null && (
                <>
                  <Divider style={{ marginVertical: 0 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Ecart</Text>
                    {(() => {
                      const variance = intervention.actualCost - intervention.estimatedCost;
                      const color = variance > 0 ? theme.colors.error.main : variance < 0 ? theme.colors.success.main : theme.colors.text.primary;
                      const prefix = variance > 0 ? '+' : '';
                      return (
                        <Text style={{ ...theme.typography.body1, fontWeight: '700', color }}>
                          {prefix}{formatAmount(variance)} €
                        </Text>
                      );
                    })()}
                  </View>
                </>
              )}
            </View>
          </Card>
        )}

        {/* Payment status */}
        {intervention.estimatedCost != null && intervention.estimatedCost > 0 && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.sm }}>
              <Ionicons name="card-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }}>Paiement</Text>
              {(() => {
                const paymentStatus = intervention.status === 'COMPLETED' ? 'PAID' : intervention.status === 'CANCELLED' ? 'REFUNDED' : 'PENDING';
                const cfg = PAYMENT_STATUS_CONFIG[paymentStatus] ?? PAYMENT_STATUS_CONFIG.PENDING;
                return <Badge label={cfg.label} color={cfg.color} dot />;
              })()}
            </View>
          </Card>
        )}

        {/* Status transition actions */}
        <SectionHeader title="Actions" iconName="flash-outline" />
        <View style={{ gap: theme.SPACING.sm }}>
          {(intervention.status === 'ASSIGNED' || intervention.status === 'PENDING') && (
            <Button
              title="Demarrer l'intervention"
              color="primary"
              onPress={handleStartIntervention}
              fullWidth
              loading={updateMutation.isPending}
              icon={<Ionicons name="play-circle-outline" size={18} color={theme.colors.primary.contrastText} />}
            />
          )}
          {intervention.status === 'IN_PROGRESS' && (
            <Button
              title="Terminer l'intervention"
              color="success"
              onPress={handleCompleteIntervention}
              fullWidth
              loading={updateMutation.isPending}
              icon={<Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success.contrastText} />}
            />
          )}
          {intervention.status === 'COMPLETED' && (
            <Button title="Valider cette intervention" color="success" onPress={handleValidate} fullWidth />
          )}
          {intervention.status !== 'CANCELLED' && intervention.status !== 'COMPLETED' && (
            <Button
              title="Annuler l'intervention"
              variant="outlined"
              color="error"
              onPress={handleCancel}
              fullWidth
              loading={updateMutation.isPending}
              icon={<Ionicons name="close-circle-outline" size={18} color={theme.colors.error.main} />}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border.light }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{label}</Text>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
