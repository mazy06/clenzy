import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface UserDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
  enabled: boolean;
  createdAt: string;
  lastLogin?: string;
  organizationId?: number;
  organizationName?: string;
}

type RouteParams = {
  UserDetail: { userId: number };
};

const ROLE_CONFIG: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' }> = {
  HOST: { label: 'Proprietaire', color: 'primary' },
  TECHNICIAN: { label: 'Technicien', color: 'info' },
  HOUSEKEEPER: { label: 'Agent menage', color: 'success' },
  SUPERVISOR: { label: 'Superviseur', color: 'warning' },
  ADMIN: { label: 'Admin', color: 'error' },
  SUPER_ADMIN: { label: 'Super Admin', color: 'error' },
  SUPER_MANAGER: { label: 'Super Manager', color: 'secondary' },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function InfoRow({ icon, label, value, theme }: {
  icon: IoniconsName;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: theme.SPACING.md }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${theme.colors.primary.main}08`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={theme.colors.primary.main} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{label}</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

function UserDetailSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md, alignItems: 'center' }}>
      <Skeleton width={80} height={80} borderRadius={40} />
      <Skeleton width="60%" height={24} />
      <Skeleton width="40%" height={16} />
      <Skeleton width="100%" height={200} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton width="100%" height={100} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

export function UserDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'UserDetail'>>();
  const { userId } = route.params;
  const queryClient = useQueryClient();

  const { data: user, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiClient.get<UserDetail>(`/admin/users/${userId}`),
    enabled: userId > 0,
  });

  const disableMutation = useMutation({
    mutationFn: () => apiClient.put(`/admin/users/${userId}/disable`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      navigation.goBack();
    },
  });

  const handleDisable = useCallback(() => {
    const action = user?.enabled ? 'desactiver' : 'reactiver';
    Alert.alert(
      `${user?.enabled ? 'Desactiver' : 'Reactiver'} l'utilisateur`,
      `Voulez-vous ${action} cet utilisateur ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: () => disableMutation.mutate() },
      ],
    );
  }, [user?.enabled, disableMutation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer l\'utilisateur',
      'Cette action est irreversible. Voulez-vous vraiment supprimer cet utilisateur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }, [deleteMutation]);

  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : '';
  const roleCfg = user ? (ROLE_CONFIG[user.roles[0]] ?? { label: user.roles[0], color: 'primary' as const }) : null;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Utilisateur</Text>
        </View>
        <UserDetailSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Utilisateur</Text>
        </View>
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
          Utilisateur
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <Card elevated style={{ alignItems: 'center', paddingVertical: theme.SPACING['2xl'], marginBottom: theme.SPACING.lg }}>
          <View style={{
            padding: 3,
            borderRadius: 42,
            borderWidth: 2,
            borderColor: `${theme.colors.primary.main}20`,
            marginBottom: theme.SPACING.lg,
          }}>
            <Avatar name={fullName} size={76} />
          </View>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{fullName}</Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>{user.email}</Text>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
            {roleCfg && <Badge label={roleCfg.label} color={roleCfg.color} />}
            <Badge
              label={user.enabled ? 'Actif' : 'Inactif'}
              color={user.enabled ? 'success' : 'error'}
              dot
            />
          </View>
        </Card>

        {/* Info section */}
        <SectionHeader title="Informations" iconName="information-circle-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <InfoRow icon="person-outline" label="Prenom" value={user.firstName || '—'} theme={theme} />
          <Divider />
          <InfoRow icon="person-outline" label="Nom" value={user.lastName || '—'} theme={theme} />
          <Divider />
          <InfoRow icon="mail-outline" label="Email" value={user.email} theme={theme} />
          <Divider />
          <InfoRow icon="call-outline" label="Telephone" value={user.phone || '—'} theme={theme} />
          <Divider />
          <InfoRow icon="calendar-outline" label="Date de creation" value={formatDate(user.createdAt)} theme={theme} />
          <Divider />
          <InfoRow icon="time-outline" label="Derniere connexion" value={formatDateTime(user.lastLogin)} theme={theme} />
        </Card>

        {/* Organisation section */}
        {user.organizationName && (
          <>
            <SectionHeader title="Organisation" iconName="business-outline" />
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: `${theme.colors.secondary.main}0C`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="business" size={20} color={theme.colors.secondary.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                    {user.organizationName}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Actions */}
        <SectionHeader title="Actions" iconName="settings-outline" />
        <View style={{ gap: theme.SPACING.sm }}>
          <Button
            title="Modifier"
            variant="outlined"
            onPress={() => navigation.navigate('UserEdit', { userId: user.id })}
            fullWidth
            icon={<Ionicons name="create-outline" size={18} color={theme.colors.primary.main} />}
          />
          <Button
            title={user.enabled ? 'Desactiver' : 'Reactiver'}
            variant="soft"
            color={user.enabled ? 'warning' : 'success'}
            onPress={handleDisable}
            loading={disableMutation.isPending}
            fullWidth
            icon={<Ionicons name={user.enabled ? 'pause-circle-outline' : 'play-circle-outline'} size={18} color={user.enabled ? theme.colors.warning.main : theme.colors.success.main} />}
          />
          <Button
            title="Supprimer"
            variant="soft"
            color="error"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            fullWidth
            icon={<Ionicons name="trash-outline" size={18} color={theme.colors.error.main} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
