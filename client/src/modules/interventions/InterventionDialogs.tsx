import React from 'react';
import { cn } from '../../utils/cn';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { CircleCheck, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { Textarea } from '../../components/ui';
import {
  PhotoCamera as PhotoCameraIcon,
} from '../../icons';
import { StepNotes } from './interventionUtils';
import PhotoUploader from '../../components/PhotoUploader';
import { useTranslation } from '../../hooks/useTranslation';

// ============================================================
// NotesDialog
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
  // Le champ n'a jamais eu de libelle visible : c'est le titre du dialogue qui
  // le nomme. On le reprend en aria-label pour ne pas laisser la zone anonyme.
  const notesAriaLabel =
    currentStep === 'inspection'
      ? t('interventions.dialogs.notesInspectionTitle')
      : currentStep === 'rooms'
        ? t('interventions.dialogs.notesRoomsTitle')
        : t('interventions.dialogs.notesAfterTitle');
  return (
    // maxWidth="md" MUI = 900 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'inspection' && t('interventions.dialogs.notesInspectionTitle')}
            {currentStep === 'rooms' && t('interventions.dialogs.notesRoomsTitle')}
            {currentStep === 'after_photos' && t('interventions.dialogs.notesAfterTitle')}
          </DialogTitle>
        </DialogHeader>
        <UiAlert variant="info" className="mb-3 mt-1.5">
          <Info />
          <AlertDescription><p className="text-sm">
            {currentStep === 'inspection' && t('interventions.dialogs.notesInspectionAlert')}
            {currentStep === 'rooms' && t('interventions.dialogs.notesRoomsAlert')}
            {currentStep === 'after_photos' && t('interventions.dialogs.notesAfterAlert')}
          </p></AlertDescription>
        </UiAlert>
        <Textarea
          id="intervention-notes"
          aria-label={notesAriaLabel}
          rows={6}
          // Le primitif pose field-sizing:content, qui neutralise `rows` :
          // la hauteur de depart se garantit en min-h.
          className="w-full mt-[6px] min-h-[6lh]"
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
        />
        <UiAlert variant="info" className="mt-1.5 py-0.5">
          <Info />
          <AlertDescription><span className="text-xs">
            {t('interventions.dialogs.notesAutoSave')}
          </span></AlertDescription>
        </UiAlert>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('interventions.dialogs.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={updating}>
            {updating ? t('interventions.dialogs.saving') : t('interventions.dialogs.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
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
    // maxWidth="sm" MUI = 600 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {/* Le titre porte deja la typo h6 du gabarit : plus de <h6> imbrique. */}
          <DialogTitle className="flex items-center gap-1.5">
            <span className={cn('inline-flex', photoType === 'before' ? 'text-primary' : 'text-success')}><PhotoCameraIcon size={20} strokeWidth={1.75} /></span>
            {photoType === 'before' ? t('interventions.dialogs.photosBeforeTitle') : t('interventions.dialogs.photosAfterTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="pt-3">
          <UiAlert variant={photoType === 'before' ? 'info' : 'success'} className="mb-3">
            {photoType === 'before' ? <Info /> : <CircleCheck />}
            <AlertDescription><p className="text-sm">
              {photoType === 'before'
                ? t('interventions.dialogs.photosBeforeAlert')
                : t('interventions.dialogs.photosAfterAlert')}
            </p></AlertDescription>
          </UiAlert>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('interventions.dialogs.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={uploading || selectedPhotos.length === 0}>
            {uploading ? t('interventions.dialogs.uploading') : t('interventions.dialogs.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
