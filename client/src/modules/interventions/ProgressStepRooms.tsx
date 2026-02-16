import React from 'react';
import {
  Box, Typography, Button, Alert, Grid,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Comment as CommentIcon,
  Room as RoomIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ProgressStepRoomsProps {
  inspectionComplete: boolean;
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  getTotalRooms: () => number;
  getRoomNames: () => string[];
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  // Handlers
  handleRoomValidation: (roomIndex: number) => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  // State setters
  setAllRoomsValidated: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  saveCompletedSteps: (steps: Set<string>) => void;
  calculateProgress: () => number;
}

// ─── Component ───────────────────────────────────────────────────────────────

const ProgressStepRooms: React.FC<ProgressStepRoomsProps> = ({
  inspectionComplete,
  validatedRooms,
  allRoomsValidated,
  getTotalRooms,
  getRoomNames,
  getStepNote,
  handleRoomValidation,
  handleOpenNotesDialog,
  handleUpdateProgressValue,
  setAllRoomsValidated,
  setCompletedSteps,
  saveCompletedSteps,
  calculateProgress,
}) => {
  // ── Completed (accordion) state ────────────────────────────────────────────

  if (allRoomsValidated) {
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

            {/* Validated rooms list */}
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

            {/* Notes */}
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
                    borderColor: 'divider',
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

            {/* "Valider cette étape" button — visible only when all rooms are validated */}
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
                    '50%': { opacity: 0.7 },
                  },
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
                    variant={validatedRooms.has(index) ? 'contained' : 'outlined'}
                    color={validatedRooms.has(index) ? 'success' : 'primary'}
                    size="small"
                    startIcon={validatedRooms.has(index) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
                    onClick={() => handleRoomValidation(index)}
                    sx={{
                      fontSize: '0.75rem',
                      transition: 'all 0.3s ease',
                      minWidth: 'auto',
                      px: 2,
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
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

            {/* Notes */}
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
                    borderColor: 'divider',
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
  );
};

const MemoizedProgressStepRooms = React.memo(ProgressStepRooms);
MemoizedProgressStepRooms.displayName = 'ProgressStepRooms';

export default MemoizedProgressStepRooms;
