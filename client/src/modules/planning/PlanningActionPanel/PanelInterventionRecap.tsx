import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  Notes,
  Warning,
  Schedule,
  AttachMoney,
  Add,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import PanelPhotoGallery from './PanelPhotoGallery';

// ─── Signalement parsing ────────────────────────────────────────────────────

interface Signalement {
  severity: 'basse' | 'moyenne' | 'haute';
  description: string;
}

const parseSignalements = (notes?: string): Signalement[] => {
  if (!notes) return [];
  const regex = /\[SIGNALEMENT:(\w+)\]\s*(.+?)(?=\[SIGNALEMENT|\n---|$)/gs;
  const results: Signalement[] = [];
  let match;
  while ((match = regex.exec(notes)) !== null) {
    results.push({
      severity: (match[1].toLowerCase() as Signalement['severity']) || 'moyenne',
      description: match[2].trim(),
    });
  }
  return results;
};

const parseStepNotes = (notes?: string): Record<string, string> => {
  if (!notes) return {};
  const result: Record<string, string> = {};
  const sections = notes.split('--- ');
  for (const section of sections) {
    if (section.startsWith('Inspection')) {
      result.inspection = section.replace(/^Inspection\s*---?\s*\n?/, '').trim();
    } else if (section.startsWith('Pieces') || section.startsWith('Pièces')) {
      result.rooms = section.replace(/^Pi[eè]ces\s*---?\s*\n?/, '').trim();
    } else if (section.startsWith('Final') || section.startsWith('Photos')) {
      result.after_photos = section.replace(/^(Final|Photos\s*après)\s*---?\s*\n?/, '').trim();
    }
  }
  return result;
};

const SEVERITY_HEX: Record<string, string> = {
  haute: '#d32f2f',
  moyenne: '#ED6C02',
  basse: '#0288d1',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface PanelInterventionRecapProps {
  event: PlanningEvent;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PanelInterventionRecap: React.FC<PanelInterventionRecapProps> = ({ event }) => {
  const intervention = event.intervention;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSeverity, setNewSeverity] = useState<Signalement['severity']>('moyenne');
  const [newDescription, setNewDescription] = useState('');

  if (!intervention) {
    return (
      <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
        Aucune donnée d'intervention disponible
      </Alert>
    );
  }

  const beforePhotos = intervention.beforePhotosUrls
    ? (typeof intervention.beforePhotosUrls === 'string'
        ? (intervention.beforePhotosUrls as string).split(',').filter(Boolean)
        : intervention.beforePhotosUrls as string[])
    : [];

  const afterPhotos = intervention.afterPhotosUrls
    ? (typeof intervention.afterPhotosUrls === 'string'
        ? (intervention.afterPhotosUrls as string).split(',').filter(Boolean)
        : intervention.afterPhotosUrls as string[])
    : [];

  const stepNotes = parseStepNotes(intervention.notes);
  const signalements = parseSignalements(intervention.notes);
  const hasNotes = Object.keys(stepNotes).length > 0;

  return (
    <Box>
      {/* Status + duration summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {(() => { const c = intervention.status === 'completed' ? '#4A9B8E' : intervention.status === 'in_progress' ? '#0288d1' : '#ED6C02'; return (
        <Chip
          label={intervention.status}
          size="small"
          sx={{ fontSize: '0.625rem', height: 22, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
        />
        ); })()}
        {intervention.estimatedDurationHours && (() => { const c = '#0288d1'; return (
          <Chip
            icon={<Schedule sx={{ fontSize: 12, color: `${c} !important` }} />}
            label={`${intervention.estimatedDurationHours}h estimées`}
            size="small"
            sx={{ fontSize: '0.625rem', height: 22, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        ); })()}
        {intervention.estimatedDurationHours && (() => { const c = '#4A9B8E'; return (
          <Chip
            icon={<AttachMoney sx={{ fontSize: 12, color: `${c} !important` }} />}
            label={`${(intervention.estimatedDurationHours * 25).toFixed(0)} EUR`}
            size="small"
            sx={{ fontSize: '0.625rem', height: 22, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
        ); })()}
      </Box>

      {/* Photos avant */}
      <PanelPhotoGallery photos={beforePhotos} label="Photos avant" />

      <Divider sx={{ my: 1.5 }} />

      {/* Photos après */}
      <PanelPhotoGallery photos={afterPhotos} label="Photos après" />

      <Divider sx={{ my: 1.5 }} />

      {/* Notes per step */}
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
        Notes
      </Typography>

      {!hasNotes && !intervention.notes ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic', mb: 1.5 }}>
          Aucune note enregistrée
        </Typography>
      ) : (
        <>
          {['inspection', 'rooms', 'after_photos'].map((step) => {
            const note = stepNotes[step];
            if (!note) return null;
            const labels: Record<string, string> = {
              inspection: 'Inspection',
              rooms: 'Pièces',
              after_photos: 'Photos après',
            };
            return (
              <Accordion
                key={step}
                disableGutters
                elevation={0}
                defaultExpanded
                sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: '6px !important', mb: 0.75 }}
              >
                <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.25 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Notes sx={{ fontSize: 14, color: 'primary.main' }} />
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>{labels[step]}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                  <Typography sx={{ fontSize: '0.6875rem', whiteSpace: 'pre-wrap' }}>{note}</Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Raw notes fallback if no structured notes */}
          {!hasNotes && intervention.notes && (
            <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.6875rem', whiteSpace: 'pre-wrap' }}>{intervention.notes}</Typography>
            </Box>
          )}
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Signalements */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
          Signalements ({signalements.length})
        </Typography>
        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 14 }} />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ textTransform: 'none', fontSize: '0.625rem' }}
        >
          Ajouter
        </Button>
      </Box>

      {signalements.length === 0 ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Aucun signalement
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {signalements.map((s, i) => (
            <Box
              key={i}
              sx={{
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              {(() => { const c = SEVERITY_HEX[s.severity] || '#ED6C02'; return (
              <>
              <Warning sx={{ fontSize: 16, color: c, mt: 0.25 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Chip
                  label={s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}
                  size="small"
                  sx={{ fontSize: '0.5625rem', height: 18, mb: 0.5, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                />
                <Typography sx={{ fontSize: '0.6875rem' }}>{s.description}</Typography>
              </Box>
              </>
              ); })()}
            </Box>
          ))}
        </Box>
      )}

      {/* Add signalement dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>Ajouter un signalement</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Sévérité"
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as Signalement['severity'])}
            sx={{ mb: 2, mt: 1 }}
          >
            <MenuItem value="basse">Basse</MenuItem>
            <MenuItem value="moyenne">Moyenne</MenuItem>
            <MenuItem value="haute">Haute</MenuItem>
          </TextField>
          <TextField
            fullWidth
            size="small"
            label="Description"
            multiline
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} size="small">Annuler</Button>
          <Button
            variant="contained"
            size="small"
            disabled={!newDescription.trim()}
            onClick={() => {
              // Would append [SIGNALEMENT:severity] description to notes
              setAddDialogOpen(false);
              setNewDescription('');
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PanelInterventionRecap;
