import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useUploadPhotos, useIntervention } from '@/hooks/useInterventions';
import { PhotoGrid } from '@/components/domain/PhotoGrid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import { takePhoto, pickFromGallery, createUploadFormData, type CapturedPhoto } from '@/services/camera/cameraService';

type RouteParams = {
  PhotoDoc: { interventionId: number };
};

export function PhotoDocScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'PhotoDoc'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;

  const { data: intervention } = useIntervention(interventionId);
  const uploadMutation = useUploadPhotos();

  const [beforePhotos, setBeforePhotos] = useState<CapturedPhoto[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<CapturedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleCapture = useCallback(async (target: 'before' | 'after') => {
    const photo = await takePhoto();
    if (!photo) return;
    if (target === 'before') setBeforePhotos((prev) => [...prev, photo]);
    else setAfterPhotos((prev) => [...prev, photo]);
  }, []);

  const handlePick = useCallback(async (target: 'before' | 'after') => {
    const photo = await pickFromGallery();
    if (!photo) return;
    if (target === 'before') setBeforePhotos((prev) => [...prev, photo]);
    else setAfterPhotos((prev) => [...prev, photo]);
  }, []);

  const handleUploadAll = useCallback(async () => {
    const total = beforePhotos.length + afterPhotos.length;
    if (total === 0) {
      Alert.alert('Aucune photo', 'Ajoutez au moins une photo.');
      return;
    }

    setUploading(true);
    try {
      if (beforePhotos.length > 0) {
        const fd = createUploadFormData(interventionId, beforePhotos, 'before');
        await uploadMutation.mutateAsync({ id: interventionId, formData: fd });
      }
      if (afterPhotos.length > 0) {
        const fd = createUploadFormData(interventionId, afterPhotos, 'after');
        await uploadMutation.mutateAsync({ id: interventionId, formData: fd });
      }
      Alert.alert('Photos envoyees', `${total} photo(s) uploadee(s) avec succes.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Erreur', 'Echec de l\'envoi des photos.');
    }
    setUploading(false);
  }, [beforePhotos, afterPhotos, interventionId, uploadMutation, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>Documentation photo</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.lg }}>
          {intervention?.title || 'Intervention'} — {intervention?.propertyName || ''}
        </Text>

        {/* Before photos */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <PhotoGrid
            photos={beforePhotos.map((p) => p.uri)}
            onAddPhoto={() => handleCapture('before')}
            label="Photos avant"
          />
          {beforePhotos.length === 0 && (
            <Button title="Galerie" variant="text" size="small" onPress={() => handlePick('before')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          )}
        </Card>

        {/* After photos */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <PhotoGrid
            photos={afterPhotos.map((p) => p.uri)}
            onAddPhoto={() => handleCapture('after')}
            label="Photos apres"
          />
          {afterPhotos.length === 0 && (
            <Button title="Galerie" variant="text" size="small" onPress={() => handlePick('after')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          )}
        </Card>

        {/* Upload */}
        <Button
          title={`Envoyer ${beforePhotos.length + afterPhotos.length} photo(s)`}
          onPress={handleUploadAll}
          color="success"
          fullWidth
          loading={uploading}
          disabled={beforePhotos.length + afterPhotos.length === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
