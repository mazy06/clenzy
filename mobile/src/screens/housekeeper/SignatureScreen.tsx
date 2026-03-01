import React, { useRef, useState, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';
import { useUpdateIntervention } from '@/hooks/useInterventions';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';

type RouteParams = {
  Signature: { interventionId: number };
};

export function SignatureScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'Signature'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;
  const signatureRef = useRef<SignatureViewRef>(null);
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState('');

  const updateMutation = useUpdateIntervention();

  const handleOK = useCallback((signature: string) => {
    setSignatureData(signature);
    setSigned(true);
  }, []);

  const handleClear = useCallback(() => {
    signatureRef.current?.clearSignature();
    setSigned(false);
    setSignatureData('');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!signed || !signatureData) {
      Alert.alert('Signature requise', 'Veuillez signer avant de valider.');
      return;
    }

    setSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: interventionId,
        data: { status: 'COMPLETED' },
      });
      Alert.alert('Intervention terminee', 'L\'intervention a ete validee avec succes.', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to the missions list
            navigation.getParent()?.goBack();
          },
        },
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de valider. Reessayez.');
    }
    setSubmitting(false);
  }, [signed, signatureData, interventionId, updateMutation, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <View style={{ flex: 1, padding: theme.SPACING.lg }}>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>Signature</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.lg }}>
          Validez la fin de l'intervention
        </Text>

        {/* Signature pad */}
        <View style={{
          flex: 1,
          borderWidth: 2,
          borderColor: signed ? theme.colors.success.main : theme.colors.border.main,
          borderRadius: theme.BORDER_RADIUS.md,
          overflow: 'hidden',
          marginBottom: theme.SPACING.lg,
          backgroundColor: '#fff',
        }}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleOK}
            onEmpty={() => setSigned(false)}
            autoClear={false}
            descriptionText=""
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
              body { margin: 0; }
            `}
          />
        </View>

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm }}>
          <Button title="Effacer" variant="outlined" onPress={handleClear} fullWidth />
          <Button
            title="Valider l'intervention"
            onPress={handleConfirm}
            color="success"
            fullWidth
            loading={submitting}
            disabled={!signed}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
