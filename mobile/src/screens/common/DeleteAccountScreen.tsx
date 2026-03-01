import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';

export function DeleteAccountScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmation.toLowerCase() === 'supprimer';

  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Confirmer la suppression',
      'Cette action est irreversible. Toutes vos donnees seront supprimees definitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer definitivement',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await apiClient.delete('/users/me');
              await logout();
            } catch {
              Alert.alert(
                'Erreur',
                'La suppression du compte a echoue. Veuillez reessayer ou contacter le support.',
              );
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [logout]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Back button */}
        <Button
          title="Retour"
          variant="text"
          onPress={() => navigation.goBack()}
          style={{ alignSelf: 'flex-start', marginBottom: theme.SPACING.md }}
        />

        <Text
          style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}
          accessibilityRole="header"
        >
          Supprimer le compte
        </Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.lg }}>
          La suppression de votre compte est permanente et irreversible.
        </Text>

        {/* Warning card */}
        <Card style={{ marginBottom: theme.SPACING.lg, backgroundColor: '#FEF2F2', borderColor: theme.colors.error.light }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.error.main, marginBottom: theme.SPACING.sm }}>
            Attention
          </Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, lineHeight: 22 }}>
            En supprimant votre compte, vous perdrez :
          </Text>
          <View style={{ marginTop: theme.SPACING.sm, gap: 6 }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              - Toutes vos donnees personnelles
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              - L'historique de vos interventions
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              - Vos photos et documents
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              - L'acces a votre organisation
            </Text>
          </View>
        </Card>

        {/* Account info */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 4 }}>
            Compte concerne
          </Text>
          <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary }}>
            {user?.email}
          </Text>
        </Card>

        {/* Confirmation input */}
        <Input
          label='Tapez "supprimer" pour confirmer'
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="supprimer"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginBottom: theme.SPACING.lg }}
        />

        {/* Delete button */}
        <Button
          title="Supprimer mon compte"
          color="error"
          fullWidth
          disabled={!canDelete}
          loading={isDeleting}
          onPress={handleDelete}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
