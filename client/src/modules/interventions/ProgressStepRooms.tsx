import React from 'react';
import {
  Box, Typography, Button, Alert, Chip,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
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
  handleRoomValidation: (roomIndex: number) => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
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
  roomChip: (validated: boolean) => ({
    height: 32,
    fontSize: '0.8125rem',
    fontWeight: 500,
    borderRadius: '16px',
    transition: 'all 0.2s ease',
    ...(!validated && {
      '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    }),
  }),
} as const;

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
}) => {
  const totalRooms = getTotalRooms();
  const roomNames = getRoomNames();

  // ── Completed (accordion) ─────────────────────────────────────────────────

  if (allRoomsValidated) {
    return (
      <Accordion defaultExpanded={false} sx={stepStyles.accordion}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={stepStyles.accordionSummary}>
          <Box sx={stepStyles.stepBadge(true)}>
            <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
          <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
            Validation des pièces
          </Typography>
          <Chip
            label={`${validatedRooms.size}/${totalRooms}`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {roomNames.map((roomName, index) => (
              validatedRooms.has(index) && (
                <Chip
                  key={index}
                  icon={<CheckCircleOutlineIcon />}
                  label={roomName}
                  size="small"
                  color="success"
                  variant="filled"
                  sx={stepStyles.roomChip(true)}
                />
              )
            ))}
          </Box>

          {getStepNote('rooms') && (
            <Box>
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Box sx={stepStyles.noteBox}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {getStepNote('rooms')}
                </Typography>
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  }

  // ── Active (not yet completed) ────────────────────────────────────────────

  return (
    <Box sx={{ ...stepStyles.activeCard, display: 'flex', flexDirection: 'column', opacity: inspectionComplete ? 1 : 0.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box sx={stepStyles.stepBadge(false)}>2</Box>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            Validation des pièces
          </Typography>
          {totalRooms > 0 && inspectionComplete && (
            <Typography variant="caption" color="text.secondary">
              {validatedRooms.size} sur {totalRooms} validée(s)
            </Typography>
          )}
        </Box>
      </Box>

      {inspectionComplete ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Cliquez sur chaque pièce pour la valider après nettoyage
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {roomNames.map((roomName, index) => (
              <Chip
                key={index}
                icon={validatedRooms.has(index) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
                label={roomName}
                size="small"
                color={validatedRooms.has(index) ? 'success' : 'primary'}
                variant={validatedRooms.has(index) ? 'filled' : 'outlined'}
                onClick={validatedRooms.has(index) ? undefined : () => handleRoomValidation(index)}
                disabled={validatedRooms.has(index)}
                sx={stepStyles.roomChip(validatedRooms.has(index))}
              />
            ))}
          </Box>

          {getStepNote('rooms') && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Box sx={stepStyles.noteBox}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {getStepNote('rooms')}
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 'auto' }}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<CommentIcon />}
              onClick={() => handleOpenNotesDialog('rooms')}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              {getStepNote('rooms') ? 'Modifier note' : 'Note'}
            </Button>
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Disponible après la validation de l'inspection générale
        </Typography>
      )}
    </Box>
  );
};

const MemoizedProgressStepRooms = React.memo(ProgressStepRooms);
MemoizedProgressStepRooms.displayName = 'ProgressStepRooms';

export default MemoizedProgressStepRooms;
