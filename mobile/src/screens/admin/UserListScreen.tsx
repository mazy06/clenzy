import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';

export interface UserSummary {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  enabled: boolean;
  createdAt: string;
  lastLogin?: string;
  organizationName?: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' }> = {
  HOST: { label: 'Proprietaire', color: 'primary' },
  TECHNICIAN: { label: 'Technicien', color: 'info' },
  HOUSEKEEPER: { label: 'Agent menage', color: 'success' },
  SUPERVISOR: { label: 'Superviseur', color: 'warning' },
  ADMIN: { label: 'Admin', color: 'error' },
  SUPER_ADMIN: { label: 'Super Admin', color: 'error' },
  SUPER_MANAGER: { label: 'Super Manager', color: 'secondary' },
};

function getRoleConfig(roles: string[]) {
  const role = roles[0] ?? 'HOST';
  return ROLE_CONFIG[role] ?? { label: role, color: 'neutral' as const };
}

function UserListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={28} />
      <Skeleton width="100%" height={48} borderRadius={theme.BORDER_RADIUS.md} />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

function UserCard({ user, onPress }: { user: UserSummary; onPress: () => void }) {
  const theme = useTheme();
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  const roleCfg = getRoleConfig(user.roles);

  return (
    <Card onPress={onPress} style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
        <Avatar name={fullName} size={44} />
        <View style={{ flex: 1 }}>
          <Text
            style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          <Text
            style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}
            numberOfLines={1}
          >
            {user.email}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={roleCfg.label} color={roleCfg.color} size="small" />
          <Badge
            label={user.enabled ? 'Actif' : 'Inactif'}
            color={user.enabled ? 'success' : 'neutral'}
            size="small"
            dot
          />
        </View>
      </View>
    </Card>
  );
}

export function UserListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<{ content: UserSummary[] }>('/admin/users', { params: { size: '500' } }),
  });

  const allUsers: UserSummary[] = (data as any)?.content ?? (Array.isArray(data) ? data : []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [allUsers, search]);

  const stats = useMemo(() => ({
    total: allUsers.length,
    active: allUsers.filter((u) => u.enabled).length,
    inactive: allUsers.filter((u) => !u.enabled).length,
  }), [allUsers]);

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
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Utilisateurs</Text>
        </View>
        <UserListSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
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
          Utilisateurs
        </Text>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: theme.SPACING.lg, gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
        {[
          { value: stats.total, label: 'Total', color: theme.colors.primary.main },
          { value: stats.active, label: 'Actifs', color: theme.colors.success.main },
          { value: stats.inactive, label: 'Inactifs', color: theme.colors.error.main },
        ].map((s) => (
          <View key={s.label} style={{
            flex: 1,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            alignItems: 'center',
            ...theme.shadows.sm,
          }}>
            <Text style={{ ...theme.typography.h3, color: s.color }}>{s.value}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.md }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.md,
          paddingHorizontal: theme.SPACING.md,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
        }}>
          <Ionicons name="search-outline" size={18} color={theme.colors.text.disabled} />
          <TextInput
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={theme.colors.text.disabled}
            value={search}
            onChangeText={setSearch}
            style={{
              ...theme.typography.body2,
              color: theme.colors.text.primary,
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: theme.SPACING.sm,
            }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.disabled} />
            </Pressable>
          )}
        </View>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} utilisateur${filtered.length !== 1 ? 's' : ''}`}
          iconName="people-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="people-outline"
            title="Aucun utilisateur"
            description={search ? 'Aucun resultat pour cette recherche' : 'Aucun utilisateur trouve'}
            compact
          />
        ) : (
          filtered.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onPress={() => navigation.navigate('UserDetail', { userId: user.id })}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => navigation.navigate('InviteMember')}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 100,
          right: theme.SPACING.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.lg,
          opacity: pressed ? 0.9 : 1,
          transform: pressed ? [{ scale: 0.95 }] : [],
        })}
      >
        <Ionicons name="person-add" size={24} color={theme.colors.primary.contrastText} />
      </Pressable>
    </SafeAreaView>
  );
}
