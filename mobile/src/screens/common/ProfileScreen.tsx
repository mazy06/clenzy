import React, { useCallback } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

function getDisplayName(user: any): string {
  if (user?.fullName) return user.fullName;
  if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
  if (user?.firstName) return user.firstName;
  if (user?.username) return user.username;
  if (user?.email) return user.email;
  return 'Utilisateur';
}

function getRoleName(role: string): string {
  const map: Record<string, string> = {
    HOST: 'Proprietaire',
    MANAGER: 'Gestionnaire',
    SUPERVISOR: 'Superviseur',
    HOUSEKEEPER: 'Agent de menage',
    TECHNICIAN: 'Technicien',
    ADMIN: 'Administrateur',
  };
  return map[role] ?? role;
}

function MenuRow({ icon, label, onPress, theme, color, showChevron = true }: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  color?: string;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: theme.SPACING.md,
        borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
      })}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: color ? `${color}0C` : `${theme.colors.primary.main}0C`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={18} color={color || theme.colors.primary.main} />
      </View>
      <Text style={{
        ...theme.typography.body1,
        color: color || theme.colors.text.primary,
        flex: 1,
      }}>
        {label}
      </Text>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
      )}
    </Pressable>
  );
}

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const displayName = getDisplayName(user);
  const roleName = user?.roles?.[0] ? getRoleName(user.roles[0]) : null;

  const handleLogout = useCallback(() => {
    Alert.alert('Deconnexion', 'Voulez-vous vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Deconnecter', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING['2xl'], paddingBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
            Profil
          </Text>
          <NotificationBell />
        </View>

        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* User info card */}
          <Card elevated onPress={() => navigation.navigate('ProfileDetail')} style={{ marginBottom: theme.SPACING.xl, alignItems: 'center', paddingVertical: theme.SPACING['2xl'] }}>
            <View style={{
              marginBottom: theme.SPACING.lg,
              padding: 3,
              borderRadius: 42,
              borderWidth: 2,
              borderColor: `${theme.colors.primary.main}20`,
            }}>
              <Avatar name={displayName} size={76} />
            </View>

            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>
              {displayName}
            </Text>

            {user?.email && (
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>
                {user.email}
              </Text>
            )}

            {roleName && (
              <View style={{
                marginTop: theme.SPACING.md,
                paddingHorizontal: theme.SPACING.md,
                paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.lg,
                backgroundColor: `${theme.colors.primary.main}0C`,
              }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '700' }}>
                  {roleName}
                </Text>
              </View>
            )}

            <View style={{ position: 'absolute', top: theme.SPACING.md, right: theme.SPACING.md }}>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
            </View>
          </Card>

          {/* Organisation info */}
          {user?.organizationName && (
            <Card variant="filled" style={{ marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: `${theme.colors.secondary.main}0C`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="business-outline" size={20} color={theme.colors.secondary.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Organisation</Text>
                  <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600', marginTop: 2 }}>
                    {user.organizationName}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Menu items */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <MenuRow
              icon="bar-chart-outline"
              label="Rapports"
              onPress={() => navigation.navigate('Reports')}
              theme={theme}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.md }} />
            <MenuRow
              icon="card-outline"
              label="Historique des paiements"
              onPress={() => navigation.navigate('PaymentHistory')}
              theme={theme}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.md }} />
            <MenuRow
              icon="notifications-outline"
              label="Notifications"
              onPress={() => navigation.navigate('Notifications')}
              theme={theme}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.md }} />
            <MenuRow
              icon="settings-outline"
              label="Parametres"
              onPress={() => navigation.navigate('Settings')}
              theme={theme}
            />
          </Card>

          {/* Danger zone */}
          <Card style={{ marginBottom: theme.SPACING.xl }}>
            <MenuRow
              icon="log-out-outline"
              label="Se deconnecter"
              onPress={handleLogout}
              theme={theme}
              color={theme.colors.error.main}
              showChevron={false}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: theme.SPACING.md }} />
            <MenuRow
              icon="trash-outline"
              label="Supprimer le compte"
              onPress={() => navigation.navigate('DeleteAccount')}
              theme={theme}
              color={theme.colors.error.main}
            />
          </Card>

          {/* App version */}
          <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="phone-portrait-outline" size={14} color={theme.colors.text.disabled} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                Clenzy Mobile v1.0.0
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
