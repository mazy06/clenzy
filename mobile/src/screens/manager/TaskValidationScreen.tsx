import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Image, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';

type RouteParams = { TaskValidation: { interventionId: number } };

export function TaskValidationScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'TaskValidation'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;
  const { data: intervention } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number>(0);

  const handleApprove = useCallback(() => {
    Alert.alert('Valider', 'Approuver cette intervention ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver',
        onPress: async () => {
          try {
            await updateMutation.mutateAsync({
              id: interventionId,
              data: {
                status: 'VALIDATED',
                customerFeedback: feedback.trim() || undefined,
                customerRating: rating || undefined,
              },
            });
            Alert.alert('Validee', 'L\'intervention a ete approuvee.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('Erreur', 'Impossible de valider.');
          }
        },
      },
    ]);
  }, [interventionId, feedback, rating, updateMutation, navigation]);

  const handleReject = useCallback(() => {
    if (!feedback.trim()) {
      Alert.alert('Commentaire requis', 'Merci d\'indiquer la raison du rejet.');
      return;
    }
    Alert.alert('Rejeter', 'Rejeter cette intervention ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Rejeter',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateMutation.mutateAsync({
              id: interventionId,
              data: {
                status: 'REJECTED',
                customerFeedback: feedback.trim(),
                customerRating: rating || undefined,
              },
            });
            Alert.alert('Rejetee', 'L\'intervention a ete rejetee.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('Erreur', 'Impossible de rejeter.');
          }
        },
      },
    ]);
  }, [interventionId, feedback, rating, updateMutation, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Validation</Text>
          {intervention && <StatusBadge status={intervention.status} />}
        </View>

        {/* Photos review */}
        {intervention && (intervention.beforePhotosUrls?.length || intervention.afterPhotosUrls?.length) ? (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Photos a verifier</Text>
            {intervention.beforePhotosUrls && intervention.beforePhotosUrls.length > 0 && (
              <>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Avant</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.SPACING.sm }}>
                  {intervention.beforePhotosUrls.map((uri, i) => (
                    <Image key={`b-${i}`} source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                  ))}
                </View>
              </>
            )}
            {intervention.afterPhotosUrls && intervention.afterPhotosUrls.length > 0 && (
              <>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Apres</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {intervention.afterPhotosUrls.map((uri, i) => (
                    <Image key={`a-${i}`} source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                  ))}
                </View>
              </>
            )}
          </Card>
        ) : null}

        {/* Rating */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Note</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                onPress={() => setRating(star)}
                style={{ fontSize: 28, color: star <= rating ? theme.colors.warning.main : theme.colors.grey[300] }}
              >
                ★
              </Text>
            ))}
          </View>
        </Card>

        {/* Feedback */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Commentaire</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Votre retour sur l'intervention..."
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
          />
        </Card>

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm }}>
          <Button title="Approuver" color="success" onPress={handleApprove} fullWidth loading={updateMutation.isPending} />
          <Button title="Rejeter" variant="outlined" color="error" onPress={handleReject} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80 },
});
