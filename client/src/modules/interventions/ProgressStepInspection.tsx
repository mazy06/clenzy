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
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import PhotoGallery from '../../components/PhotoGallery';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ProgressStepInspectionProps {
  inspectionComplete: boolean;
  beforePhotos: string[];
  completedSteps: Set<string>;
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  setInspectionComplete: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  calculateProgress: () => number;
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const stepStyles = {
  accordion: {
    mb: 0,
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
    mb: 0,
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
  // ── Completed (accordion) ─────────────────────────────────────────────────

  if (inspectionComplete) {
    return (
      <Accordion defaultExpanded={false} sx={stepStyles.accordion}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={stepStyles.accordionSummary}>
          <Box sx={stepStyles.stepBadge(true)}>
            <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
          <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
            Inspection générale
          </Typography>
          <Chip
            label="Complété"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Vérification de l'état des lieux et photos avant intervention
          </Typography>

          {getStepNote('inspection') && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Box sx={stepStyles.noteBox}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {getStepNote('inspection')}
                </Typography>
              </Box>
            </Box>
          )}

          {beforePhotos.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                {beforePhotos.length} photo(s) avant intervention
              </Typography>
              <PhotoGallery photos={beforePhotos} columns={3} />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  }

  // ── Active (not yet completed) ────────────────────────────────────────────

  return (
    <Box sx={{ ...stepStyles.activeCard, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box sx={stepStyles.stepBadge(false)}>1</Box>
        <Typography variant="body2" fontWeight={600}>
          Inspection générale
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Vérifiez l'état des lieux et prenez des photos avant l'intervention
      </Typography>

      {beforePhotos.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          {beforePhotos.length} photo(s) ajoutée(s)
        </Typography>
      )}

      {getStepNote('inspection') && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
            Notes
          </Typography>
          <Box sx={stepStyles.noteBox}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('inspection')}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<PhotoCameraIcon />}
          onClick={() => { setPhotoType('before'); setPhotosDialogOpen(true); }}
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          Photos avant
        </Button>

        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<CommentIcon />}
          onClick={() => handleOpenNotesDialog('inspection')}
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          {getStepNote('inspection') ? 'Modifier note' : 'Note'}
        </Button>

        {beforePhotos.length > 0 && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            fullWidth
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => {
              setInspectionComplete(true);
              setCompletedSteps(prev => new Set(prev).add('inspection'));
              const newProgress = calculateProgress();
              handleUpdateProgressValue(newProgress);
            }}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.7 },
              },
            }}
          >
            Valider
          </Button>
        )}
      </Box>
    </Box>
  );
};

const MemoizedProgressStepInspection = React.memo(ProgressStepInspection);
MemoizedProgressStepInspection.displayName = 'ProgressStepInspection';

export default MemoizedProgressStepInspection;
