import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  AddPhotoAlternate,
  PhotoLibrary,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { propertyPhotosApi, type PropertyPhotoDto } from '../../services/api/propertyPhotosApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyPhoto {
  id: string;
  url: string;
  name: string;
  apiId?: number; // DB id for API operations
}

interface PropertyPhotosTabProps {
  propertyId: number;
}

// ─── Stable sx constants ─────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1,
} as const;

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 1.5,
} as const;

const DROP_ZONE_SX = {
  border: '2px dashed',
  borderColor: 'divider',
  borderRadius: 1.5,
  p: 3,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
  '&:hover': {
    borderColor: 'primary.main',
    bgcolor: 'action.hover',
  },
} as const;

const DROP_ZONE_ACTIVE_SX = {
  ...DROP_ZONE_SX,
  borderColor: 'primary.main',
  bgcolor: 'primary.50',
} as const;

const PHOTO_CARD_SX = {
  position: 'relative',
  borderRadius: 1.5,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  aspectRatio: '4 / 3',
  '&:hover .photo-overlay': {
    opacity: 1,
  },
} as const;

const PHOTO_OVERLAY_SX = {
  position: 'absolute',
  top: 0,
  right: 0,
  left: 0,
  bottom: 0,
  bgcolor: 'rgba(0, 0, 0, 0.4)',
  opacity: 0,
  transition: 'opacity 0.2s ease',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  p: 0.5,
} as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ───────────────────────────────────────────────────────────────

const PropertyPhotosTab: React.FC<PropertyPhotosTabProps> = ({ propertyId }) => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // ── Load photos from API on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    propertyPhotosApi.list(propertyId)
      .then((data: PropertyPhotoDto[]) => {
        if (cancelled) return;
        setPhotos(data.map((dto) => ({
          id: String(dto.id),
          url: propertyPhotosApi.getPhotoUrl(propertyId, dto.id),
          name: dto.originalFilename || `photo-${dto.id}`,
          apiId: dto.id,
        })));
      })
      .catch(() => { /* silent — empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  // ── Upload files via API ─────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;
    let skippedTooLarge = 0;
    let skippedNotImage = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          skippedNotImage++;
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          skippedTooLarge++;
          continue;
        }
        try {
          const dto = await propertyPhotosApi.upload(propertyId, file);
          setPhotos((prev) => [...prev, {
            id: String(dto.id),
            url: propertyPhotosApi.getPhotoUrl(propertyId, dto.id),
            name: dto.originalFilename || file.name,
            apiId: dto.id,
          }]);
          uploaded++;
        } catch (err) {
          failed++;
          const message = err instanceof Error ? err.message : 'Erreur inconnue';
          notify.error(`Échec upload "${file.name}" : ${message}`);
        }
      }
    } finally {
      setUploading(false);
    }
    if (skippedTooLarge > 0) {
      notify.warning(`${skippedTooLarge} photo(s) ignorée(s) : taille > 10 Mo`);
    }
    if (skippedNotImage > 0) {
      notify.warning(`${skippedNotImage} fichier(s) ignoré(s) : format non image`);
    }
    if (uploaded > 0 && failed === 0 && skippedTooLarge === 0 && skippedNotImage === 0) {
      notify.success(`${uploaded} photo(s) ajoutée(s)`);
    }
  }, [propertyId, notify]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files);
      if (e.target) e.target.value = '';
    },
    [addFiles],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.apiId) {
        await propertyPhotosApi.delete(propertyId, deleteTarget.apiId);
      }
      setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      notify.error(`Échec suppression : ${message}`);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, propertyId, notify]);

  const hasPhotos = photos.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── Sync info banner ─────────────────────────────────────────────── */}
      <Alert severity="info" variant="outlined" sx={{ fontSize: '0.75rem' }}>
        {t('properties.photos.channelSync')}
      </Alert>

      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      <Paper sx={CARD_SX}>
        <Typography sx={SECTION_TITLE_SX}>{t('properties.photos.upload')}</Typography>
        <Box
          sx={isDragOver ? DROP_ZONE_ACTIVE_SX : DROP_ZONE_SX}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CloudUpload sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.secondary', textAlign: 'center' }}>
            {t('properties.photos.dragDrop')}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', mt: 0.5 }}>
            {t('properties.photos.maxSize')}
          </Typography>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </Paper>

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* ── Photo grid or empty state ────────────────────────────────────── */}
      {!loading && hasPhotos ? (
        <Paper sx={CARD_SX}>
          <Typography sx={SECTION_TITLE_SX}>
            {t('properties.photos.title')} ({photos.length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 1,
            }}
          >
            {photos.map((photo) => (
              <Box key={photo.id} sx={PHOTO_CARD_SX}>
                <Box
                  component="img"
                  src={photo.url}
                  alt={photo.name}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <Box className="photo-overlay" sx={PHOTO_OVERLAY_SX}>
                  <IconButton
                    size="small"
                    onClick={() => setDeleteTarget(photo)}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      '&:hover': { bgcolor: 'error.light', color: 'white' },
                      width: 28,
                      height: 28,
                    }}
                  >
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}

            {/* Add more button */}
            <Box
              sx={{
                ...DROP_ZONE_SX,
                p: 0,
                aspectRatio: '4 / 3',
                border: '2px dashed',
                borderColor: 'divider',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <AddPhotoAlternate sx={{ fontSize: 28, color: 'text.disabled' }} />
            </Box>
          </Box>
        </Paper>
      ) : !loading ? (
        <Paper
          sx={{
            ...CARD_SX,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 6,
          }}
        >
          <PhotoLibrary sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            {t('properties.photos.empty')}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mb: 2, textAlign: 'center', maxWidth: 320 }}>
            {t('properties.photos.emptyDesc')}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
          >
            {t('properties.photos.upload')}
          </Button>
        </Paper>
      ) : null}

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
          {t('properties.photos.deleteConfirm')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.8125rem' }}>
            {deleteTarget?.name}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} size="small" sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" size="small" sx={{ textTransform: 'none' }}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyPhotosTab;
