import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet, Pressable, AppState } from 'react-native';
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
import { createMMKV } from 'react-native-mmkv';

const diagStorage = createMMKV({ id: 'diagnostic-drafts' });

type RouteParams = {
  DiagnosticForm: { interventionId: number };
};

type TicketsStackNav = NativeStackNavigationProp<{
  TicketQueue: undefined;
  DiagnosticForm: { interventionId: number };
  PhotoDoc: { interventionId: number };
  TechReport: { interventionId: number };
  TechSignature: { interventionId: number };
}>;

/* ─── Parts List ─── */

interface PartItem {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

function PartsListCard({
  parts,
  onAddPart,
  onUpdatePart,
  onRemovePart,
  totalCost,
  theme,
}: {
  parts: PartItem[];
  onAddPart: () => void;
  onUpdatePart: (id: string, field: keyof PartItem, value: string) => void;
  onRemovePart: (id: string) => void;
  totalCost: number;
  theme: ReturnType<typeof import('@/theme').useTheme>;
}) {
  return (
    <Card style={{ marginBottom: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.SPACING.md }}>
        <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>Pieces et materiaux</Text>
        <Pressable
          onPress={onAddPart}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.primary.main}10`,
          }}
        >
          <Ionicons name="add" size={14} color={theme.colors.primary.main} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>Ajouter</Text>
        </Pressable>
      </View>

      {parts.length === 0 ? (
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, textAlign: 'center', paddingVertical: theme.SPACING.lg }}>
          Aucune piece ajoutee
        </Text>
      ) : (
        <>
          {/* Header row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, paddingHorizontal: 2 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 3 }}>Designation</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 1, textAlign: 'center' }}>Qte</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 1.5, textAlign: 'center' }}>Prix unit.</Text>
            <View style={{ width: 28 }} />
          </View>

          {parts.map((part) => (
            <View key={part.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TextInput
                value={part.name}
                onChangeText={(t) => onUpdatePart(part.id, 'name', t)}
                placeholder="Piece..."
                placeholderTextColor={theme.colors.text.disabled}
                style={[styles.partInput, { flex: 3, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              />
              <TextInput
                value={part.quantity}
                onChangeText={(t) => onUpdatePart(part.id, 'quantity', t)}
                placeholder="1"
                placeholderTextColor={theme.colors.text.disabled}
                keyboardType="numeric"
                style={[styles.partInput, { flex: 1, textAlign: 'center', borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              />
              <TextInput
                value={part.unitPrice}
                onChangeText={(t) => onUpdatePart(part.id, 'unitPrice', t)}
                placeholder="0.00"
                placeholderTextColor={theme.colors.text.disabled}
                keyboardType="numeric"
                style={[styles.partInput, { flex: 1.5, textAlign: 'center', borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              />
              <Pressable onPress={() => onRemovePart(part.id)} hitSlop={6} style={{ width: 28, alignItems: 'center' }}>
                <Ionicons name="close-circle-outline" size={18} color={theme.colors.error.main} />
              </Pressable>
            </View>
          ))}

          {/* Total */}
          <View style={{
            flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
            paddingTop: theme.SPACING.sm, borderTopWidth: 1, borderTopColor: theme.colors.border.light,
            marginTop: 4,
          }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginRight: theme.SPACING.sm }}>
              Total estimé :
            </Text>
            <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main }}>
              {totalCost.toFixed(2)} EUR
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}

/* ─── Timer ─── */

function useWorkTimer(interventionId: number, isRunning: boolean) {
  const storageKey = `tech-timer-${interventionId}`;
  const [elapsed, setElapsed] = useState(() => {
    const stored = diagStorage.getString(storageKey);
    if (stored) {
      try {
        const { elapsed: e, lastTick } = JSON.parse(stored);
        if (lastTick && isRunning) {
          return (e ?? 0) + Math.floor((Date.now() - lastTick) / 1000);
        }
        return e ?? 0;
      } catch { /* fallback */ }
    }
    return 0;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev: number) => {
          const next = prev + 1;
          diagStorage.set(storageKey, JSON.stringify({ elapsed: next, lastTick: Date.now() }));
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, storageKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isRunning) {
        const stored = diagStorage.getString(storageKey);
        if (stored) {
          try {
            const { elapsed: e, lastTick } = JSON.parse(stored);
            setElapsed((e ?? 0) + Math.floor((Date.now() - lastTick) / 1000));
          } catch { /* ignore */ }
        }
      }
    });
    return () => sub.remove();
  }, [isRunning, storageKey]);

  return elapsed;
}

function formatTimer(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/* ─── Diagnostic Steps ─── */

const DIAGNOSTIC_STEPS = [
  { key: 'identify', label: 'Identifier le probleme', icon: 'search-outline' as const },
  { key: 'analyze', label: 'Analyser les causes', icon: 'analytics-outline' as const },
  { key: 'estimate', label: 'Estimer les couts', icon: 'calculator-outline' as const },
  { key: 'plan', label: 'Planifier la reparation', icon: 'clipboard-outline' as const },
];

/* ─── Main Screen ─── */

export function DiagnosticFormScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'DiagnosticForm'>>();
  const navigation = useNavigation<TicketsStackNav>();
  const { interventionId } = route.params;

  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');

  // Parts list
  const [parts, setParts] = useState<PartItem[]>([]);
  const nextPartId = useRef(1);

  const handleAddPart = useCallback(() => {
    setParts((prev) => [...prev, { id: `part-${nextPartId.current++}`, name: '', quantity: '1', unitPrice: '' }]);
  }, []);

  const handleUpdatePart = useCallback((id: string, field: keyof PartItem, value: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, []);

  const handleRemovePart = useCallback((id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const totalCost = parts.reduce((sum, p) => {
    const qty = parseFloat(p.quantity) || 0;
    const price = parseFloat(p.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

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
    const materialsStr = parts
      .filter((p) => p.name.trim())
      .map((p) => `${p.name} x${p.quantity} (${p.unitPrice}€)`)
      .join(', ');

    updateMutation.mutate({
      id: interventionId,
      data: {
        technicianNotes: [diagnosis, notes].filter(Boolean).join('\n\n'),
        materialsUsed: materialsStr || undefined,
        estimatedCost: totalCost > 0 ? totalCost : undefined,
        estimatedDurationHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      },
    });
    Alert.alert('Diagnostic enregistre', 'Les informations ont ete sauvegardees.');
  }, [interventionId, diagnosis, notes, parts, totalCost, estimatedHours, updateMutation]);

  const handleGoToPhotos = useCallback(() => {
    navigation.navigate('PhotoDoc', { interventionId });
  }, [navigation, interventionId]);

  const handleGoToReport = useCallback(() => {
    navigation.navigate('TechReport', { interventionId });
  }, [navigation, interventionId]);

  const handleGoToSignature = useCallback(() => {
    navigation.navigate('TechSignature', { interventionId });
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const elapsed = useWorkTimer(interventionId, isInProgress);

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

        {/* Timer (when in progress) */}
        {isInProgress && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                <View style={{
                  width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: `${theme.colors.primary.main}12`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="timer-outline" size={18} color={theme.colors.primary.main} />
                </View>
                <View>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Temps de travail</Text>
                  <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, fontVariant: ['tabular-nums'] }}>
                    {formatTimer(elapsed)}
                  </Text>
                </View>
              </View>
              {intervention.estimatedDurationHours != null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Estime</Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, fontWeight: '600' }}>
                    {intervention.estimatedDurationHours}h
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Diagnostic steps guide */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
            Etapes du diagnostic
          </Text>
          {DIAGNOSTIC_STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <Pressable
                key={step.key}
                onPress={() => setCurrentStep(i)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md,
                  paddingVertical: 10,
                  borderBottomWidth: i < DIAGNOSTIC_STEPS.length - 1 ? 1 : 0,
                  borderBottomColor: theme.colors.border.light,
                }}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: isDone ? theme.colors.success.main : isActive ? theme.colors.primary.main : theme.colors.background.surface,
                  borderWidth: !isDone && !isActive ? 1 : 0,
                  borderColor: theme.colors.border.main,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Ionicons name={step.icon} size={14} color={isActive ? '#fff' : theme.colors.text.disabled} />
                  )}
                </View>
                <Text style={{
                  ...theme.typography.body2, flex: 1,
                  color: isDone ? theme.colors.success.main : isActive ? theme.colors.text.primary : theme.colors.text.secondary,
                  fontWeight: isActive ? '600' : '400',
                }}>
                  {step.label}
                </Text>
                {isActive && (
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.primary.main} />
                )}
              </Pressable>
            );
          })}
        </Card>

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

        {/* Structured parts list */}
        <PartsListCard
          parts={parts}
          onAddPart={handleAddPart}
          onUpdatePart={handleUpdatePart}
          onRemovePart={handleRemovePart}
          totalCost={totalCost}
          theme={theme}
        />

        {/* Duration estimate */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Input
            label="Duree estimee (heures)"
            value={estimatedHours}
            onChangeText={setEstimatedHours}
            keyboardType="numeric"
            placeholder="Ex: 2.5"
          />
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
              <Button title="Rapport final" variant="outlined" onPress={handleGoToReport} fullWidth />
              <Button title="Signature client" color="success" onPress={handleGoToSignature} fullWidth icon={<Ionicons name="pencil-outline" size={16} color="#fff" />} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, minHeight: 80 },
  partInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 36,
  },
});
