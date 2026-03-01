import React, { useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useInterventions } from '@/hooks/useInterventions';
import { useUnreadConversationCount } from '@/hooks/useConversations';
import { StatusBadge, PriorityBadge } from '@/components/domain';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Intervention } from '@/api/endpoints/interventionsApi';

function formatHour(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function TimelineRow({ intervention }: { intervention: Intervention }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', marginBottom: theme.SPACING.sm }}>
      {/* Time column */}
      <View style={{ width: 56, alignItems: 'flex-end', marginRight: theme.SPACING.sm, paddingTop: 2 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '600' }}>
          {formatHour(intervention.startTime)}
        </Text>
      </View>

      {/* Dot + line */}
      <View style={{ width: 16, alignItems: 'center' }}>
        <View style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor:
            intervention.status === 'COMPLETED' ? theme.colors.success.main :
            intervention.status === 'IN_PROGRESS' ? theme.colors.warning.main :
            theme.colors.grey[300],
          marginTop: 4,
        }} />
        <View style={{ width: 2, flex: 1, backgroundColor: theme.colors.border.light, marginTop: 2 }} />
      </View>

      {/* Content */}
      <Card style={{ flex: 1, marginLeft: theme.SPACING.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {intervention.title || intervention.type}
          </Text>
          <StatusBadge status={intervention.status} />
        </View>
        {intervention.propertyName && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
            {intervention.propertyName}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.xs, marginTop: 4 }}>
          {intervention.assignedTechnicianName && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main }}>
              {intervention.assignedTechnicianName}
            </Text>
          )}
          {intervention.teamName && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.info.main }}>
              {intervention.teamName}
            </Text>
          )}
          <PriorityBadge priority={intervention.priority} />
        </View>
      </Card>
    </View>
  );
}

export function PlanningDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { data: unreadData } = useUnreadConversationCount();
  const unreadCount = unreadData?.count ?? 0;
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading, isRefetching, refetch } = useInterventions({
    startDate: today,
    endDate: today,
    sort: 'startTime,asc',
    size: 50,
  });

  const interventions = useMemo(() => data?.content ?? [], [data]);

  const countByStatus = useMemo(() => {
    const c = { pending: 0, inProgress: 0, completed: 0 };
    for (const i of interventions) {
      if (i.status === 'COMPLETED') c.completed++;
      else if (i.status === 'IN_PROGRESS') c.inProgress++;
      else c.pending++;
    }
    return c;
  }, [interventions]);

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
            <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>Planning</Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <NotificationBell />
        </View>

        {/* Unread messages banner */}
        {unreadCount > 0 && (
          <Pressable
            onPress={() => navigation.navigate('Messages')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.SPACING.sm,
              padding: theme.SPACING.md,
              marginBottom: theme.SPACING.md,
              backgroundColor: pressed ? `${theme.colors.primary.main}18` : `${theme.colors.primary.main}0A`,
              borderRadius: theme.BORDER_RADIUS.lg,
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.primary.main,
            })}
          >
            <Ionicons name="chatbubbles" size={20} color={theme.colors.primary.main} />
            <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600', flex: 1 }}>
              {unreadCount} message{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary.main} />
          </Pressable>
        )}

        {/* Summary chips */}
        <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>{countByStatus.pending}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En attente</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h4, color: theme.colors.warning.main }}>{countByStatus.inProgress}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En cours</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h4, color: theme.colors.success.main }}>{countByStatus.completed}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Terminees</Text>
          </Card>
        </View>

        {/* Timeline */}
        {interventions.length === 0 ? (
          <EmptyState
            iconName="clipboard-outline"
            title="Aucune intervention"
            description="Pas d'intervention prevue aujourd'hui"
            style={{ paddingVertical: theme.SPACING.xl }}
          />
        ) : (
          interventions.map((item) => <TimelineRow key={item.id} intervention={item} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
