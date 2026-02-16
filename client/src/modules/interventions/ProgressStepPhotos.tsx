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
  Done as DoneIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { InterventionDetailsData } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ProgressStepPhotosProps {
  intervention: InterventionDetailsData;
  allRoomsValidated: boolean;
  afterPhotos: string[];
  completedSteps: Set<string>;
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  // Handlers
  handleCompleteIntervention: () => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  // State setters
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  // Loading
  completing: boolean;
  areAllStepsCompleted: boolean;
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

const ProgressStepPhotos: React.FC<ProgressStepPhotosProps> = ({
  intervention,
  allRoomsValidated,
  afterPhotos,
  completedSteps,
  getStepNote,
  handleCompleteIntervention,
  handleOpenNotesDialog,
  setPhotoType,
  setPhotosDialogOpen,
  completing,
  areAllStepsCompleted,
}) => {
  // ── Completed (accordion) state ────────────────────────────────────────────

  if (completedSteps.has('after_photos') && afterPhotos.length > 0) {
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
            Étape 3: Photos après intervention
          </Typography>
          <Box sx={{ ml: 'auto', mr: 2 }}>
            <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                ✓ Toutes les étapes sont complétées ! Vous pouvez maintenant terminer l'intervention.
              </Typography>
            </Alert>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ pt: 1 }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
              Prendre des photos des pièces après l'intervention pour finaliser
            </Typography>

            {/* Notes */}
            {getStepNote('after_photos') && (
              <Box sx={{ mt: 1.5, mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                  Notes finales
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
                    {getStepNote('after_photos')}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Photos gallery */}
            {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after', completedSteps)}
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
            Étape 3: Photos après intervention
          </Typography>
        </Box>

        {allRoomsValidated && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraIcon />}
              onClick={() => {
                setPhotoType('after');
                setPhotosDialogOpen(true);
              }}
            >
              Ajouter photos après
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<CommentIcon />}
              onClick={() => handleOpenNotesDialog('after_photos')}
            >
              {getStepNote('after_photos') ? 'Modifier note' : 'Ajouter note'}
            </Button>

            {/* Terminer button */}
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<DoneIcon />}
              onClick={handleCompleteIntervention}
              disabled={!areAllStepsCompleted || completing || intervention.status === 'COMPLETED'}
              sx={{
                ...(areAllStepsCompleted && !completing && intervention.status !== 'COMPLETED' ? {
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                } : {}),
              }}
            >
              {completing ? 'Finalisation...' : (intervention.status === 'COMPLETED' ? 'Terminée' : 'Terminer')}
            </Button>
          </Box>
        )}
      </Box>

      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
        Prendre des photos des pièces après l'intervention pour finaliser
      </Typography>

      {allRoomsValidated ? (
        <>
          {/* Notes */}
          {getStepNote('after_photos') && (
            <Box sx={{ ml: 4, mt: 1.5, mb: 1.5 }}>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                Notes finales
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
                  {getStepNote('after_photos')}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Photos gallery */}
          <Box sx={{ ml: 4 }}>
            {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after', completedSteps)}
          </Box>
        </>
      ) : (
        <Alert severity="info" sx={{ ml: 4, mt: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            ⓘ Cette étape sera disponible après la validation de toutes les pièces.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

const MemoizedProgressStepPhotos = React.memo(ProgressStepPhotos);
MemoizedProgressStepPhotos.displayName = 'ProgressStepPhotos';

export default MemoizedProgressStepPhotos;
