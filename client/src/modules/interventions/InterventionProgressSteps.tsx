import React from 'react';
import {
  Box, Typography, LinearProgress, Button, Alert, Grid,
  Chip, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  PlayArrow as PlayArrowIcon,
  PhotoCamera as PhotoCameraIcon,
  Comment as CommentIcon,
  Done as DoneIcon,
  Replay as ReplayIcon,
  Room as RoomIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import type { InterventionDetailsData, StepNotes } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';

interface InterventionProgressStepsProps {
  intervention: InterventionDetailsData;
  // Progression
  calculateProgress: () => number;
  canUpdateProgress: boolean;
  canStartIntervention: boolean;
  canStartOrUpdateIntervention: boolean;
  // Property & rooms
  propertyDetails: any | null;
  getTotalRooms: () => number;
  getRoomNames: () => string[];
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  inspectionComplete: boolean;
  // Photos
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  // Notes
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  // Handlers
  handleStartIntervention: () => void;
  handleCompleteIntervention: () => void;
  handleReopenIntervention: () => void;
  handleRoomValidation: (roomIndex: number) => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  // State setters
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  setInspectionComplete: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAllRoomsValidated: (value: boolean) => void;
  saveCompletedSteps: (steps: Set<string>) => void;
  // Loading states
  starting: boolean;
  completing: boolean;
  // All steps completed check
  areAllStepsCompleted: boolean;
}

const InterventionProgressSteps: React.FC<InterventionProgressStepsProps> = ({
  intervention,
  calculateProgress,
  canUpdateProgress,
  canStartIntervention,
  canStartOrUpdateIntervention,
  propertyDetails,
  getTotalRooms,
  getRoomNames,
  validatedRooms,
  allRoomsValidated,
  inspectionComplete,
  beforePhotos,
  afterPhotos,
  completedSteps,
  getStepNote,
  handleStartIntervention,
  handleCompleteIntervention,
  handleReopenIntervention,
  handleRoomValidation,
  handleOpenNotesDialog,
  handleUpdateProgressValue,
  setPhotoType,
  setPhotosDialogOpen,
  setInspectionComplete,
  setCompletedSteps,
  setAllRoomsValidated,
  saveCompletedSteps,
  starting,
  completing,
  areAllStepsCompleted
}) => {

  const renderPhotosGallery = (photos: string[], title: string, photoType: 'before' | 'after') => {
    if (photos.length === 0) return null;
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
            {photos.length} photo(s) ajoutee(s)
            {completedSteps.has(photoType === 'before' ? 'inspection' : 'after_photos') && (
              <Chip label="Validee" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
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

  return (
    <>
      {/* Progression */}
      <Box mb={1.5}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
            Progression
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ fontSize: '0.95rem' }}>
            {calculateProgress()}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={calculateProgress()}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* Étapes de progression */}
      {canUpdateProgress && propertyDetails && (
        <Box mb={2}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5, fontSize: '0.95rem' }}>
            Étapes de progression
          </Typography>

          {/* Étape 3: Photos après intervention - LA PLUS RÉCENTE (en haut) */}
          {/* Afficher seulement si l'étape 2 est validée (étape suivante) OU si l'étape 3 est validée */}
          {allRoomsValidated && (
            (completedSteps.has('after_photos') && afterPhotos.length > 0) ? (
              <Accordion
              defaultExpanded={false}
              sx={{
                mb: 1.5,
                border: '1px solid',
                borderColor: 'success.main',
                bgcolor: 'success.50',
                '&:before': { display: 'none' },
                boxShadow: 'none'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1
                  }
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

                  {/* Notes pour les photos après intervention - Afficher seulement si une note existe - AU-DESSUS des photos */}
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
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {getStepNote('after_photos')}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Affichage des photos après intervention - Utilisation du composant réutilisable - EN DESSOUS des notes */}
                  {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after')}
                </Box>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
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

                    {/* Bouton Terminer - Toujours visible dans l'étape 3 mais désactivé si les conditions ne sont pas remplies */}
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
                            '50%': { opacity: 0.7 }
                          }
                        } : {})
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

                    {/* Notes pour les photos après intervention - Afficher seulement si une note existe - AU-DESSUS des photos */}
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
                            borderColor: 'divider'
                          }}
                        >
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                            {getStepNote('after_photos')}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Affichage des photos après intervention - Utilisation du composant réutilisable - EN DESSOUS des notes */}
                    <Box sx={{ ml: 4 }}>
                      {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after')}
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
            )
          )}

          {/* Étape 2: Validation par pièce */}
          {/* Afficher seulement si l'étape 1 est validée */}
          {inspectionComplete && (
            allRoomsValidated ? (
              <Accordion
              defaultExpanded={false}
              sx={{
                mb: 1.5,
                border: '1px solid',
                borderColor: 'success.main',
                bgcolor: 'success.50',
                '&:before': { display: 'none' },
                boxShadow: 'none'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1
                  }
                }}
              >
                <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  Étape 2: Validation des pièces ({validatedRooms.size}/{getTotalRooms()})
                </Typography>
                <Box sx={{ ml: 'auto', mr: 2 }}>
                  <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                      ✓ Toutes les pièces sont validées ! Vous pouvez maintenant prendre les photos après intervention.
                    </Typography>
                  </Alert>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ pt: 1 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                    Cliquez sur chaque pièce pour la valider après nettoyage
                  </Typography>

                  {/* Afficher les pièces validées */}
                  {validatedRooms.size > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        {validatedRooms.size} pièce(s) validée(s)
                      </Typography>
                      <Grid container spacing={1}>
                        {getRoomNames().map((roomName, index) => (
                          validatedRooms.has(index) && (
                            <Grid item xs="auto" key={index}>
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<CheckCircleOutlineIcon />}
                                disabled
                                sx={{
                                  fontSize: '0.75rem',
                                  minWidth: 'auto',
                                  px: 2,
                                }}
                              >
                                {roomName} ✓
                              </Button>
                            </Grid>
                          )
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* Notes pour la validation des pièces - Afficher seulement si une note existe */}
                  {getStepNote('rooms') && (
                    <Box sx={{ mt: 1.5, mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                        Notes de validation
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {getStepNote('rooms')}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                    Étape 2: Validation des pièces ({validatedRooms.size}/{getTotalRooms()})
                  </Typography>
                </Box>

                {inspectionComplete && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CommentIcon />}
                      onClick={() => handleOpenNotesDialog('rooms')}
                    >
                      {getStepNote('rooms') ? 'Modifier note' : 'Ajouter note'}
                    </Button>

                    {/* Bouton "Valider cette étape" - Afficher seulement quand toutes les pièces sont validées */}
                    {validatedRooms.size === getTotalRooms() && !allRoomsValidated && (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={() => {
                          setAllRoomsValidated(true);
                          setCompletedSteps(prev => {
                            const newSet = new Set(prev).add('rooms');
                            saveCompletedSteps(newSet);
                            return newSet;
                          });
                          const newProgress = calculateProgress();
                          handleUpdateProgressValue(newProgress);
                        }}
                        sx={{
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.7 }
                          }
                        }}
                      >
                        Valider cette étape
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
                Cliquez sur chaque pièce pour la valider après nettoyage
              </Typography>

              {inspectionComplete ? (
                <>

                  <Box sx={{ ml: 4, mt: 1 }}>
                    <Grid container spacing={1}>
                      {getRoomNames().map((roomName, index) => (
                        <Grid item xs="auto" key={index}>
                          <Button
                            variant={validatedRooms.has(index) ? "contained" : "outlined"}
                            color={validatedRooms.has(index) ? "success" : "primary"}
                            size="small"
                            startIcon={validatedRooms.has(index) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
                            onClick={() => handleRoomValidation(index)}
                            sx={{
                              fontSize: '0.75rem',
                              transition: 'all 0.3s ease',
                              minWidth: 'auto',
                              px: 2,
                              '&:hover': {
                                transform: 'scale(1.05)'
                              }
                            }}
                            disabled={validatedRooms.has(index)}
                          >
                            {roomName}
                            {validatedRooms.has(index) && ' ✓'}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  {validatedRooms.size > 0 && validatedRooms.size < getTotalRooms() && (
                    <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {validatedRooms.size} sur {getTotalRooms()} pièces validées. Continuez à valider les pièces restantes.
                      </Typography>
                    </Alert>
                  )}

                  {/* Notes pour la validation des pièces - Afficher seulement si une note existe */}
                  {getStepNote('rooms') && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                        Notes de validation
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {getStepNote('rooms')}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  </Box>
                </>
              ) : (
                <Alert severity="info" sx={{ ml: 4, mt: 1, py: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    ⓘ Cette étape sera disponible après la validation de l'inspection générale.
                  </Typography>
                </Alert>
              )}
              </Box>
            )
          )}

          {/* Étape 1: Inspection générale - LA PLUS ANCIENNE (en bas) */}
          {/* Toujours afficher l'étape 1 */}
          {inspectionComplete ? (
            <Accordion
              defaultExpanded={false}
              sx={{
                mb: 1.5,
                border: '1px solid',
                borderColor: 'success.main',
                bgcolor: 'success.50',
                '&:before': { display: 'none' },
                boxShadow: 'none'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1
                  }
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

                  {/* Notes pour l'étape d'inspection - Afficher seulement si une note existe - AU-DESSUS des photos */}
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
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {getStepNote('inspection')}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Affichage des photos avant intervention - Utilisation du composant réutilisable */}
                  {renderPhotosGallery(beforePhotos, 'Photos avant intervention', 'before')}
                </Box>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
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
                          '50%': { opacity: 0.7 }
                        }
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

              {/* Notes pour l'étape d'inspection - Afficher seulement si une note existe */}
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
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {getStepNote('inspection')}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Bouton pour démarrer l'intervention */}
      {canStartIntervention && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            fullWidth
            onClick={handleStartIntervention}
            disabled={starting}
            sx={{ py: 1 }}
          >
            {starting ? 'Démarrage...' : 'Démarrer l\'intervention'}
          </Button>
        </Box>
      )}

      {/* Bouton pour rouvrir une intervention terminée */}
      {intervention && intervention.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 2
            }}
          >
            <Alert
              severity="info"
              sx={{
                flex: { xs: '1 1 auto', sm: '1 1 60%' },
                mb: { xs: 0, sm: 0 },
                '& .MuiAlert-message': {
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center'
                }
              }}
              icon={false}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'info.main',
                    flexShrink: 0
                  }}
                >
                  <CheckCircleIcon
                    sx={{
                      fontSize: 20,
                      color: 'white'
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6, flex: 1 }}>
                  Cette intervention est terminée. Vous pouvez la rouvrir pour effectuer des modifications ou corriger des oublis.
                </Typography>
              </Box>
            </Alert>
            <Box
              sx={{
                flex: { xs: '1 1 auto', sm: '0 0 auto' },
                minWidth: { xs: '100%', sm: '200px' },
                maxWidth: { xs: '100%', sm: '250px' }
              }}
            >
              <Button
                variant="contained"
                color="warning"
                startIcon={<ReplayIcon />}
                fullWidth
                onClick={handleReopenIntervention}
                disabled={completing}
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                  }
                }}
              >
                {completing ? 'Réouverture...' : 'Réouvrir l\'intervention'}
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Photos avant intervention - Afficher seulement si l'etape n'est pas validee */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && (
        <Box sx={{ mb: 2, mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
            Photos avant intervention
          </Typography>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </Box>
      )}
    </>
  );
};

export default InterventionProgressSteps;
