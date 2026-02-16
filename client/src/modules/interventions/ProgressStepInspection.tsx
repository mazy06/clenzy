import React from 'react';
import {
  Box, Typography, Button, Alert, Chip,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  PhotoCamera as PhotoCameraIcon,
  Comment as CommentIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import PhotoGallery from '../../components/PhotoGallery';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ProgressStepInspectionProps {
  inspectionComplete: boolean;
  beforePhotos: string[];
  completedSteps: Set<string>;
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  // Handlers
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  // State setters
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  setInspectionComplete: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  calculateProgress: () => number;
}

// ─── Shared sub-renderer ─────────────────────────────────────────────────────

const renderPhotosGallery = (
  photos: string[],
  title: string,
  photoType: 'before' | 'after',
  completedSteps: Set<string>,
) => {
  if (photos.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
          {photos.length} photo(s) ajoutée(s)
          {completedSteps.has(photoType === 'before' ? 'inspection' : 'after_photos') && (
            <Chip label="Validée" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
          )}
        </Typography>
      </Box>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1, fontSize: '0.85rem' }}>
        {title}
      </Typography>
      <PhotoGallery photos={photos} columns={3} />
    </Box>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const ProgressStepInspection: React.FC<ProgressStepInspectionProps> = ({
  inspectionComplete,
  beforePhotos,
  completedSteps,
  getStepNote,
  handleOpenNotesDialog,
  handleUpdateProgressValue,
  setPhotoType,
  setPhotosDialogOpen,
  setInspectionComplete,
  setCompletedSteps,
  calculateProgress,
}) => {
  if (inspectionComplete) {
    return (
      <Accordion
        defaultExpanded={false}
        sx={{
          mb: 1.5,
          border: '1px solid',
          borderColor: 'success.main',
          bgcolor: 'success.50',
          '&:before': { display: 'none' },
          boxShadow: 'none',
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              gap: 1,
            },
          }}
        >
          <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
            Étape 1: Inspection générale
          </Typography>
          <Box sx={{ ml: 'auto', mr: 2 }}>
            <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                ✓ Étape validée ! Vous pouvez maintenant passer à la validation des pièces.
              </Typography>
            </Alert>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ pt: 1 }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
              Vérifier qu'il n'y a aucune casse et prendre des photos des pièces avant l'intervention
            </Typography>

            {/* Notes */}
            {getStepNote('inspection') && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                  Notes de l'inspection
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                    {getStepNote('inspection')}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Photos gallery */}
            {renderPhotosGallery(beforePhotos, 'Photos avant intervention', 'before', completedSteps)}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  }

  // ── Active (not yet completed) state ─────────────────────────────────────

  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
          <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
            Étape 1: Inspection générale
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhotoCameraIcon />}
            onClick={() => {
              setPhotoType('before');
              setPhotosDialogOpen(true);
            }}
          >
            Ajouter photos avant
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<CommentIcon />}
            onClick={() => handleOpenNotesDialog('inspection')}
          >
            {getStepNote('inspection') ? 'Modifier note' : 'Ajouter note'}
          </Button>

          {beforePhotos.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={() => {
                setInspectionComplete(true);
                setCompletedSteps(prev => new Set(prev).add('inspection'));
                const newProgress = calculateProgress();
                handleUpdateProgressValue(newProgress);
              }}
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            >
              Valider cette étape
            </Button>
          )}
        </Box>
      </Box>

      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
        Vérifier qu'il n'y a aucune casse et prendre des photos des pièces avant l'intervention
      </Typography>

      {beforePhotos.length > 0 && (
        <Box sx={{ ml: 4, mt: 1 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            {beforePhotos.length} photo(s) ajoutée(s)
          </Typography>
        </Box>
      )}

      {/* Notes */}
      {getStepNote('inspection') && (
        <Box sx={{ ml: 4, mt: 1.5 }}>
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
            Notes de l'inspection
          </Typography>
          <Box
            sx={{
              p: 1,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {getStepNote('inspection')}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const MemoizedProgressStepInspection = React.memo(ProgressStepInspection);
MemoizedProgressStepInspection.displayName = 'ProgressStepInspection';

export default MemoizedProgressStepInspection;
