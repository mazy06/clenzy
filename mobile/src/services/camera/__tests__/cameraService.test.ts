import { createUploadFormData, type CapturedPhoto } from '@/services/camera/cameraService';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const photos: CapturedPhoto[] = [
  { uri: 'file:///photo0.jpg', width: 1920, height: 1080 },
  { uri: 'file:///photo1.jpg', width: 1920, height: 1080 },
];

// Extrait les champs texte du FormData, que l'impl expose getParts() (react-native)
// ou entries() (Node/undici).
function textFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  const rnFormData = formData as unknown as {
    getParts?: () => Array<{ fieldName: string; string?: string }>;
  };
  if (typeof rnFormData.getParts === 'function') {
    for (const part of rnFormData.getParts()) {
      if (typeof part.string === 'string') fields[part.fieldName] = part.string;
    }
    return fields;
  }
  for (const [name, value] of (formData as unknown as Iterable<[string, unknown]>)) {
    if (typeof value === 'string') fields[name] = value;
  }
  return fields;
}

describe('createUploadFormData', () => {
  it.each(['before', 'after'] as const)(
    'envoie la phase "%s" dans le champ photoType attendu par le backend',
    (type) => {
      const formData = createUploadFormData(42, photos, type);

      const fields = textFields(formData);
      expect(fields.photoType).toBe(type);
      // L'ancien nom de champ ne doit plus être envoyé (le backend l'ignorait
      // et retombait sur le défaut "before").
      expect(fields.type).toBeUndefined();
    },
  );
});
