import React, { useEffect,useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Image, Alert, StyleSheet, Pressable } from 'react-native';
import { Reicon } from '@/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useIntervention } from '@/hooks/useInterventions';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { BAITLY_QUERY_ROOT } from '@/config/baitlyCache';
import { StatusBadge } from '@/components/domain';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import { BaitlyScreen, BaitlyLoading, BaitlyEmpty } from '@/design-system/components';

type RouteParams = { TaskValidation: { interventionId: number } };

export function TaskValidationScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'TaskValidation'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;
  const { data: intervention, isPending, isError, refetch } = useIntervention(interventionId);
  const cache=useQueryClient();
  const updateMutation=useMutation({mutationFn:(body:Parameters<typeof interventionsApi.managerReview>[1])=>interventionsApi.managerReview(interventionId,body),retry:false,
    onSettled:async()=>{await Promise.all([cache.invalidateQueries({queryKey:['interventions']}),cache.invalidateQueries({queryKey:[BAITLY_QUERY_ROOT]})]);}});

  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [amount,setAmount]=useState('');
  useEffect(()=>{if(intervention?.estimatedCost!=null)setAmount(String(intervention.estimatedCost));},[intervention?.estimatedCost]);
  useEffect(()=>{setRating(intervention?.customerRating??0);setFeedback(intervention?.customerFeedback??'');},[intervention?.id,intervention?.customerRating,intervention?.customerFeedback]);

  const handleApprove = useCallback(() => {
    Alert.alert('Valider', 'Approuver cette intervention ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver',
        onPress: async () => {
          try {
            await updateMutation.mutateAsync({decision:'approve',version:intervention!.version!,amount:amount.trim().replace(',','.'),feedback:feedback.trim()||undefined,rating:rating||undefined});
            Alert.alert('Validée', 'Le contrôle est enregistré. La mission suit maintenant le paiement prévu par le PMS.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('Erreur', 'Impossible de valider.');
          }
        },
      },
    ]);
  }, [intervention, amount, feedback, rating, updateMutation, navigation]);

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
            await updateMutation.mutateAsync({decision:'reject',version:intervention!.version!,feedback:feedback.trim(),rating:rating||undefined});
            Alert.alert('Rejetee', 'L\'intervention a été rejetée.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('Erreur', 'Impossible de rejeter.');
          }
        },
      },
    ]);
  }, [intervention, feedback, rating, updateMutation, navigation]);

  if (isPending) return <BaitlyScreen><BaitlyLoading /></BaitlyScreen>;
  if (isError || !intervention) return <BaitlyScreen><BaitlyEmpty title="Impossible de charger la mission" retry={() => { void refetch(); }} /></BaitlyScreen>;
  return (
    <BaitlyScreen>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Validation</Text>
          {intervention && <StatusBadge status={intervention.status} />}
        </View>

        {/* Photos review */}
        {intervention && (intervention.beforePhotosUrls?.length || intervention.afterPhotosUrls?.length) ? (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Photos a vérifier</Text>
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
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>Après</Text>
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
        <Card style={{marginBottom:theme.SPACING.md}}>
          <Text style={{...theme.typography.h5,color:theme.colors.text.primary}}>Montant à valider {intervention.currency?`(${intervention.currency})`:''}</Text>
          <TextInput accessibilityLabel="Montant à valider" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!updateMutation.isPending} style={[styles.textArea,{minHeight:48,color:theme.colors.text.primary,borderColor:theme.colors.border.main}]}/>
        </Card>
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Note</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                accessibilityRole="button" accessibilityLabel={`${star} sur 5`} accessibilityState={{ selected: star === rating }}
                onPress={() => setRating(star)}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Reicon name={star <= rating ? 'star' : 'star-outline'} size={26} color={star <= rating ? theme.colors.warning.main : theme.colors.text.secondary} />
              </Pressable>
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
            maxLength={1000}
            editable={!updateMutation.isPending}
            textAlignVertical="top"
            style={[styles.textArea, { borderColor: theme.colors.border.main, color: theme.colors.text.primary, backgroundColor: theme.colors.background.default }]}
          />
        </Card>

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm }}>
          <Button title="Approuver" color="success" onPress={handleApprove} fullWidth loading={updateMutation.isPending} disabled={intervention.status!=='AWAITING_VALIDATION'||intervention.version==null||!/^\d{1,10}([.,]\d{1,2})?$/.test(amount.trim())} />
          <Button title="Rejeter" variant="outlined" color="error" onPress={handleReject} fullWidth disabled={updateMutation.isPending||intervention.status!=='AWAITING_VALIDATION'||intervention.version==null} />
        </View>
    </BaitlyScreen>
  );
}

const styles = StyleSheet.create({
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80 },
});
