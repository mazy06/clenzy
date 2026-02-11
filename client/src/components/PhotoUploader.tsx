import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Alert,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// ============================================================
// PhotoUploader — Composant réutilisable d'upload de photos
// avec drag-and-drop, prévisualisation et validation
// ============================================================

export interface PhotoUploaderProps {
  photos: File[];
  existingPhotos?: string[];
  onPhotosChange: (files: File[]) => void;
  onExistingPhotoRemove?: (url: string) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  label?: string;
  helperText?: string;
  disabled?: boolean;
  error?: string;
  columns?: number;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  existingPhotos = [],
  onPhotosChange,
  onExistingPhotoRemove,
  maxFiles = 10,
  maxSizeMB = 5,
  acceptedFormats = ['image/*'],
  label,
  helperText,
  disabled = false,
  error,
  columns = 3,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Gestion des URLs de prévisualisation pour les fichiers locaux
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const totalCount = photos.length + existingPhotos.length;

  // Validation des fichiers
  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const errors: string[] = [];
      const valid: File[] = [];
      const remaining = maxFiles - totalCount;

      if (remaining <= 0) {
        errors.push(`Nombre maximum de photos atteint (${maxFiles})`);
        return { valid, errors };
      }

      const filesToProcess = files.slice(0, remaining);
      if (files.length > remaining) {
        errors.push(
          `Seulement ${remaining} photo(s) supplémentaire(s) autorisée(s). ${files.length - remaining} fichier(s) ignoré(s).`
        );
      }

      for (const file of filesToProcess) {
        // Vérification du format
        const isAccepted = acceptedFormats.some((format) => {
          if (format === 'image/*') return file.type.startsWith('image/');
          return file.type === format;
        });
        if (!isAccepted) {
          errors.push(`"${file.name}" : format non accepté`);
          continue;
        }

        // Vérification de la taille
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
          errors.push(
            `"${file.name}" : taille trop grande (${sizeMB.toFixed(1)} Mo, max ${maxSizeMB} Mo)`
          );
          continue;
        }

        valid.push(file);
      }

      return { valid, errors };
    },
    [acceptedFormats, maxFiles, maxSizeMB, totalCount]
  );

  // Ajout de fichiers
  const handleAddFiles = useCallback(
    (files: File[]) => {
      setValidationError(null);
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setValidationError(errors.join(' | '));
      }

      if (valid.length > 0) {
        onPhotosChange([...photos, ...valid]);
      }
    },
    [validateFiles, onPhotosChange, photos]
  );

  // Suppression d'un fichier local
  const handleRemoveFile = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index);
      onPhotosChange(updated);
      setValidationError(null);
    },
    [photos, onPhotosChange]
  );

  // Click sur la zone de dépôt
  const handleDropzoneClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Sélection de fichiers via l'input
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleAddFiles(Array.from(event.target.files));
    }
    // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleAddFiles(droppedFiles);
    }
  };

  // Formatage de la taille du fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Construire l'attribut accept pour l'input
  const acceptAttribute = acceptedFormats.join(',');

  return (
    <Box>
      {/* Label */}
      {label && (
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}

      {/* Zone de dépôt (drag-and-drop) */}
      <Box
        onClick={handleDropzoneClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: error
            ? 'error.main'
            : isDragOver
            ? 'primary.main'
            : 'divider',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          cursor: disabled ? 'default' : 'pointer',
          bgcolor: isDragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
          '&:hover': disabled
            ? {}
            : {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
        }}
      >
        <CloudUploadIcon
          sx={{
            fontSize: 40,
            color: isDragOver ? 'primary.main' : 'text.secondary',
            mb: 1,
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Glissez-déposez vos photos ici
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ou cliquez pour parcourir
        </Typography>
      </Box>

      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttribute}
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Texte d'aide */}
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {helperText}
        </Typography>
      )}

      {/* Compteur */}
      <Typography
        variant="caption"
        color={totalCount >= maxFiles ? 'error.main' : 'text.secondary'}
        sx={{ mt: 0.5, display: 'block' }}
      >
        {totalCount}/{maxFiles} photos
      </Typography>

      {/* Erreur de validation */}
      {(validationError || error) && (
        <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            {error || validationError}
          </Typography>
        </Alert>
      )}

      {/* Prévisualisation des photos existantes (URLs) */}
      {existingPhotos.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Photos existantes
          </Typography>
          <ImageList cols={columns} gap={8}>
            {existingPhotos.map((url, index) => (
              <ImageListItem key={`existing-${index}`}>
                <img
                  src={url}
                  alt={`Photo existante ${index + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 4,
                  }}
                />
                {onExistingPhotoRemove && (
                  <ImageListItemBar
                    sx={{
                      background:
                        'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                    }}
                    position="top"
                    actionPosition="right"
                    actionIcon={
                      <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onExistingPhotoRemove(url);
                        }}
                        disabled={disabled}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    }
                  />
                )}
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}

      {/* Prévisualisation des nouveaux fichiers */}
      {photos.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Nouvelles photos
          </Typography>
          <ImageList cols={columns} gap={8}>
            {photos.map((file, index) => (
              <ImageListItem key={`new-${index}`}>
                <img
                  src={previewUrls[index] || ''}
                  alt={`Apercu ${index + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 4,
                  }}
                />
                <ImageListItemBar
                  sx={{
                    background:
                      'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                  }}
                  position="top"
                  actionPosition="right"
                  actionIcon={
                    <IconButton
                      size="small"
                      sx={{ color: 'white' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(index);
                      }}
                      disabled={disabled}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                />
                <ImageListItemBar
                  position="below"
                  title={
                    <Typography variant="caption" noWrap sx={{ fontSize: '0.7rem' }}>
                      {file.name}
                    </Typography>
                  }
                  subtitle={
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {formatFileSize(file.size)}
                    </Typography>
                  }
                />
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}
    </Box>
  );
};

export default PhotoUploader;
