import React, { useState, useCallback } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useUploadPhotos, useUpdateIntervention } from '@/hooks/useInterventions';
import { PhotoGrid } from '@/components/domain/PhotoGrid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import { takePhoto, pickFromGallery, createUploadFormData, type CapturedPhoto } from '@/services/camera/cameraService';
import { useOfflineStore } from '@/store/offlineStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type RouteParams = {
  PhotoCapture: { interventionId: number; type: 'before' | 'after' };
};

export function PhotoCaptureScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'PhotoCapture'>>();
  const navigation = useNavigation();
  const { interventionId, type } = route.params;
  const isOnline = useNetworkStatus();

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useUploadPhotos();
  const updateMutation = useUpdateIntervention();

  const handleTakePhoto = useCallback(async () => {
    const photo = await takePhoto();
    if (photo) setPhotos((prev) => [...prev, photo]);
  }, []);

  const handlePickGallery = useCallback(async () => {
    const photo = await pickFromGallery();
    if (photo) setPhotos((prev) => [...prev, photo]);
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (photos.length === 0) {
      Alert.alert('Aucune photo', 'Prenez au moins une photo avant de continuer.');
      return;
    }

    setUploading(true);

    if (isOnline) {
      try {
        const formData = createUploadFormData(interventionId, photos, type);
        await uploadMutation.mutateAsync({ id: interventionId, formData });

        // If "before" photos, start the intervention
        if (type === 'before') {
          await updateMutation.mutateAsync({ id: interventionId, data: { status: 'IN_PROGRESS' } });
        }

        navigation.goBack();
      } catch {
        Alert.alert('Erreur', 'Echec de l\'upload. Les photos seront envoyees des que possible.');
        queueOffline();
      }
    } else {
      queueOffline();
    }

    setUploading(false);
  }, [photos, interventionId, type, isOnline, uploadMutation, updateMutation, navigation]);

  const queueOffline = useCallback(() => {
    const enqueue = useOfflineStore.getState().enqueue;
    enqueue({
      type: 'UPLOAD',
      endpoint: `/interventions/${interventionId}/photos`,
      method: 'POST',
      payload: { photoCount: photos.length, type },
      maxRetries: 5,
      dependencies: [],
    });
    Alert.alert('Mode hors ligne', 'Les photos seront envoyees automatiquement a la reconnexion.');
    navigation.goBack();
  }, [interventionId, photos.length, type, navigation]);

  const photoUris = photos.map((p) => p.uri);
  const title = type === 'before' ? 'Photos avant' : 'Photos apres';
  const subtitle = type === 'before'
    ? 'Documentez l\'etat du logement avant intervention'
    : 'Documentez le resultat apres nettoyage';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 4 }}>{title}</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.lg }}>
          {subtitle}
        </Text>

        {/* Photo grid */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <PhotoGrid
            photos={photoUris}
            onAddPhoto={handleTakePhoto}
            onPhotoPress={handleRemovePhoto}
            label={`${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
          />
        </Card>

        {/* Capture buttons */}
        <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
          <Button title="Prendre une photo" onPress={handleTakePhoto} fullWidth />
          <Button title="Choisir depuis la galerie" variant="outlined" onPress={handlePickGallery} fullWidth />
        </View>

        {/* Upload / Continue */}
        <Button
          title={uploading ? 'Envoi en cours...' : `Valider (${photos.length} photo${photos.length !== 1 ? 's' : ''})`}
          onPress={handleUpload}
          color="success"
          fullWidth
          loading={uploading}
          disabled={photos.length === 0}
        />

        {!isOnline && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.warning.main, textAlign: 'center', marginTop: theme.SPACING.sm }}>
            Mode hors ligne — les photos seront envoyees a la reconnexion
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
