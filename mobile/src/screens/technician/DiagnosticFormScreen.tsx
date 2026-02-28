import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge, PriorityBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';

type RouteParams = {
  DiagnosticForm: { interventionId: number };
};

type TicketsStackNav = NativeStackNavigationProp<{
  TicketQueue: undefined;
  DiagnosticForm: { interventionId: number };
  PhotoDoc: { interventionId: number };
  TechReport: { interventionId: number };
}>;

export function DiagnosticFormScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'DiagnosticForm'>>();
  const navigation = useNavigation<TicketsStackNav>();
  const { interventionId } = route.params;

  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  const [diagnosis, setDiagnosis] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [notes, setNotes] = useState('');

  const handleStartWork = useCallback(() => {
    Alert.alert('Demarrer l\'intervention', 'Confirmer le debut du travail ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Demarrer',
        onPress: () => {
          updateMutation.mutate({
            id: interventionId,
            data: {
              status: 'IN_PROGRESS',
              technicianNotes: diagnosis || undefined,
            },
          });
        },
      },
    ]);
  }, [interventionId, diagnosis, updateMutation]);

  const handleSaveDiagnosis = useCallback(() => {
    updateMutation.mutate({
      id: interventionId,
      data: {
        technicianNotes: [diagnosis, notes].filter(Boolean).join('\n\n'),
        materialsUsed: materialsUsed || undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        estimatedDurationHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      },
    });
    Alert.alert('Diagnostic enregistre', 'Les informations ont ete sauvegardees.');
  }, [interventionId, diagnosis, notes, materialsUsed, estimatedCost, estimatedHours, updateMutation]);

  const handleGoToPhotos = useCallback(() => {
    navigation.navigate('PhotoDoc', { interventionId });
  }, [navigation, interventionId]);

  const handleGoToReport = useCallback(() => {
    navigation.navigate('TechReport', { interventionId });
  }, [navigation, interventionId]);

  if (isLoading || !intervention) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = intervention.status === 'PENDING' || intervention.status === 'SCHEDULED';
  const isInProgress = intervention.status === 'IN_PROGRESS';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.SPACING.sm }}>
          <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{intervention.title || intervention.type}</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>{intervention.propertyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusBadge status={intervention.status} />
            <PriorityBadge priority={intervention.priority} />
          </View>
        </View>

        {/* Property info */}
        {intervention.propertyAddress && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: theme.SPACING.md }}>
            {intervention.propertyAddress}
          </Text>
        )}

        {/* Diagnostic form */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Diagnostic</Text>
          <TextInput
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="Decrivez le probleme identifie..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
          />
        </Card>

        {/* Materials & cost */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Materiaux et couts</Text>
          <TextInput
            value={materialsUsed}
            onChangeText={setMaterialsUsed}
            placeholder="Pieces et materiaux utilises..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default, marginBottom: 12 }]}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input label="Cout estime (EUR)" value={estimatedCost} onChangeText={setEstimatedCost} keyboardType="numeric" placeholder="0.00" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Duree estimee (h)" value={estimatedHours} onChangeText={setEstimatedHours} keyboardType="numeric" placeholder="1.5" />
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Notes additionnelles</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Observations supplementaires..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
          />
        </Card>

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm }}>
          <Button title="Enregistrer le diagnostic" onPress={handleSaveDiagnosis} fullWidth loading={updateMutation.isPending} />

          {/* Request validation via messaging */}
          <Pressable
            onPress={() => (navigation as any).navigate('Messages')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 12,
              paddingHorizontal: theme.SPACING.md,
              borderRadius: theme.BORDER_RADIUS.lg,
              borderWidth: 1,
              borderColor: theme.colors.info.main,
              backgroundColor: pressed ? `${theme.colors.info.main}12` : 'transparent',
            })}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.info.main} />
            <Text style={{ ...theme.typography.body2, color: theme.colors.info.main, fontWeight: '600' }}>
              Demander validation
            </Text>
          </Pressable>

          {isPending && (
            <Button title="Demarrer l'intervention" color="success" onPress={handleStartWork} fullWidth />
          )}
          {isInProgress && (
            <>
              <Button title="Documenter (photos)" variant="outlined" onPress={handleGoToPhotos} fullWidth />
              <Button title="Rapport final" color="success" onPress={handleGoToReport} fullWidth />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80 },
});
