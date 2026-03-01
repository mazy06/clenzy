import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTeam } from '@/hooks/useTeams';
import { useInterventions, useUpdateIntervention } from '@/hooks/useInterventions';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

type RouteParams = { TeamAssignment: { teamId: number } };

export function TeamAssignmentScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'TeamAssignment'>>();
  const { teamId } = route.params;
  const { data: team } = useTeam(teamId);
  const updateMutation = useUpdateIntervention();

  // Unassigned pending interventions
  const { data: unassignedData, isRefetching, refetch } = useInterventions({
    status: 'PENDING',
    sort: 'priority,desc',
    size: 20,
  });

  // Already assigned to this team
  const { data: teamData } = useInterventions({
    teamId,
    status: 'SCHEDULED',
    size: 20,
  });

  const unassigned = useMemo(() => unassignedData?.content ?? [], [unassignedData]);
  const assigned = useMemo(() => teamData?.content ?? [], [teamData]);

  const handleAssign = useCallback(
    (intervention: Intervention) => {
      Alert.alert(
        'Assigner',
        `Assigner "${intervention.title || intervention.type}" a ${team?.name ?? 'cette equipe'} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Assigner',
            onPress: () => {
              updateMutation.mutate({
                id: intervention.id,
                data: { status: 'SCHEDULED', teamId },
              });
            },
          },
        ],
      );
    },
    [team, teamId, updateMutation],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>
          {team?.name ?? 'Equipe'}
        </Text>
        {team?.members && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.lg }}>
            {team.members.map((m) => m.userName).join(', ')}
          </Text>
        )}

        {/* Assigned missions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>Missions assignees</Text>
          <Badge label={String(assigned.length)} color="info" size="small" />
        </View>
        {assigned.length === 0 ? (
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, textAlign: 'center' }}>
              Aucune mission assignee
            </Text>
          </Card>
        ) : (
          <View style={{ marginBottom: theme.SPACING.lg }}>
            {assigned.map((item) => (
              <InterventionCard key={item.id} intervention={item} />
            ))}
          </View>
        )}

        {/* Unassigned - to assign */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>A assigner</Text>
          <Badge label={String(unassigned.length)} color="warning" size="small" />
        </View>
        {unassigned.length === 0 ? (
          <EmptyState title="Tout est assigne" description="Pas d'intervention en attente d'assignation" />
        ) : (
          unassigned.map((item) => (
            <View key={item.id}>
              <InterventionCard intervention={item} />
              <Button
                title={`Assigner a ${team?.name ?? 'equipe'}`}
                variant="outlined"
                size="small"
                onPress={() => handleAssign(item)}
                style={{ marginBottom: theme.SPACING.md, alignSelf: 'flex-end' }}
                loading={updateMutation.isPending}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
