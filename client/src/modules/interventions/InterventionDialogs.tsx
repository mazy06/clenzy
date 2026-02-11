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
} from '@mui/icons-material';
import { StepNotes } from './interventionUtils';
import PhotoUploader from '../../components/PhotoUploader';

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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Mettre à jour la progression
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Définissez le pourcentage de progression de l'intervention
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
          Annuler
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={updating}
        >
          {updating ? 'Mise à jour...' : 'Mettre à jour'}
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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {currentStep === 'inspection' && 'Notes de l\'inspection générale'}
        {currentStep === 'rooms' && 'Notes de validation des pièces'}
        {currentStep === 'after_photos' && 'Notes finales (après intervention)'}
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            {currentStep === 'inspection' && 'Ajoutez des notes sur l\'état de l\'appartement avant l\'intervention (casses, problèmes détectés, etc.)'}
            {currentStep === 'rooms' && 'Ajoutez des notes sur la validation des pièces (problèmes rencontrés, points d\'attention, etc.)'}
            {currentStep === 'after_photos' && 'Ajoutez des notes finales sur l\'intervention (remarques, points à suivre, etc.)'}
          </Typography>
        </Alert>
        <TextField
          multiline
          rows={6}
          fullWidth
          value={notesValue}
          onChange={(e) => {
            onNotesChange(e.target.value);
            // Mettre à jour les notes localement pour la sauvegarde automatique
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
              ? 'Ex: Aucune casse détectée, appartement en bon état général...'
              : currentStep === 'rooms'
              ? 'Ex: Toutes les pièces nettoyées, quelques taches difficiles dans la salle de bain...'
              : 'Ex: Intervention terminée avec succès, client satisfait...'
          }
          sx={{ mt: 1 }}
        />
        <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            💾 Les modifications sont sauvegardées automatiquement après 2 secondes d'inactivité.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Annuler
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={updating}
        >
          {updating ? 'Enregistrement...' : 'Enregistrer'}
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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PhotoCameraIcon color={photoType === 'before' ? 'primary' : 'success'} />
          <Typography variant="h6">
            Photos {photoType === 'before' ? 'avant' : 'après'} l'intervention
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
                ? 'Prenez des photos de toutes les pieces pour verifier qu\'il n\'y a aucune casse avant de commencer l\'intervention.'
                : 'Prenez des photos de toutes les pieces apres le nettoyage pour finaliser l\'intervention.'}
            </Typography>
          </Alert>
          <PhotoUploader
            photos={selectedPhotos}
            onPhotosChange={onPhotosChange}
            maxFiles={10}
            maxSizeMB={5}
            label={photoType === 'before' ? 'Photos avant intervention' : 'Photos apres intervention'}
            helperText={
              photoType === 'before'
                ? 'Ces photos serviront de reference pour l\'inspection generale.'
                : 'Ces photos confirmeront que l\'intervention est terminee.'
            }
            columns={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Annuler
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={uploading || selectedPhotos.length === 0}
        >
          {uploading ? 'Upload...' : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
