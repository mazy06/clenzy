import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, DocumentType } from '@/api/endpoints/documentsApi';
import { reservationsApi } from '@/api/endpoints/reservationsApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type Step = 1 | 2 | 3;

const DOC_TYPES: { key: DocumentType; label: string; icon: IoniconsName; color: string; description: string }[] = [
  { key: 'FACTURE', label: 'Facture', icon: 'receipt-outline', color: '#2196F3', description: 'Facture de sejour pour le voyageur' },
  { key: 'RECU', label: 'Recu', icon: 'card-outline', color: '#4CAF50', description: 'Recu de paiement' },
  { key: 'CONTRAT', label: 'Contrat', icon: 'document-text-outline', color: '#9C27B0', description: 'Contrat de location courte duree' },
  { key: 'ATTESTATION', label: 'Attestation', icon: 'ribbon-outline', color: '#FF9800', description: 'Attestation d\'hebergement' },
];

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function StepIndicator({ currentStep, theme }: { currentStep: Step; theme: ReturnType<typeof useTheme> }) {
  const steps = [
    { number: 1, label: 'Type' },
    { number: 2, label: 'Reservation' },
    { number: 3, label: 'Confirmer' },
  ];

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.xl,
    }}>
      {steps.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        return (
          <React.Fragment key={step.number}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: isActive
                  ? theme.colors.primary.main
                  : isCompleted
                    ? theme.colors.success.main
                    : theme.colors.background.surface,
                borderWidth: isActive || isCompleted ? 0 : 1.5,
                borderColor: theme.colors.border.main,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={{
                    ...theme.typography.caption,
                    fontWeight: '700',
                    color: isActive ? '#fff' : theme.colors.text.disabled,
                  }}>
                    {step.number}
                  </Text>
                )}
              </View>
              <Text style={{
                ...theme.typography.caption,
                color: isActive ? theme.colors.primary.main : theme.colors.text.disabled,
                fontWeight: isActive ? '600' : '400',
                marginTop: 4,
              }}>
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={{
                flex: 0.5, height: 2,
                backgroundColor: isCompleted ? theme.colors.success.main : theme.colors.border.light,
                marginBottom: 20,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function DocumentGenerateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);

  /* Fetch reservations for step 2 */
  const { data: reservationsData, isLoading: loadingReservations } = useQuery({
    queryKey: ['reservations', 'list', {}],
    queryFn: () => reservationsApi.getAll(),
    enabled: step >= 2,
  });

  const reservations = useMemo(() => reservationsData?.content ?? [], [reservationsData]);

  const selectedReservation = useMemo(
    () => reservations.find((r) => r.id === selectedReservationId),
    [reservations, selectedReservationId],
  );

  const generateMutation = useMutation({
    mutationFn: () =>
      documentsApi.generate({
        documentType: selectedType!,
        referenceType: 'RESERVATION',
        referenceId: selectedReservationId!,
        sendEmail: false,
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      Alert.alert('Succes', 'Le document a ete genere avec succes.', [
        {
          text: 'Voir le document',
          onPress: () => {
            navigation.goBack();
            navigation.navigate('DocumentDetail', { documentId: doc.id });
          },
        },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Erreur', err?.message || 'Impossible de generer le document.');
    },
  });

  const handleNext = useCallback(() => {
    if (step === 1 && selectedType) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      generateMutation.mutate();
    }
  }, [step, selectedType, generateMutation]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const selectedTypeConfig = DOC_TYPES.find((t) => t.key === selectedType);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Generer un document
        </Text>
      </View>

      {/* Step indicator */}
      <StepIndicator currentStep={step} theme={theme} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Select type */}
        {step === 1 && (
          <View>
            <SectionHeader title="Type de document" iconName="document-outline" />
            <View style={{ gap: theme.SPACING.sm }}>
              {DOC_TYPES.map((type) => {
                const isSelected = selectedType === type.key;
                return (
                  <Card
                    key={type.key}
                    onPress={() => setSelectedType(type.key)}
                    variant={isSelected ? 'outlined' : 'default'}
                    style={{
                      borderColor: isSelected ? theme.colors.primary.main : undefined,
                      borderWidth: isSelected ? 2 : undefined,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.md,
                        backgroundColor: `${type.color}14`,
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: theme.SPACING.md,
                      }}>
                        <Ionicons name={type.icon} size={24} color={type.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                          {type.label}
                        </Text>
                        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                          {type.description}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary.main} />
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 2: Select reservation */}
        {step === 2 && (
          <View>
            <SectionHeader title="Reservation associee" iconName="bookmark-outline" />
            <Text style={{
              ...theme.typography.body2, color: theme.colors.text.secondary,
              marginBottom: theme.SPACING.md,
            }}>
              Selectionnez la reservation a associer au document (optionnel).
            </Text>

            {/* Skip option */}
            <Card
              onPress={() => setSelectedReservationId(null)}
              variant={selectedReservationId === null ? 'outlined' : 'default'}
              style={{
                marginBottom: theme.SPACING.sm,
                borderColor: selectedReservationId === null ? theme.colors.primary.main : undefined,
                borderWidth: selectedReservationId === null ? 2 : undefined,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 40, height: 40, borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: `${theme.colors.text.disabled}14`,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: theme.SPACING.md,
                }}>
                  <Ionicons name="remove-circle-outline" size={20} color={theme.colors.text.disabled} />
                </View>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1 }}>
                  Aucune reservation
                </Text>
                {selectedReservationId === null && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary.main} />
                )}
              </View>
            </Card>

            {loadingReservations ? (
              <View style={{ gap: theme.SPACING.sm }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={68} borderRadius={theme.BORDER_RADIUS.lg} />
                ))}
              </View>
            ) : reservations.length === 0 ? (
              <EmptyState
                compact
                iconName="calendar-outline"
                title="Aucune reservation"
                description="Aucune reservation disponible."
              />
            ) : (
              <View style={{ gap: theme.SPACING.sm }}>
                {reservations.slice(0, 20).map((res) => {
                  const isSelected = selectedReservationId === res.id;
                  return (
                    <Card
                      key={res.id}
                      onPress={() => setSelectedReservationId(res.id)}
                      variant={isSelected ? 'outlined' : 'default'}
                      style={{
                        borderColor: isSelected ? theme.colors.primary.main : undefined,
                        borderWidth: isSelected ? 2 : undefined,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                            {res.guestName ?? `Reservation #${res.id}`}
                          </Text>
                          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                            {formatDateShort(res.checkIn)} - {formatDateShort(res.checkOut)}
                            {res.propertyName ? ` | ${res.propertyName}` : ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary.main} />
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Step 3: Review & confirm */}
        {step === 3 && (
          <View>
            <SectionHeader title="Recapitulatif" iconName="list-outline" />

            <Card elevated style={{ marginBottom: theme.SPACING.lg }}>
              {/* Document type */}
              {selectedTypeConfig && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: `${selectedTypeConfig.color}14`,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: theme.SPACING.md,
                  }}>
                    <Ionicons name={selectedTypeConfig.icon} size={24} color={selectedTypeConfig.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Type</Text>
                    <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                      {selectedTypeConfig.label}
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginVertical: theme.SPACING.sm }} />

              {/* Reservation */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.SPACING.sm }}>
                <View style={{
                  width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: `${theme.colors.info.main}14`,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: theme.SPACING.md,
                }}>
                  <Ionicons name="bookmark-outline" size={24} color={theme.colors.info.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Reservation</Text>
                  {selectedReservation ? (
                    <View>
                      <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                        {selectedReservation.guestName ?? `#${selectedReservation.id}`}
                      </Text>
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                        {formatDateShort(selectedReservation.checkIn)} - {formatDateShort(selectedReservation.checkOut)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                      Aucune reservation associee
                    </Text>
                  )}
                </View>
              </View>
            </Card>

            {generateMutation.isPending && (
              <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.xl }}>
                <ActivityIndicator size="large" color={theme.colors.primary.main} />
                <Text style={{
                  ...theme.typography.body2, color: theme.colors.text.secondary,
                  marginTop: theme.SPACING.md,
                }}>
                  Generation du document en cours...
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: theme.colors.background.paper,
        borderTopWidth: 1, borderTopColor: theme.colors.border.light,
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.md,
        paddingBottom: theme.SPACING['2xl'],
        flexDirection: 'row',
        gap: theme.SPACING.sm,
        ...theme.shadows.lg,
      }}>
        {step > 1 && (
          <Button
            title="Precedent"
            variant="outlined"
            size="medium"
            onPress={handleBack}
            style={{ flex: 1 }}
          />
        )}
        <Button
          title={step === 3 ? 'Generer' : 'Suivant'}
          variant="contained"
          size="medium"
          onPress={handleNext}
          disabled={step === 1 && !selectedType}
          loading={generateMutation.isPending}
          style={{ flex: 1 }}
          icon={
            step === 3
              ? <Ionicons name="document-outline" size={18} color="#fff" />
              : <Ionicons name="arrow-forward" size={18} color="#fff" />
          }
        />
      </View>
    </SafeAreaView>
  );
}
