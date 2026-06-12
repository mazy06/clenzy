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
} from '../../../icons';
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

/** Sévérité → tokens sémantiques (haute = err, moyenne = warn, basse = info). */
const SEVERITY_TOKENS: Record<string, { color: string; bg: string }> = {
  haute: { color: 'var(--err)', bg: 'var(--err-soft)' },
  moyenne: { color: 'var(--warn)', bg: 'var(--warn-soft)' },
  basse: { color: 'var(--info)', bg: 'var(--info-soft)' },
};

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */
const chipSx = (bg: string, color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  fontVariantNumeric: 'tabular-nums',
  '& .MuiChip-label': { px: 1 },
  '& .MuiChip-icon': { color: 'inherit' },
});

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
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
        {(() => {
          const t = intervention.status === 'completed'
            ? { bg: 'var(--ok-soft)', color: 'var(--ok)' }
            : intervention.status === 'in_progress'
              ? { bg: 'var(--info-soft)', color: 'var(--info)' }
              : { bg: 'var(--warn-soft)', color: 'var(--warn)' };
          return (
            <Chip label={intervention.status} size="small" sx={chipSx(t.bg, t.color)} />
          );
        })()}
        {intervention.estimatedDurationHours && (
          <Chip
            icon={<Schedule size={12} strokeWidth={1.75} />}
            label={`${intervention.estimatedDurationHours}h estimées`}
            size="small"
            sx={chipSx('var(--info-soft)', 'var(--info)')}
          />
        )}
        {intervention.estimatedDurationHours && (
          <Chip
            icon={<AttachMoney size={12} strokeWidth={1.75} />}
            label={`${(intervention.estimatedDurationHours * 25).toFixed(0)} EUR`}
            size="small"
            sx={chipSx('var(--ok-soft)', 'var(--ok)')}
          />
        )}
      </Box>

      {/* Photos avant */}
      <PanelPhotoGallery photos={beforePhotos} label="Photos avant" />

      <Divider sx={{ my: 1.5 }} />

      {/* Photos après */}
      <PanelPhotoGallery photos={afterPhotos} label="Photos après" />

      <Divider sx={{ my: 1.5 }} />

      {/* Notes per step */}
      <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
        Notes
      </Typography>

      {!hasNotes && !intervention.notes ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontStyle: 'italic', mb: 1.5 }}>
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
                sx={{ '&:before': { display: 'none' }, border: '1px solid var(--line)', borderRadius: '9px !important', mb: 0.75, backgroundColor: 'var(--card)', backgroundImage: 'none' }}
              >
                <AccordionSummary expandIcon={<ExpandMore size={16} strokeWidth={1.75} />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.25 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Notes size={14} strokeWidth={1.75} /></Box>
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
            <Box sx={{ p: 1.25, backgroundColor: 'var(--field)', borderRadius: '10px', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{intervention.notes}</Typography>
            </Box>
          )}
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Signalements */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={OVERLINE_SX}>
          Signalements ({signalements.length})
        </Typography>
        <Button
          size="small"
          startIcon={<Add size={14} strokeWidth={1.75} />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ textTransform: 'none', fontSize: '0.625rem' }}
        >
          Ajouter
        </Button>
      </Box>

      {signalements.length === 0 ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          Aucun signalement
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {signalements.map((s, i) => (
            <Box
              key={i}
              sx={{
                p: 1.25,
                border: '1px solid var(--line)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              {(() => { const t = SEVERITY_TOKENS[s.severity] || SEVERITY_TOKENS.moyenne; return (
              <>
              <Box component="span" sx={{ display: 'inline-flex', color: t.color, mt: 0.25 }}><Warning size={16} strokeWidth={1.75} /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Chip
                  label={s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}
                  size="small"
                  sx={{ ...chipSx(t.bg, t.color), mb: 0.5 }}
                />
                <Typography sx={{ fontSize: '0.6875rem', color: 'var(--body)' }}>{s.description}</Typography>
              </Box>
              </>
              ); })()}
            </Box>
          ))}
        </Box>
      )}

      {/* Add signalement dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ajouter un signalement</DialogTitle>
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
