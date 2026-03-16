import React from 'react';
import {
  Box, Typography, Button, Chip,
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
  handleCompleteIntervention: () => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  completing: boolean;
  areAllStepsCompleted: boolean;
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const stepStyles = {
  accordion: {
    mb: 1,
    borderRadius: '8px !important',
    border: '1px solid',
    borderColor: 'success.light',
    bgcolor: 'rgba(46, 125, 50, 0.04)',
    '&:before': { display: 'none' },
    boxShadow: 'none',
    overflow: 'hidden',
  },
  accordionSummary: {
    minHeight: 48,
    '& .MuiAccordionSummary-content': {
      alignItems: 'center',
      gap: 1,
      my: 0.75,
    },
  },
  activeCard: {
    mb: 1,
    p: 2,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'primary.light',
    bgcolor: 'rgba(25, 118, 210, 0.02)',
  },
  stepBadge: (completed: boolean) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: completed ? 'success.main' : 'primary.main',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  }),
  noteBox: {
    p: 1.5,
    bgcolor: 'grey.50',
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: 'grey.200',
  },
} as const;

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
  // ── Completed (accordion) ─────────────────────────────────────────────────

  if (completedSteps.has('after_photos') && afterPhotos.length > 0) {
    return (
      <Accordion defaultExpanded={false} sx={stepStyles.accordion}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={stepStyles.accordionSummary}>
          <Box sx={stepStyles.stepBadge(true)}>
            <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
          <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
            Photos après intervention
          </Typography>
          <Chip
            label={`${afterPhotos.length} photo(s)`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
          {getStepNote('after_photos') && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Box sx={stepStyles.noteBox}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {getStepNote('after_photos')}
                </Typography>
              </Box>
            </Box>
          )}

          {afterPhotos.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                {afterPhotos.length} photo(s) après intervention
              </Typography>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  }

  // ── Active (not yet completed) ────────────────────────────────────────────

  return (
    <Box sx={stepStyles.activeCard}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={stepStyles.stepBadge(false)}>3</Box>
          <Typography variant="body2" fontWeight={600}>
            Photos après intervention
          </Typography>
        </Box>

        {allRoomsValidated && (
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraIcon />}
              onClick={() => { setPhotoType('after'); setPhotosDialogOpen(true); }}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              Photos après
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<CommentIcon />}
              onClick={() => handleOpenNotesDialog('after_photos')}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              {getStepNote('after_photos') ? 'Modifier note' : 'Note'}
            </Button>

            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<DoneIcon />}
              onClick={handleCompleteIntervention}
              disabled={!areAllStepsCompleted || completing || intervention.status === 'COMPLETED'}
              sx={{
                textTransform: 'none',
                fontSize: '0.8125rem',
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

      {allRoomsValidated ? (
        <Box sx={{ ml: 4.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Prenez des photos des pièces après l'intervention pour finaliser
          </Typography>

          {getStepNote('after_photos') && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Box sx={stepStyles.noteBox}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {getStepNote('after_photos')}
                </Typography>
              </Box>
            </Box>
          )}

          {afterPhotos.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                {afterPhotos.length} photo(s) ajoutée(s)
              </Typography>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ ml: 4.5 }}>
          <Typography variant="body2" color="text.secondary">
            Disponible après la validation de toutes les pièces
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const MemoizedProgressStepPhotos = React.memo(ProgressStepPhotos);
MemoizedProgressStepPhotos.displayName = 'ProgressStepPhotos';

export default MemoizedProgressStepPhotos;
