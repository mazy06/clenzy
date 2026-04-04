import { useState, useCallback } from 'react';
import { View, Text, Pressable, Image, Alert, FlatList, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usePropertyPhotos, useUploadPropertyPhoto, useDeletePropertyPhoto } from '@/hooks/useProperties';
import { propertiesApi, type PropertyPhotoMeta } from '@/api/endpoints/propertiesApi';
import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type RouteParams = { PropertyPhotosManage: { propertyId: number } };

function PhotoCard({
  photo,
  propertyId,
  onDelete,
  isDeleting,
  theme,
}: {
  photo: PropertyPhotoMeta;
  propertyId: number;
  onDelete: (photoId: number) => void;
  isDeleting: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const photoUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${propertiesApi.getPhotoUrl(propertyId, photo.id)}`;

  return (
    <View style={{
      flex: 1,
      margin: theme.SPACING.xs,
      borderRadius: theme.BORDER_RADIUS.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.background.paper,
      ...theme.shadows.sm,
    }}>
      <Image
        source={{ uri: photoUrl, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
        style={{ width: '100%', aspectRatio: 1 }}
        resizeMode="cover"
      />
      {/* Delete overlay */}
      <Pressable
        onPress={() => onDelete(photo.id)}
        disabled={isDeleting}
        hitSlop={4}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="close" size={18} color="#fff" />
        )}
      </Pressable>
      {photo.caption ? (
        <View style={{ padding: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
            {photo.caption}
          </Text>
        </View>
      ) : null}
      <View style={{ padding: theme.SPACING.xs, paddingHorizontal: theme.SPACING.sm }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>
          {(photo.fileSize / 1024).toFixed(0)} Ko
        </Text>
      </View>
    </View>
  );
}

export function PropertyPhotosManageScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyPhotosManage'>>();
  const { propertyId } = route.params;

  const { data: photos, isLoading, refetch } = usePropertyPhotos(propertyId);
  const uploadMutation = useUploadPropertyPhoto();
  const deleteMutation = useDeletePropertyPhoto();

  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);

  const handlePickImage = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'acces a la galerie pour ajouter des photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    uploadMutation.mutate(
      { propertyId, formData },
      {
        onSuccess: () => {
          refetch();
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible d\'envoyer la photo.');
        },
      },
    );
  }, [propertyId, uploadMutation, refetch]);

  const handleTakePhoto = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'acces a la camera pour prendre une photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    uploadMutation.mutate(
      { propertyId, formData },
      {
        onSuccess: () => {
          refetch();
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible d\'envoyer la photo.');
        },
      },
    );
  }, [propertyId, uploadMutation, refetch]);

  const handleDelete = useCallback((photoId: number) => {
    Alert.alert(
      'Supprimer la photo',
      'Etes-vous sur de vouloir supprimer cette photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setDeletingPhotoId(photoId);
            deleteMutation.mutate(
              { propertyId, photoId },
              {
                onSuccess: () => {
                  setDeletingPhotoId(null);
                  refetch();
                },
                onError: () => {
                  setDeletingPhotoId(null);
                  Alert.alert('Erreur', 'Impossible de supprimer la photo.');
                },
              },
            );
          },
        },
      ],
    );
  }, [propertyId, deleteMutation, refetch]);

  const handleAddPhoto = useCallback(() => {
    Alert.alert(
      'Ajouter une photo',
      'Choisissez la source',
      [
        { text: 'Camera', onPress: handleTakePhoto },
        { text: 'Galerie', onPress: handlePickImage },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  }, [handleTakePhoto, handlePickImage]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
        <View style={{ padding: theme.SPACING.lg }}>
          <Skeleton width="50%" height={24} />
          <View style={{ height: theme.SPACING.xl }} />
          <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
            <Skeleton width="48%" height={160} />
            <Skeleton width="48%" height={160} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const photoList = photos ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Gerer les photos
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
          {photoList.length} photo{photoList.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Upload indicator */}
      {uploadMutation.isPending && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm,
          paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.sm,
          backgroundColor: `${theme.colors.info.main}14`,
          marginHorizontal: theme.SPACING.lg, borderRadius: theme.BORDER_RADIUS.md,
          marginBottom: theme.SPACING.md,
        }}>
          <ActivityIndicator size="small" color={theme.colors.info.main} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.info.main }}>
            Envoi en cours...
          </Text>
        </View>
      )}

      {photoList.length === 0 ? (
        <EmptyState
          iconName="image-outline"
          title="Aucune photo"
          description="Ajoutez des photos pour presenter votre propriete"
        />
      ) : (
        <FlatList
          data={photoList}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: theme.SPACING.sm }}
          renderItem={({ item }) => (
            <PhotoCard
              photo={item}
              propertyId={propertyId}
              onDelete={handleDelete}
              isDeleting={deletingPhotoId === item.id}
              theme={theme}
            />
          )}
        />
      )}

      {/* Floating add button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: theme.SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 34 : theme.SPACING.lg,
        backgroundColor: theme.colors.background.default,
        borderTopWidth: 1, borderTopColor: theme.colors.border.light,
        ...theme.shadows.md,
      }}>
        <Button
          title="Ajouter une photo"
          onPress={handleAddPhoto}
          loading={uploadMutation.isPending}
          fullWidth
          icon={<Ionicons name="camera-outline" size={20} color={theme.colors.primary.contrastText} />}
        />
      </View>
    </SafeAreaView>
  );
}
