import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Reicon } from '@/icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntervention } from '@/hooks/useInterventions';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { BAITLY_QUERY_ROOT } from '@/config/baitlyCache';
import { StatusBadge, PriorityBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useTheme } from '@/theme';
import { BaitlyEmpty, BaitlyLoading, BaitlyScreen } from '@/design-system/components';

type RouteParams = { InterventionDetail: { interventionId: number } };
type NavType = NativeStackNavigationProp<{
  InterventionList: undefined;
  InterventionDetail: { interventionId: number };
  TaskValidation: { interventionId: number };
}>;

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'info' | 'error' }> = {
  PAID: { label: 'Payé', color: 'success' },
  PENDING: { label: 'A payer', color: 'warning' },
  REFUNDED: { label: 'Remboursé', color: 'info' },
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
  const { data: intervention, isLoading, isError, refetch } = useIntervention(interventionId);
  const cache=useQueryClient();
  const updateMutation=useMutation({mutationFn:({action,value}:{action:'cancel'|'start'|'complete'|'amount';value?:number})=>
    action==='start'?interventionsApi.start(interventionId):action==='complete'?interventionsApi.complete(interventionId):action==='amount'?interventionsApi.updateCost(interventionId,undefined,value):interventionsApi.updateStatus(interventionId,'CANCELLED'),retry:false,
    onSettled:async()=>{await Promise.all([cache.invalidateQueries({queryKey:['interventions']}),cache.invalidateQueries({queryKey:[BAITLY_QUERY_ROOT]})]);},onError:()=>Alert.alert('Erreur','Action non enregistrée. Vérifiez la mission avant de réessayer.')});

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
          updateMutation.mutate({action:'cancel'});
        },
      },
    ]);
  }, [interventionId, updateMutation]);

  const handleStartIntervention = useCallback(() => {
    Alert.alert('Démarrer l\'intervention', 'Confirmer le démarrage ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Démarrer',
        onPress: () => {
          updateMutation.mutate({action:'start'});
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
          updateMutation.mutate({action:'complete'});
        },
      },
    ]);
  }, [interventionId, updateMutation]);

  const handleSaveCost = useCallback(() => {
    const cost = Number(actualCostInput.replace(',','.'));
    if (!/^\d{1,10}([.,]\d{1,2})?$/.test(actualCostInput.trim()) || !Number.isFinite(cost) || cost < 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    updateMutation.mutate(
      {action:'amount',value:cost},
      { onSuccess: () => setEditingCost(false) },
    );
  }, [interventionId, actualCostInput, updateMutation]);

  if (isLoading) return <BaitlyScreen><BaitlyLoading /></BaitlyScreen>;
  if (isError || !intervention) return <BaitlyScreen><BaitlyEmpty title="Impossible de charger la mission" retry={() => { void refetch(); }} /></BaitlyScreen>;

  return (
    <BaitlyScreen>
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
            <InfoRow label="Assigné à" value={intervention.assignedTechnicianName} theme={theme} />
          )}
          {intervention.teamName && (
            <InfoRow label="Équipe" value={intervention.teamName} theme={theme} />
          )}
          {intervention.startTime && (
            <InfoRow label="Début" value={new Date(intervention.startTime).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} theme={theme} />
          )}
          {intervention.estimatedDurationHours && (
            <InfoRow label="Durée estimée" value={`${intervention.estimatedDurationHours}h`} theme={theme} />
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
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Après</Text>
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
              <Reicon name="calculator-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>Coûts</Text>
            </View>
            <View style={{ gap: theme.SPACING.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Coût estimé</Text>
                <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                  {formatAmount(intervention.estimatedCost)} €
                </Text>
              </View>
              <Divider style={{ marginVertical: 0 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Coût réel</Text>
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
                      <Reicon name="checkmark-circle" size={24} color={theme.colors.success.main} />
                    </Pressable>
                    <Pressable onPress={() => setEditingCost(false)} hitSlop={8}>
                      <Reicon name="close-circle" size={24} color={theme.colors.error.main} />
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
                    <Reicon name="create-outline" size={16} color={theme.colors.primary.main} />
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
              <Reicon name="card-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }}>Paiement</Text>
              {(() => {
                const cfg = intervention.paymentStatus ? PAYMENT_STATUS_CONFIG[intervention.paymentStatus] : undefined;
                return cfg ? <Badge label={cfg.label} color={cfg.color} dot /> : <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{intervention.paymentStatus || 'Non renseigné'}</Text>;
              })()}
            </View>
          </Card>
        )}

        {/* Status transition actions */}
        <SectionHeader title="Actions" iconName="flash-outline" />
        <View style={{ gap: theme.SPACING.sm }}>
          {(intervention.status === 'ASSIGNED' || intervention.status === 'PENDING') && (
            <Button
              title="Démarrer l'intervention"
              color="primary"
              onPress={handleStartIntervention}
              fullWidth
              loading={updateMutation.isPending}
              icon={<Reicon name="play-circle-outline" size={18} color={theme.colors.primary.contrastText} />}
            />
          )}
          {intervention.status === 'IN_PROGRESS' && (
            <Button
              title="Terminer l'intervention"
              color="success"
              onPress={handleCompleteIntervention}
              fullWidth
              loading={updateMutation.isPending}
              icon={<Reicon name="checkmark-circle-outline" size={18} color={theme.colors.success.contrastText} />}
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
              icon={<Reicon name="close-circle-outline" size={18} color={theme.colors.error.main} />}
            />
          )}
        </View>
    </BaitlyScreen>
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
