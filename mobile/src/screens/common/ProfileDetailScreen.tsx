import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, AuthUser } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';
import { API_CONFIG } from '@/config/api';

function getDisplayName(user: AuthUser | null): string {
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

function getOrganizationTypeName(type?: string): string {
  const map: Record<string, string> = {
    INDIVIDUAL: 'Individuel',
    CONCIERGE: 'Conciergerie',
    CLEANING_COMPANY: 'Societe de menage',
    SYSTEM: 'Systeme',
  };
  return type ? (map[type] ?? type) : '';
}

export function ProfileDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const loadUser = useAuthStore((s) => s.loadUser);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);

  const displayName = getDisplayName(user);
  const roleName = user?.roles?.[0] ? getRoleName(user.roles[0]) : null;
  const hasChanges = firstName !== (user?.firstName || '') || lastName !== (user?.lastName || '');

  const handleSave = useCallback(async () => {
    if (!hasChanges || !accessToken) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      Alert.alert('Erreur', 'Le prenom et le nom sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/me`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ firstName: trimmedFirst, lastName: trimmedLast }),
        },
      );

      if (response.ok) {
        await loadUser();
        Alert.alert('Succes', 'Votre profil a ete mis a jour.');
      } else {
        const data = await response.json().catch(() => null);
        Alert.alert('Erreur', data?.message || 'Impossible de mettre a jour le profil.');
      }
    } catch {
      Alert.alert('Erreur', 'Erreur reseau. Verifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  }, [hasChanges, accessToken, firstName, lastName, loadUser]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING.md,
          paddingBottom: theme.SPACING.md,
          gap: theme.SPACING.md,
        }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: pressed ? theme.colors.background.surface : theme.colors.background.paper,
              alignItems: 'center',
              justifyContent: 'center',
              ...theme.shadows.xs,
            })}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
            Mon profil
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: theme.SPACING.lg }}>
            {/* Avatar section */}
            <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.xl }}>
              <View style={{
                padding: 3,
                borderRadius: 52,
                borderWidth: 2,
                borderColor: `${theme.colors.primary.main}20`,
                marginBottom: theme.SPACING.md,
              }}>
                <Avatar name={displayName} size={96} />
              </View>
              <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>
                {displayName}
              </Text>
              {roleName && (
                <View style={{
                  marginTop: theme.SPACING.sm,
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
            </View>

            {/* Editable fields */}
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <Text style={{
                ...theme.typography.body2,
                fontWeight: '700',
                color: theme.colors.text.primary,
                marginBottom: theme.SPACING.lg,
              }}>
                Informations personnelles
              </Text>

              <Input
                label="Prenom"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Votre prenom"
                autoCapitalize="words"
                containerStyle={{ marginBottom: theme.SPACING.lg }}
              />

              <Input
                label="Nom"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Votre nom"
                autoCapitalize="words"
                containerStyle={{ marginBottom: theme.SPACING.md }}
              />
            </Card>

            {/* Read-only fields */}
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <Text style={{
                ...theme.typography.body2,
                fontWeight: '700',
                color: theme.colors.text.primary,
                marginBottom: theme.SPACING.lg,
              }}>
                Informations du compte
              </Text>

              <ReadOnlyField
                label="Email"
                value={user?.email || '-'}
                icon="mail-outline"
                theme={theme}
              />

              <ReadOnlyField
                label="Identifiant"
                value={user?.username || '-'}
                icon="person-outline"
                theme={theme}
              />

              <ReadOnlyField
                label="Role"
                value={roleName || '-'}
                icon="shield-outline"
                theme={theme}
              />

              {user?.forfait && (
                <Pressable onPress={() => navigation.navigate('Subscription')}>
                  <ReadOnlyField
                    label="Forfait"
                    value={user.forfait}
                    icon="diamond-outline"
                    theme={theme}
                    showChevron
                  />
                </Pressable>
              )}
            </Card>

            {/* Organisation section */}
            {user?.organizationName && (
              <Card style={{ marginBottom: theme.SPACING.lg }}>
                <Text style={{
                  ...theme.typography.body2,
                  fontWeight: '700',
                  color: theme.colors.text.primary,
                  marginBottom: theme.SPACING.lg,
                }}>
                  Organisation
                </Text>

                <ReadOnlyField
                  label="Nom"
                  value={user.organizationName}
                  icon="business-outline"
                  theme={theme}
                />

                {user.organizationType && (
                  <ReadOnlyField
                    label="Type"
                    value={getOrganizationTypeName(user.organizationType)}
                    icon="layers-outline"
                    theme={theme}
                  />
                )}

                {user.orgRole && (
                  <ReadOnlyField
                    label="Role dans l'organisation"
                    value={user.orgRole}
                    icon="people-outline"
                    theme={theme}
                    isLast
                  />
                )}
              </Card>
            )}

            {/* Save button */}
            <Button
              title="Enregistrer les modifications"
              onPress={handleSave}
              disabled={!hasChanges}
              loading={saving}
              fullWidth
              size="large"
              style={{ marginBottom: theme.SPACING.xl }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReadOnlyField({ label, value, icon, theme, isLast = false, showChevron = false }: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  isLast?: boolean;
  showChevron?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: theme.colors.border.light,
    }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${theme.colors.primary.main}08`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={16} color={theme.colors.text.disabled} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
          {label}
        </Text>
        <Text style={{ ...theme.typography.body1, color: showChevron ? theme.colors.primary.main : theme.colors.text.primary, marginTop: 2 }}>
          {value}
        </Text>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
      )}
    </View>
  );
}
