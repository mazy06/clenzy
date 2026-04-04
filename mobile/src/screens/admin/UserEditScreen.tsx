import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { apiClient } from '@/api/apiClient';

interface UserDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
  enabled: boolean;
  organizationId?: number;
  organizationName?: string;
}

interface Organization {
  id: number;
  name: string;
}

type RouteParams = {
  UserEdit: { userId: number };
};

const ROLE_OPTIONS = [
  { label: 'Proprietaire', value: 'HOST' },
  { label: 'Technicien', value: 'TECHNICIAN' },
  { label: 'Agent de menage', value: 'HOUSEKEEPER' },
  { label: 'Superviseur', value: 'SUPERVISOR' },
  { label: 'Administrateur', value: 'ADMIN' },
];

const STATUS_OPTIONS = [
  { label: 'Actif', value: 'true' },
  { label: 'Inactif', value: 'false' },
];

function EditSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.lg }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ gap: 8 }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={48} borderRadius={theme.BORDER_RADIUS.md} />
        </View>
      ))}
    </View>
  );
}

export function UserEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'UserEdit'>>();
  const { userId } = route.params;
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [enabled, setEnabled] = useState('true');
  const [organizationId, setOrganizationId] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiClient.get<UserDetail>(`/admin/users/${userId}`),
    enabled: userId > 0,
  });

  const { data: orgsData } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => apiClient.get<{ content?: Organization[] } | Organization[]>('/admin/organizations'),
  });

  const organizations: Organization[] = Array.isArray(orgsData) ? orgsData : (orgsData as any)?.content ?? [];

  const orgOptions = organizations.map((o) => ({ label: o.name, value: String(o.id) }));

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
      setRole(user.roles[0] ?? '');
      setEnabled(String(user.enabled));
      setOrganizationId(user.organizationId ? String(user.organizationId) : '');
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.put(`/admin/users/${userId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Alert.alert('Succes', 'Utilisateur mis a jour', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert('Erreur', 'Impossible de mettre a jour l\'utilisateur');
    },
  });

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    updateMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      roles: [role],
      enabled: enabled === 'true',
      organizationId: organizationId ? Number(organizationId) : null,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.lg, paddingBottom: theme.SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md, backgroundColor: theme.colors.background.paper, alignItems: 'center', justifyContent: 'center', marginRight: theme.SPACING.md }}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Modifier</Text>
        </View>
        <EditSkeleton theme={theme} />
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
          Modifier l'utilisateur
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader title="Informations personnelles" iconName="person-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Input
            label="Prenom *"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Prenom"
            containerStyle={{ marginBottom: theme.SPACING.lg }}
          />
          <Input
            label="Nom *"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Nom"
            containerStyle={{ marginBottom: theme.SPACING.lg }}
          />
          <Input
            label="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={{ marginBottom: theme.SPACING.lg }}
          />
          <Input
            label="Telephone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+33 6 12 34 56 78"
            keyboardType="phone-pad"
          />
        </Card>

        <SectionHeader title="Role et statut" iconName="shield-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            containerStyle={{ marginBottom: theme.SPACING.lg }}
          />
          <Select
            label="Statut"
            options={STATUS_OPTIONS}
            value={enabled}
            onChange={setEnabled}
          />
        </Card>

        {orgOptions.length > 0 && (
          <>
            <SectionHeader title="Organisation" iconName="business-outline" />
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <Select
                label="Organisation"
                options={[{ label: 'Aucune', value: '' }, ...orgOptions]}
                value={organizationId}
                onChange={setOrganizationId}
              />
            </Card>
          </>
        )}

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
          <Button
            title="Enregistrer"
            onPress={handleSave}
            loading={updateMutation.isPending}
            fullWidth
            icon={<Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.primary.contrastText} />}
          />
          <Button
            title="Annuler"
            variant="outlined"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
