import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useCreateIntervention } from '@/hooks/useInterventions';
import { useProperties } from '@/hooks/useProperties';
import { useTeams } from '@/hooks/useTeams';

/* ─── Constants ─── */

const INTERVENTION_TYPES = [
  { value: 'CLEANING', label: 'Menage' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'REPAIR', label: 'Reparation' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'DEEP_CLEANING', label: 'Menage en profondeur' },
  { value: 'CHECK_IN_PREP', label: 'Preparation check-in' },
  { value: 'CHECK_OUT_CLEAN', label: 'Menage check-out' },
  { value: 'OTHER', label: 'Autre' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Basse' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'URGENT', label: 'Urgente' },
];

/* ─── Main Screen ─── */

export function CreateInterventionScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const createMutation = useCreateIntervention();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [propertyId, setPropertyId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetched data
  const { data: propertiesData } = useProperties();
  const { data: teams } = useTeams();

  const propertyOptions = useMemo(() => {
    const properties = propertiesData?.content ?? [];
    return properties.map((p) => ({ label: p.name, value: String(p.id) }));
  }, [propertiesData]);

  const teamOptions = useMemo(() => {
    if (!teams?.length) return [];
    return teams.map((t) => ({ label: t.name, value: String(t.id) }));
  }, [teams]);

  const clearError = useCallback((key: string) => {
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }, []);

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Titre requis';
    if (!type) newErrors.type = 'Type requis';
    if (!propertyId) newErrors.propertyId = 'Propriete requise';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build start time ISO string
    let startTimeISO: string | undefined;
    if (scheduledDate) {
      const timeStr = startTime || '09:00';
      startTimeISO = `${scheduledDate}T${timeStr}:00`;
    }

    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        propertyId: parseInt(propertyId, 10),
        teamId: teamId ? parseInt(teamId, 10) : undefined,
        scheduledDate: scheduledDate || undefined,
        startTime: startTimeISO,
        estimatedDurationHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        isUrgent,
        requiresFollowUp: false,
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Intervention creee',
            'L\'intervention a ete creee avec succes.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de creer l\'intervention. Veuillez reessayer.');
        },
      },
    );
  }, [title, description, type, priority, propertyId, teamId, scheduledDate, startTime, estimatedHours, isUrgent, createMutation, navigation]);

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
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Nouvelle intervention
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* General info */}
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
              Informations generales
            </Text>

            <Input
              label="Titre"
              value={title}
              onChangeText={(t) => { setTitle(t); clearError('title'); }}
              placeholder="Ex: Menage chambre principale"
              error={errors.title}
            />

            <View style={{ marginTop: theme.SPACING.md }}>
              <Select
                label="Type d'intervention"
                options={INTERVENTION_TYPES}
                value={type}
                onChange={(v) => { setType(v); clearError('type'); }}
                error={errors.type}
              />
            </View>

            <View style={{ marginTop: theme.SPACING.md }}>
              <Select
                label="Propriete"
                options={propertyOptions}
                value={propertyId}
                onChange={(v) => { setPropertyId(v); clearError('propertyId'); }}
                error={errors.propertyId}
              />
            </View>

            <View style={{ marginTop: theme.SPACING.md }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '500', marginBottom: 6 }}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Details sur l'intervention..."
                placeholderTextColor={theme.colors.text.disabled}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.border.light,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  padding: 12,
                  minHeight: 100,
                  ...theme.typography.body2,
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.paper,
                }}
              />
            </View>
          </Card>

          {/* Priority & Urgency */}
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
              Priorite
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priority === opt.value;
                const colorMap: Record<string, string> = {
                  LOW: theme.colors.success.main,
                  MEDIUM: theme.colors.info.main,
                  HIGH: theme.colors.warning.main,
                  URGENT: theme.colors.error.main,
                };
                const chipColor = colorMap[opt.value] ?? theme.colors.primary.main;

                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPriority(opt.value)}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 10,
                      borderRadius: theme.BORDER_RADIUS.sm,
                      backgroundColor: isSelected ? chipColor : `${chipColor}08`,
                      borderWidth: 1,
                      borderColor: isSelected ? chipColor : `${chipColor}30`,
                    }}
                  >
                    <Text style={{
                      ...theme.typography.caption, fontWeight: '600',
                      color: isSelected ? '#fff' : chipColor,
                    }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: theme.SPACING.sm }}>
              <ToggleRow
                label="Urgente"
                description="Marquer cette intervention comme urgente"
                value={isUrgent}
                onValueChange={setIsUrgent}
                iconName="alert-circle-outline"
                iconColor={theme.colors.error.main}
              />
            </View>
          </Card>

          {/* Planning */}
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
              Planification
            </Text>

            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Date"
                  value={scheduledDate}
                  onChangeText={setScheduledDate}
                  placeholder="AAAA-MM-JJ"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Heure debut"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                />
              </View>
            </View>

            <View style={{ marginTop: theme.SPACING.md }}>
              <Input
                label="Duree estimee (heures)"
                value={estimatedHours}
                onChangeText={setEstimatedHours}
                keyboardType="numeric"
                placeholder="Ex: 2.5"
              />
            </View>
          </Card>

          {/* Team assignment */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
              Assignation
            </Text>

            <Select
              label="Equipe (optionnel)"
              options={teamOptions}
              value={teamId}
              onChange={setTeamId}
              placeholder="Selectionner une equipe..."
            />
          </Card>

          {/* Submit */}
          <Button
            title="Creer l'intervention"
            onPress={handleSubmit}
            fullWidth
            loading={createMutation.isPending}
            icon={<Ionicons name="add-circle-outline" size={18} color="#fff" />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
