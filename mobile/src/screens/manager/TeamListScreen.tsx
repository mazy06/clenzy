import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTeams } from '@/hooks/useTeams';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Team } from '@/api/endpoints/teamsApi';

type TeamsStackNav = NativeStackNavigationProp<{
  TeamList: undefined;
  TeamAssignment: { teamId: number };
}>;

export function TeamListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<TeamsStackNav>();
  const { data: teams, isLoading, isRefetching, refetch } = useTeams();

  const handlePress = useCallback(
    (team: Team) => {
      navigation.navigate('TeamAssignment', { teamId: team.id });
    },
    [navigation],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>Equipes</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
              {teams?.length ?? 0} equipe{(teams?.length ?? 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          <NotificationBell />
        </View>

        {!teams || teams.length === 0 ? (
          <EmptyState title="Aucune equipe" description="Pas d'equipe configuree" />
        ) : (
          teams.map((team) => (
            <Card key={team.id} onPress={() => handlePress(team)} style={{ marginBottom: theme.SPACING.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.xs }}>
                <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>{team.name}</Text>
                <Badge label={`${team.members?.length ?? 0} membres`} color="info" size="small" />
              </View>
              {team.coverageZone && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>
                  Zone: {team.coverageZone}
                </Text>
              )}
              {team.members && team.members.length > 0 && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }} numberOfLines={1}>
                  {team.members.map((m) => m.userName).join(', ')}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
