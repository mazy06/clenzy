import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Divider } from '@/components/ui/Divider';
import { apiClient } from '@/api/apiClient';

const ROLE_OPTIONS = [
  { label: 'Proprietaire', value: 'HOST' },
  { label: 'Technicien', value: 'TECHNICIAN' },
  { label: 'Agent de menage', value: 'HOUSEKEEPER' },
  { label: 'Superviseur', value: 'SUPERVISOR' },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  HOST: 'Gestion complete des proprietes, reservations et facturation',
  TECHNICIAN: 'Interventions de maintenance et reparations',
  HOUSEKEEPER: 'Menage, inventaire et check-in/out',
  SUPERVISOR: 'Supervision des equipes et validation des taches',
};

export function InviteMemberScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [emailError, setEmailError] = useState('');

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiClient.post('/admin/invitations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Alert.alert('Invitation envoyee', `Un email d'invitation a ete envoye a ${email}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'invitation. Verifiez l\'adresse email.');
    },
  });

  const validateEmail = (value: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      setEmailError('L\'email est requis');
      return false;
    }
    if (!re.test(value)) {
      setEmailError('Format d\'email invalide');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSend = () => {
    if (!validateEmail(email)) return;
    if (!role) {
      Alert.alert('Erreur', 'Veuillez selectionner un role');
      return;
    }
    inviteMutation.mutate({ email: email.trim(), role });
  };

  const selectedRoleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? '';
  const selectedRoleDesc = role ? ROLE_DESCRIPTIONS[role] : '';

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
          Inviter un membre
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form */}
        <SectionHeader title="Invitation" iconName="mail-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Input
            label="Adresse email *"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) validateEmail(v);
            }}
            placeholder="collegue@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            containerStyle={{ marginBottom: theme.SPACING.lg }}
          />
          <Select
            label="Role *"
            options={ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            placeholder="Selectionner un role..."
          />
          {selectedRoleDesc ? (
            <View style={{
              marginTop: theme.SPACING.md,
              padding: theme.SPACING.md,
              backgroundColor: `${theme.colors.info.main}08`,
              borderRadius: theme.BORDER_RADIUS.md,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.SPACING.sm,
            }}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.info.main} style={{ marginTop: 2 }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, flex: 1 }}>
                {selectedRoleDesc}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Preview */}
        {email.trim() && role ? (
          <>
            <SectionHeader title="Apercu de l'invitation" iconName="eye-outline" />
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.md }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: `${theme.colors.primary.main}14`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="mail" size={20} color={theme.colors.primary.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.body1, fontWeight: '600', color: theme.colors.text.primary }}>
                    {email.trim()}
                  </Text>
                  <Badge label={selectedRoleLabel} color="primary" size="small" style={{ marginTop: 4 }} />
                </View>
              </View>
              <Divider />
              <View style={{ paddingTop: theme.SPACING.sm }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  Un email sera envoye avec un lien d'inscription. L'utilisateur pourra creer son compte et acceder a l'application avec le role attribue.
                </Text>
              </View>
            </Card>
          </>
        ) : null}

        {/* Action */}
        <Button
          title="Envoyer l'invitation"
          onPress={handleSend}
          loading={inviteMutation.isPending}
          disabled={!email.trim() || !role}
          fullWidth
          icon={<Ionicons name="send-outline" size={18} color={theme.colors.primary.contrastText} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
