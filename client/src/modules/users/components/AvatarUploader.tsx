import React, { useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Upload, Delete } from '../../../icons';
import { usersApi, type User } from '../../../services/api/usersApi';

interface AvatarUploaderProps {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'profilePictureUrl' | 'updatedAt'>;
  /** Called with the updated user after a successful upload/delete. */
  onChange?: (next: User) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Avatar uploader — drag-and-drop or click-to-upload, with delete.
 *
 * <h4>Design rules respected</h4>
 * <ul>
 *   <li>No emoji icons, no glassmorphism.</li>
 *   <li>Soft-tinted accent (var(--accent-soft)) for the drop zone.</li>
 *   <li>`prefers-reduced-motion` respected.</li>
 *   <li>Inline error feedback, no modal-first reflex.</li>
 * </ul>
 */
const AvatarUploader: React.FC<AvatarUploaderProps> = ({ user, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = `${(user.firstName || '').charAt(0)}${(user.lastName || '').charAt(0)}`.toUpperCase() || '?';
  const photoUrl = user.profilePictureUrl
    ? usersApi.profilePictureUrl(user.id, user.updatedAt ?? null)
    : null;

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Format non supporté (JPEG, PNG, WebP ou GIF uniquement)';
    }
    if (file.size > MAX_BYTES) {
      return 'Fichier trop volumineux (5 Mo maximum)';
    }
    return null;
  };

  const upload = async (file: File) => {
    const issue = validate(file);
    if (issue) {
      setError(issue);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const updated = await usersApi.uploadProfilePicture(user.id, file);
      onChange?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const handleDelete = async () => {
    if (!photoUrl) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await usersApi.deleteProfilePicture(user.id);
      onChange?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: dragOver ? 'var(--accent)' : 'var(--line-2)',
          bgcolor: dragOver ? 'var(--accent-soft)' : 'transparent',
          transition: 'border-color 150ms ease, background-color 150ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={photoUrl ?? undefined}
            sx={{
              width: 72,
              height: 72,
              fontSize: '1.5rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--on-accent)',
              bgcolor: photoUrl ? 'transparent' : 'var(--accent)',
            }}
          >
            {!photoUrl && initials}
          </Avatar>
          {uploading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                bgcolor: 'rgba(15,23,42,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress size={22} sx={{ color: 'common.white' }} />
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Photo de profil
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
            Glissez-déposez une image ou utilisez le bouton. JPEG, PNG, WebP ou GIF, 5 Mo max. La photo est
            synchronisée avec les OTA connectées.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleSelect}
            style={{ display: 'none' }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<Upload size={16} strokeWidth={1.75} />}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {photoUrl ? 'Remplacer' : 'Téléverser'}
          </Button>
          {photoUrl && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Delete size={16} strokeWidth={1.75} />}
              disabled={uploading}
              onClick={handleDelete}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Retirer
            </Button>
          )}
        </Box>
      </Box>
      {error && (
        <Alert severity="error" sx={{ py: 0.5, fontSize: '0.8125rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default AvatarUploader;
