import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
}

async function compressImage(uri: string): Promise<CapturedPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

export async function takePhoto(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
    exif: false, // Strip EXIF for privacy
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return compressImage(asset.uri);
}

export async function pickFromGallery(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return compressImage(asset.uri);
}

export function createUploadFormData(
  interventionId: number,
  photos: CapturedPhoto[],
  type: 'before' | 'after',
): FormData {
  const formData = new FormData();
  formData.append('type', type);

  photos.forEach((photo, index) => {
    formData.append('photos', {
      uri: photo.uri,
      type: 'image/jpeg',
      name: `${type}_${interventionId}_${index}.jpg`,
    } as unknown as Blob);
  });

  return formData;
}
