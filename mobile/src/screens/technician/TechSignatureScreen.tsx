import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme';

type RouteParams = {
  TechSignature: { interventionId: number };
};

/* ─── Simple Signature Pad (touch-based) ─── */

function SignaturePlaceholder({ hasSigned, onSign, theme }: {
  hasSigned: boolean;
  onSign: () => void;
  theme: ReturnType<typeof import('@/theme').useTheme>;
}) {
  return (
    <Pressable
      onPress={onSign}
      style={{
        height: 160,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: hasSigned ? theme.colors.success.main : theme.colors.border.main,
        borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: hasSigned ? `${theme.colors.success.main}06` : theme.colors.background.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.SPACING.sm,
      }}
    >
      {hasSigned ? (
        <>
          <Ionicons name="checkmark-circle" size={32} color={theme.colors.success.main} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.success.main, fontWeight: '600' }}>
            Signature enregistree
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
            Appuyez pour modifier
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="pencil-outline" size={28} color={theme.colors.text.disabled} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
            Appuyez pour signer
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ─── Work Summary ─── */

function WorkSummary({ intervention, theme }: {
  intervention: any;
  theme: ReturnType<typeof import('@/theme').useTheme>;
}) {
  const items = [
    { icon: 'construct-outline' as const, label: 'Type', value: intervention.type },
    { icon: 'home-outline' as const, label: 'Propriete', value: intervention.propertyName },
    intervention.materialsUsed && { icon: 'cube-outline' as const, label: 'Materiaux', value: intervention.materialsUsed },
    intervention.estimatedCost != null && { icon: 'card-outline' as const, label: 'Cout', value: `${intervention.estimatedCost.toFixed(2)} EUR` },
    intervention.estimatedDurationHours != null && { icon: 'time-outline' as const, label: 'Duree', value: `${intervention.estimatedDurationHours}h` },
    intervention.technicianNotes && { icon: 'document-text-outline' as const, label: 'Notes', value: intervention.technicianNotes },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  return (
    <Card style={{ marginBottom: theme.SPACING.md }}>
      <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
        Resume des travaux
      </Text>
      {items.map((item, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 8,
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: theme.colors.border.light,
          }}
        >
          <Ionicons name={item.icon as any} size={16} color={theme.colors.text.secondary} style={{ marginTop: 2, marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{item.label}</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 2 }}>{item.value}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/* ─── Main Screen ─── */

export function TechSignatureScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'TechSignature'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;

  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  const [clientName, setClientName] = useState('');
  const [hasSigned, setHasSigned] = useState(false);
  const [clientFeedback, setClientFeedback] = useState('');
  const [rating, setRating] = useState(0);

  const handleSign = useCallback(() => {
    // In a real app, this would open a signature drawing canvas
    Alert.alert(
      'Signature client',
      'Le client confirme que les travaux ont ete realises conformement au devis.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer la signature', onPress: () => setHasSigned(true) },
      ],
    );
  }, []);

  const handleComplete = useCallback(() => {
    if (!hasSigned) {
      Alert.alert('Signature requise', 'La signature du client est necessaire pour valider.');
      return;
    }

    Alert.alert(
      'Terminer l\'intervention',
      'Confirmer la fin des travaux et soumettre le rapport ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          onPress: () => {
            updateMutation.mutate(
              {
                id: interventionId,
                data: {
                  status: 'COMPLETED',
                  customerFeedback: clientFeedback || undefined,
                  customerRating: rating > 0 ? rating : undefined,
                },
              },
              {
                onSuccess: () => {
                  Alert.alert('Intervention terminee', 'Le rapport a ete soumis avec succes.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                  ]);
                },
              },
            );
          },
        },
      ],
    );
  }, [hasSigned, interventionId, clientFeedback, rating, updateMutation, navigation]);

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
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        backgroundColor: theme.colors.background.paper, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>Signature client</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{intervention.title || intervention.type}</Text>
        </View>
        <StatusBadge status={intervention.status} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Work summary */}
        <WorkSummary intervention={intervention} theme={theme} />

        {/* Client info */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
            Informations client
          </Text>
          <Input
            label="Nom du client (optionnel)"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Nom de la personne presente"
          />
        </Card>

        {/* Rating */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
            Satisfaction client
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.SPACING.md }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} hitSlop={4}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= rating ? theme.colors.secondary.main : theme.colors.border.main}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 8 }}>
              {rating === 5 ? 'Excellent' : rating === 4 ? 'Tres bien' : rating === 3 ? 'Correct' : rating === 2 ? 'A ameliorer' : 'Insatisfait'}
            </Text>
          )}
        </Card>

        {/* Client feedback */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>
            Commentaire client (optionnel)
          </Text>
          <Input
            value={clientFeedback}
            onChangeText={setClientFeedback}
            placeholder="Remarques du client..."
            multiline
          />
        </Card>

        {/* Signature */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
            Signature
          </Text>
          <SignaturePlaceholder hasSigned={hasSigned} onSign={handleSign} theme={theme} />
        </Card>

        {/* Submit */}
        <Button
          title="Terminer l'intervention"
          onPress={handleComplete}
          color="success"
          fullWidth
          loading={updateMutation.isPending}
          icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
