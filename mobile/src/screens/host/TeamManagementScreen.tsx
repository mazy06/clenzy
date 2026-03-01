import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { useTeams } from '@/hooks/useTeams';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Divider } from '@/components/ui/Divider';
import type { Team, TeamMember } from '@/api/endpoints/teamsApi';

const ROLE_LABELS: Record<string, string> = {
  LEADER: 'Responsable',
  MEMBER: 'Membre',
  SUPERVISOR: 'Superviseur',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
}

function MemberRow({ member }: { member: TeamMember }) {
  const theme = useTheme();
  const isLead = member.role === 'LEADER' || member.role === 'SUPERVISOR';
  const color = isLead ? theme.colors.secondary.main : theme.colors.primary.main;

  const initials = member.userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: `${color}14`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.SPACING.sm,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color }}>{initials}</Text>
      </View>
      <Text
        style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 1 }}
        numberOfLines={1}
      >
        {member.userName}
      </Text>
      <Badge
        label={roleLabel(member.role)}
        color={isLead ? 'secondary' : 'primary'}
        size="small"
      />
    </View>
  );
}

function TeamCard({ team }: { team: Team }) {
  const theme = useTheme();
  const memberCount = team.members?.length ?? 0;

  return (
    <Card style={{ marginBottom: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: theme.SPACING.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: theme.BORDER_RADIUS.sm,
              backgroundColor: `${theme.colors.primary.main}0C`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={18} color={theme.colors.primary.main} />
          </View>
          <Text
            style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }}
            numberOfLines={1}
          >
            {team.name}
          </Text>
        </View>
        <Badge
          label={`${memberCount} membre${memberCount !== 1 ? 's' : ''}`}
          color="info"
          size="small"
        />
      </View>

      {team.description ? (
        <Text
          style={{
            ...theme.typography.body2,
            color: theme.colors.text.secondary,
            marginTop: theme.SPACING.xs,
            paddingLeft: 48,
          }}
        >
          {team.description}
        </Text>
      ) : null}

      {team.coverageZone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.SPACING.xs, paddingLeft: 48, gap: 4 }}>
          <Ionicons name="location-outline" size={14} color={theme.colors.text.disabled} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
            {team.coverageZone}
          </Text>
        </View>
      ) : null}

      {memberCount > 0 ? (
        <>
          <Divider />
          {team.members!.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </>
      ) : (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.text.disabled,
            marginTop: theme.SPACING.sm,
            fontStyle: 'italic',
          }}
        >
          Aucun membre dans cette equipe
        </Text>
      )}
    </Card>
  );
}

function TeamManagementSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton width="48%" height={72} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton width="48%" height={72} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
      <Skeleton width="40%" height={20} />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={130} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

export function TeamManagementScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { data: rawTeams, isLoading, isRefetching, refetch } = useTeams();

  // API may return a paginated wrapper ({ content: [...] }) or a raw array
  const teams: Team[] = Array.isArray(rawTeams) ? rawTeams : (rawTeams as any)?.content ?? [];
  const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length ?? 0), 0);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Gestion d'equipe</Text>
        </View>
        <TeamManagementSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING.lg,
          paddingBottom: theme.SPACING.md,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Gestion d'equipe
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.xl }}>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.lg,
              padding: theme.SPACING.md,
              alignItems: 'center',
              ...theme.shadows.sm,
            }}
          >
            <Ionicons name="people" size={18} color={theme.colors.primary.main} style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main }}>
              {teams?.length ?? 0}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Equipe{(teams?.length ?? 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.lg,
              padding: theme.SPACING.md,
              alignItems: 'center',
              ...theme.shadows.sm,
            }}
          >
            <Ionicons name="person" size={18} color={theme.colors.secondary.main} style={{ marginBottom: 4 }} />
            <Text style={{ ...theme.typography.h4, color: theme.colors.secondary.main }}>
              {totalMembers}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Membre{totalMembers !== 1 ? 's' : ''} total
            </Text>
          </View>
        </View>

        <SectionHeader title="Equipes" iconName="people-outline" />

        {!teams || teams.length === 0 ? (
          <EmptyState
            iconName="people-outline"
            title="Aucune equipe"
            description="Aucune equipe n'est configuree pour votre organisation."
          />
        ) : (
          teams.map((team) => <TeamCard key={team.id} team={team} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
