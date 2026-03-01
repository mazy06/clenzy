import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Alert, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';

type RouteParams = {
  TechReport: { interventionId: number };
};

export function TechReportScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'TechReport'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;

  const { data: intervention } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  const [summary, setSummary] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');

  const handleSubmitReport = useCallback(() => {
    if (!summary.trim()) {
      Alert.alert('Resume requis', 'Decrivez les travaux effectues.');
      return;
    }

    Alert.alert('Cloturer l\'intervention', 'Cette action marquera l\'intervention comme terminee.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Valider',
        onPress: async () => {
          try {
            await updateMutation.mutateAsync({
              id: interventionId,
              data: {
                status: 'COMPLETED',
                technicianNotes: summary.trim(),
                materialsUsed: materialsUsed.trim() || undefined,
                actualCost: actualCost ? parseFloat(actualCost) : undefined,
                requiresFollowUp,
              },
            });
            Alert.alert('Intervention terminee', 'Le rapport a ete soumis.', [
              { text: 'OK', onPress: () => navigation.getParent()?.goBack() },
            ]);
          } catch {
            Alert.alert('Erreur', 'Impossible de soumettre le rapport.');
          }
        },
      },
    ]);
  }, [summary, materialsUsed, actualCost, requiresFollowUp, interventionId, updateMutation, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Rapport final</Text>
          {intervention && <StatusBadge status={intervention.status} />}
        </View>

        {/* Summary */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Resume des travaux</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Decrivez les travaux effectues, le resultat obtenu..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
          />
        </Card>

        {/* Materials & cost */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Materiaux et couts finaux</Text>
          <TextInput
            value={materialsUsed}
            onChangeText={setMaterialsUsed}
            placeholder="Pieces remplacees, produits utilises..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default, marginBottom: 12 }]}
          />
          <Input label="Cout reel (EUR)" value={actualCost} onChangeText={setActualCost} keyboardType="numeric" placeholder="0.00" />
        </Card>

        {/* Follow-up */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>Suivi necessaire ?</Text>
            <Switch
              value={requiresFollowUp}
              onValueChange={setRequiresFollowUp}
              trackColor={{ false: theme.colors.grey[300], true: theme.colors.warning.light }}
              thumbColor={requiresFollowUp ? theme.colors.warning.main : theme.colors.grey[100]}
            />
          </View>
          {requiresFollowUp && (
            <TextInput
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
              placeholder="Decrivez ce qui reste a faire..."
              placeholderTextColor={theme.colors.text.disabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
            />
          )}
        </Card>

        {/* Submit */}
        <Button
          title="Soumettre le rapport"
          onPress={handleSubmitReport}
          color="success"
          fullWidth
          loading={updateMutation.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 100 },
});
