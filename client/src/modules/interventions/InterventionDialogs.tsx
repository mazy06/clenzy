import React from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
} from '../../icons';
import { StepNotes } from './interventionUtils';
import PhotoUploader from '../../components/PhotoUploader';
import { useTranslation } from '../../hooks/useTranslation';

// ============================================================
// 1. ProgressDialog
// ============================================================

export interface ProgressDialogProps {
  open: boolean;
  onClose: () => void;
  progressValue: number;
  onProgressChange: (value: number) => void;
  onSubmit: () => void;
  updating: boolean;
}

export const ProgressDialog: React.FC<ProgressDialogProps> = ({
  open,
  onClose,
  progressValue,
  onProgressChange,
  onSubmit,
  updating
}) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {t('interventions.dialogs.progressTitle')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('interventions.dialogs.progressDescription')}
          </Typography>
          <Box sx={{ px: 2 }}>
            <Slider
              value={progressValue}
              onChange={(_, newValue) => onProgressChange(newValue as number)}
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 25, label: '25%' },
                { value: 50, label: '50%' },
                { value: 75, label: '75%' },
                { value: 100, label: '100%' }
              ]}
              valueLabelDisplay="on"
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progressValue}
              sx={{ width: '100%', height: 8, borderRadius: 4 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('interventions.dialogs.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={updating}
        >
          {updating ? t('interventions.dialogs.updating') : t('interventions.dialogs.update')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================
// 2. NotesDialog
// ============================================================

export interface NotesDialogProps {
  open: boolean;
  onClose: () => void;
  currentStep: 'inspection' | 'rooms' | 'after_photos' | null;
  notesValue: string;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  updating: boolean;
  stepNotes: StepNotes;
  onStepNotesChange: (notes: StepNotes) => void;
}

export const NotesDialog: React.FC<NotesDialogProps> = ({
  open,
  onClose,
  currentStep,
  notesValue,
  onNotesChange,
  onSubmit,
  updating,
  stepNotes,
  onStepNotesChange
}) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {currentStep === 'inspection' && t('interventions.dialogs.notesInspectionTitle')}
        {currentStep === 'rooms' && t('interventions.dialogs.notesRoomsTitle')}
        {currentStep === 'after_photos' && t('interventions.dialogs.notesAfterTitle')}
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            {currentStep === 'inspection' && t('interventions.dialogs.notesInspectionAlert')}
            {currentStep === 'rooms' && t('interventions.dialogs.notesRoomsAlert')}
            {currentStep === 'after_photos' && t('interventions.dialogs.notesAfterAlert')}
          </Typography>
        </Alert>
        <TextField
          multiline
          rows={6}
          fullWidth
          value={notesValue}
          onChange={(e) => {
            onNotesChange(e.target.value);
            if (currentStep) {
              const updatedStepNotes = { ...stepNotes };
              if (currentStep === 'rooms') {
                if (!updatedStepNotes.rooms) {
                  updatedStepNotes.rooms = {};
                }
                updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: e.target.value };
              } else {
                updatedStepNotes[currentStep] = e.target.value;
              }
              onStepNotesChange(updatedStepNotes);
            }
          }}
          placeholder={
            currentStep === 'inspection'
              ? t('interventions.dialogs.notesInspectionPlaceholder')
              : currentStep === 'rooms'
              ? t('interventions.dialogs.notesRoomsPlaceholder')
              : t('interventions.dialogs.notesAfterPlaceholder')
          }
          sx={{ mt: 1 }}
        />
        <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            {t('interventions.dialogs.notesAutoSave')}
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('interventions.dialogs.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={updating}
        >
          {updating ? t('interventions.dialogs.saving') : t('interventions.dialogs.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================
// 3. PhotosDialog
// ============================================================

export interface PhotosDialogProps {
  open: boolean;
  onClose: () => void;
  photoType: 'before' | 'after';
  selectedPhotos: File[];
  onPhotosChange: (files: File[]) => void;
  onSubmit: () => void;
  uploading: boolean;
}

export const PhotosDialog: React.FC<PhotosDialogProps> = ({
  open,
  onClose,
  photoType,
  selectedPhotos,
  onPhotosChange,
  onSubmit,
  uploading,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Box component="span" sx={{ display: 'inline-flex', color: photoType === 'before' ? 'primary.main' : 'success.main' }}><PhotoCameraIcon size={20} strokeWidth={1.75} /></Box>
          <Typography variant="h6">
            {photoType === 'before' ? t('interventions.dialogs.photosBeforeTitle') : t('interventions.dialogs.photosAfterTitle')}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert
            severity={photoType === 'before' ? 'info' : 'success'}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              {photoType === 'before'
                ? t('interventions.dialogs.photosBeforeAlert')
                : t('interventions.dialogs.photosAfterAlert')}
            </Typography>
          </Alert>
          <PhotoUploader
            photos={selectedPhotos}
            onPhotosChange={onPhotosChange}
            maxFiles={10}
            maxSizeMB={5}
            label={photoType === 'before' ? t('interventions.dialogs.photosBeforeLabel') : t('interventions.dialogs.photosAfterLabel')}
            helperText={
              photoType === 'before'
                ? t('interventions.dialogs.photosBeforeHelper')
                : t('interventions.dialogs.photosAfterHelper')
            }
            columns={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('interventions.dialogs.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={uploading || selectedPhotos.length === 0}
        >
          {uploading ? t('interventions.dialogs.uploading') : t('interventions.dialogs.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
