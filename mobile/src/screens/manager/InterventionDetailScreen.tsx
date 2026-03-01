import React, { useCallback } from 'react';
import { View, Text, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge, PriorityBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';

type RouteParams = { InterventionDetail: { interventionId: number } };
type NavType = NativeStackNavigationProp<{
  InterventionList: undefined;
  InterventionDetail: { interventionId: number };
  TaskValidation: { interventionId: number };
}>;

export function InterventionDetailScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'InterventionDetail'>>();
  const navigation = useNavigation<NavType>();
  const { interventionId } = route.params;
  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

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

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm }}>
          {intervention.status === 'COMPLETED' && (
            <Button title="Valider cette intervention" color="success" onPress={handleValidate} fullWidth />
          )}
          {intervention.status !== 'CANCELLED' && intervention.status !== 'COMPLETED' && (
            <Button title="Annuler intervention" variant="outlined" color="error" onPress={handleCancel} fullWidth loading={updateMutation.isPending} />
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
