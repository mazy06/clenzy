import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Alert, AlertDescription } from './ui';
import { TriangleAlert } from 'lucide-react';
import { Button } from './ui';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '../icons';
import { cn } from '../utils/cn';

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

  // URLs de prévisualisation DÉRIVÉES des fichiers locaux (pas d'état dupliqué :
  // les previews sont fraîches au même render que `photos`). L'effet ne sert
  // qu'à révoquer les object URLs quand la liste change / au démontage.
  const previewUrls = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos],
  );
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

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
    <div>
      {/* Label */}
      {label && (
        <h6 className="text-xs font-semibold mb-1.5">
          {label}
        </h6>
      )}

      {/* Zone de dépôt (drag-and-drop) */}
      <div
        onClick={handleDropzoneClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-[18px] text-center transition-colors duration-200 ease-out',
          error ? 'border-destructive' : isDragOver ? 'border-primary' : 'border-border',
          isDragOver ? 'bg-muted' : 'bg-card',
          disabled
            ? 'cursor-default opacity-50'
            : 'cursor-pointer opacity-100 hover:border-primary hover:bg-muted',
        )}
      >
        <span className={cn('inline-flex mb-1.5', isDragOver ? 'text-primary' : 'text-muted-foreground')}>
          <CloudUploadIcon size={40} strokeWidth={1.5} />
        </span>
        <p className="text-xs font-medium text-muted-foreground">
          Glissez-déposez vos photos ici
        </p>
        <span className="text-xs text-muted-foreground">
          ou cliquez pour parcourir
        </span>
      </div>

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
        <span className="text-xs text-muted-foreground mt-0.5 block">
          {helperText}
        </span>
      )}

      {/* Compteur — `mt: 0.5` avec theme.spacing = 6 vaut 3 px. */}
      <span
        className={cn(
          'mt-[3px] block text-xs tabular-nums',
          totalCount >= maxFiles ? 'text-destructive-ink' : 'text-muted-foreground',
        )}
      >
        {totalCount}/{maxFiles} photos
      </span>

      {/* Erreur de validation */}
      {(validationError || error) && (
        <Alert variant="destructive" className="mt-1.5 py-0.5">
          <TriangleAlert />
          <AlertDescription><span className="text-xs">
            {error || validationError}
          </span></AlertDescription>
        </Alert>
      )}

      {/* Prévisualisation des photos existantes (URLs) */}
      {existingPhotos.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-muted-foreground mb-1.5 block">
            Photos existantes
          </span>
          {/* Le nombre de colonnes vient des props : valeur d'execution, donc un
              style inline — Tailwind n'emet ses classes qu'a la compilation. */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {existingPhotos.map((url, index) => (
              <div key={url} className="relative">
                <img
                  src={url}
                  alt={`Apercu existant ${index + 1}`}
                  loading="lazy"
                  className="h-[120px] w-full rounded-sm object-cover"
                />
                {onExistingPhotoRemove && (
                  <div className="absolute inset-x-0 top-0 flex justify-end rounded-t-sm bg-gradient-to-b from-black/70 to-transparent p-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Retirer la photo existante ${index + 1}`}
                      className="text-white hover:bg-white/15 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExistingPhotoRemove(url);
                      }}
                      disabled={disabled}
                    >
                      <CloseIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prévisualisation des nouveaux fichiers */}
      {photos.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-muted-foreground mb-1.5 block">
            Nouvelles photos
          </span>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {photos.map((file, index) => (
              <div key={`new-${index}`}>
                <div className="relative">
                  <img
                    src={previewUrls[index] || ''}
                    alt={`Apercu ${index + 1}`}
                    loading="lazy"
                    className="h-[120px] w-full rounded-sm object-cover"
                  />
                  <div className="absolute inset-x-0 top-0 flex justify-end rounded-t-sm bg-gradient-to-b from-black/70 to-transparent p-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Retirer ${file.name}`}
                      className="text-white hover:bg-white/15 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(index);
                      }}
                      disabled={disabled}
                    >
                      <CloseIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>
                <span className="mt-1 block truncate text-2xs font-medium text-muted-foreground">
                  {file.name}
                </span>
                <span className="block text-2xs tabular-nums text-faint">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;
