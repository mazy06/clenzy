import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntervention, useUpdateIntervention } from '@/hooks/useInterventions';
import { ChecklistItem, type ChecklistItemData } from '@/components/domain/ChecklistItem';
import { MissionTimeline, type TimelineStep } from '@/components/domain/MissionTimeline';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTheme } from '@/theme';
import { createMMKV } from 'react-native-mmkv';
import { useUnreadConversationCount } from '@/hooks/useConversations';

const checklistStorage = createMMKV({ id: 'checklist-drafts' });

type RouteParams = {
  CleaningChecklist: { interventionId: number };
};

type TodayStackNav = NativeStackNavigationProp<{
  TodayMissions: undefined;
  CleaningChecklist: { interventionId: number };
  PhotoCapture: { interventionId: number; type: 'before' | 'after' };
  AnomalyReport: { interventionId: number };
  Signature: { interventionId: number };
}>;

// Default checklist template per room
function generateDefaultChecklist(type: string): ChecklistItemData[] {
  const rooms = type.includes('CLEANING')
    ? [
        { room: 'Entree', items: ['Nettoyage sol', 'Miroir et surfaces', 'Rangement chaussures'] },
        { room: 'Salon', items: ['Aspiration/balayage', 'Nettoyage surfaces', 'Coussins et deco'] },
        { room: 'Cuisine', items: ['Plan de travail', 'Evier et robinetterie', 'Electromenager', 'Poubelle videe'] },
        { room: 'Salle de bain', items: ['Douche/baignoire', 'WC', 'Lavabo et miroir', 'Serviettes fraiches'] },
        { room: 'Chambre', items: ['Lit refait (draps propres)', 'Aspiration sol', 'Surfaces et tables de nuit'] },
      ]
    : [{ room: 'General', items: ['Inspection', 'Nettoyage', 'Verification finale'] }];

  return rooms.flatMap((room) =>
    room.items.map((label, i) => ({
      id: `${room.room}-${i}`,
      label,
      room: room.room,
      completed: false,
    })),
  );
}

export function CleaningChecklistScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'CleaningChecklist'>>();
  const navigation = useNavigation<TodayStackNav>();
  const { interventionId } = route.params;

  const { data: intervention, isLoading } = useIntervention(interventionId);
  const updateMutation = useUpdateIntervention();

  // Load or initialize checklist from MMKV
  const [checklist, setChecklist] = useState<ChecklistItemData[]>(() => {
    const stored = checklistStorage.getString(`checklist-${interventionId}`);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fallback */ }
    }
    return [];
  });

  // Initialize checklist when intervention loads
  useEffect(() => {
    if (intervention && checklist.length === 0) {
      const defaultList = generateDefaultChecklist(intervention.type);
      setChecklist(defaultList);
      checklistStorage.set(`checklist-${interventionId}`, JSON.stringify(defaultList));
    }
  }, [intervention, checklist.length, interventionId]);

  // Persist to MMKV on changes
  const persistChecklist = useCallback(
    (items: ChecklistItemData[]) => {
      checklistStorage.set(`checklist-${interventionId}`, JSON.stringify(items));
    },
    [interventionId],
  );

  const handleToggle = useCallback(
    (id: string) => {
      setChecklist((prev) => {
        const updated = prev.map((item) =>
          item.id === id
            ? { ...item, completed: !item.completed, completedAt: !item.completed ? Date.now() : undefined }
            : item,
        );
        persistChecklist(updated);
        return updated;
      });
    },
    [persistChecklist],
  );

  const completedCount = checklist.filter((i) => i.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
  const allDone = checklist.length > 0 && completedCount === checklist.length;

  // Group by room
  const groupedRooms = useMemo(() => {
    const rooms = new Map<string, ChecklistItemData[]>();
    checklist.forEach((item) => {
      const room = item.room ?? 'General';
      if (!rooms.has(room)) rooms.set(room, []);
      rooms.get(room)!.push(item);
    });
    return Array.from(rooms.entries());
  }, [checklist]);

  // Timeline steps
  const timelineSteps: TimelineStep[] = useMemo(() => {
    const status = intervention?.status ?? 'PENDING';
    return [
      { label: 'Photos avant', status: status === 'IN_PROGRESS' || status === 'COMPLETED' ? 'completed' : status === 'PENDING' ? 'active' : 'pending' },
      { label: 'Nettoyage', status: status === 'IN_PROGRESS' ? 'active' : status === 'COMPLETED' ? 'completed' : 'pending' },
      { label: 'Photos apres', status: status === 'COMPLETED' ? 'completed' : allDone ? 'active' : 'pending' },
      { label: 'Signature', status: status === 'COMPLETED' ? 'completed' : 'pending' },
    ];
  }, [intervention?.status, allDone]);

  const handleStartIntervention = useCallback(() => {
    navigation.navigate('PhotoCapture', { interventionId, type: 'before' });
  }, [navigation, interventionId]);

  const handleTakeAfterPhotos = useCallback(() => {
    navigation.navigate('PhotoCapture', { interventionId, type: 'after' });
  }, [navigation, interventionId]);

  const handleReportAnomaly = useCallback(() => {
    navigation.navigate('AnomalyReport', { interventionId });
  }, [navigation, interventionId]);

  const handleFinish = useCallback(() => {
    navigation.navigate('Signature', { interventionId });
  }, [navigation, interventionId]);

  const handleStartCleaning = useCallback(() => {
    Alert.alert('Demarrer le nettoyage', 'Confirmer le debut de l\'intervention ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Demarrer',
        onPress: () => {
          updateMutation.mutate({ id: interventionId, data: { status: 'IN_PROGRESS' } });
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

  const isPending = intervention.status === 'PENDING' || intervention.status === 'SCHEDULED';
  const isInProgress = intervention.status === 'IN_PROGRESS';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.SPACING.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{intervention.title || intervention.type}</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>{intervention.propertyName}</Text>
          </View>
          <StatusBadge status={intervention.status} />
        </View>

        {/* Timeline */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>Progression</Text>
          <MissionTimeline steps={timelineSteps} />
        </Card>

        {/* Start / Photos avant */}
        {isPending && (
          <Button title="Prendre les photos avant" onPress={handleStartIntervention} fullWidth style={{ marginBottom: theme.SPACING.md }} />
        )}

        {/* Checklist progress */}
        {isInProgress && (
          <>
            <Card style={{ marginBottom: theme.SPACING.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.SPACING.xs }}>
                <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>Checklist</Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{completedCount}/{checklist.length}</Text>
              </View>
              <ProgressBar progress={progress} color="success" showLabel />
            </Card>

            {/* Rooms */}
            {groupedRooms.map(([room, items]) => (
              <Card key={room} style={{ marginBottom: theme.SPACING.sm }} noPadding>
                <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                  <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>{room}</Text>
                </View>
                {items.map((item) => (
                  <ChecklistItem key={item.id} item={item} onToggle={handleToggle} />
                ))}
              </Card>
            ))}
          </>
        )}

        {/* Action buttons */}
        {isPending && (
          <Button title="Demarrer le nettoyage" variant="outlined" onPress={handleStartCleaning} fullWidth style={{ marginBottom: theme.SPACING.sm }} />
        )}

        {isInProgress && (
          <View style={{ gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
            <Button title="Signaler une anomalie" variant="outlined" color="warning" onPress={handleReportAnomaly} fullWidth />

            {/* Contact manager shortcut */}
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
                borderColor: theme.colors.primary.main,
                backgroundColor: pressed ? `${theme.colors.primary.main}12` : 'transparent',
              })}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
                Contacter le manager
              </Text>
            </Pressable>

            {allDone && (
              <>
                <Button title="Prendre les photos apres" onPress={handleTakeAfterPhotos} fullWidth />
                <Button title="Terminer et signer" color="success" onPress={handleFinish} fullWidth />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
