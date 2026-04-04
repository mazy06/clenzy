import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';

interface ReservationCancelDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

export function ReservationCancelDialog({ visible, onCancel, onConfirm, isLoading }: ReservationCancelDialogProps) {
  const theme = useTheme();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim());
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            paddingHorizontal: theme.SPACING.xl,
          }}
          onPress={handleCancel}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.xl,
              padding: theme.SPACING.xl,
              ...theme.shadows.lg,
            }}
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: theme.SPACING.lg }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: `${theme.colors.error.main}14`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: theme.SPACING.md,
              }}>
                <Ionicons name="warning-outline" size={28} color={theme.colors.error.main} />
              </View>
              <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' }}>
                Annuler la reservation
              </Text>
              <Text style={{
                ...theme.typography.body2, color: theme.colors.text.secondary,
                textAlign: 'center', marginTop: theme.SPACING.xs,
              }}>
                Cette action est irreversible. Veuillez indiquer la raison de l'annulation.
              </Text>
            </View>

            {/* Reason input */}
            <Text style={{
              ...theme.typography.body2, fontWeight: '500',
              color: theme.colors.text.primary, marginBottom: 8,
            }}>
              Raison de l'annulation
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Ex: Demande du voyageur, double reservation..."
              placeholderTextColor={theme.colors.text.disabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                ...theme.typography.body2,
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background.surface,
                borderWidth: 1.5,
                borderColor: theme.colors.border.main,
                borderRadius: theme.BORDER_RADIUS.md,
                paddingHorizontal: 16,
                paddingVertical: 12,
                minHeight: 100,
                marginBottom: theme.SPACING.xl,
              }}
            />

            {/* Actions */}
            <View style={{ gap: theme.SPACING.sm }}>
              <Button
                title="Confirmer l'annulation"
                onPress={handleConfirm}
                color="error"
                fullWidth
                loading={isLoading}
                icon={<Ionicons name="close-circle-outline" size={18} color="#fff" />}
              />
              <Button
                title="Retour"
                onPress={handleCancel}
                variant="text"
                fullWidth
                disabled={isLoading}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
