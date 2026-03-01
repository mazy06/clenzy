import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

interface PhotoGridProps {
  photos: string[];
  onAddPhoto?: () => void;
  onPhotoPress?: (index: number) => void;
  maxDisplay?: number;
  label?: string;
}

export function PhotoGrid({ photos, onAddPhoto, onPhotoPress, maxDisplay = 6, label }: PhotoGridProps) {
  const theme = useTheme();
  const displayed = photos.slice(0, maxDisplay);
  const remaining = photos.length - maxDisplay;

  return (
    <View>
      {label && (
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, fontWeight: '600', marginBottom: theme.SPACING.xs }}>
          {label}
        </Text>
      )}
      <View style={styles.grid}>
        {displayed.map((uri, index) => (
          <TouchableOpacity
            key={`${uri}-${index}`}
            onPress={() => onPhotoPress?.(index)}
            style={[styles.photoContainer, { borderColor: theme.colors.border.light }]}
          >
            <Image source={{ uri }} style={styles.photo} />
            {index === maxDisplay - 1 && remaining > 0 && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>+{remaining}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {onAddPhoto && (
          <TouchableOpacity
            onPress={onAddPhoto}
            style={[styles.addButton, { borderColor: theme.colors.primary.main, backgroundColor: `${theme.colors.primary.main}10` }]}
          >
            <Text style={{ fontSize: 28, color: theme.colors.primary.main, fontWeight: '300' }}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const PHOTO_SIZE = 80;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
