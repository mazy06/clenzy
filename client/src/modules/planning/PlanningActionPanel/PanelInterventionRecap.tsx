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
import { STATUS_TONES, toneTokensSx, type ToneTokens } from '../../../components/StatusChip';

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

/** Sévérité → tons sémantiques partagés (haute = err, moyenne = warn, basse = info). */
const SEVERITY_TOKENS: Record<string, ToneTokens> = {
  haute: STATUS_TONES.err,
  moyenne: STATUS_TONES.warn,
  basse: STATUS_TONES.info,
};

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */
const chipSx = (bg: string, color: string) => ({
  ...toneTokensSx({ color, bg }),
  borderRadius: 'var(--radius-pill)',
  fontVariantNumeric: 'tabular-nums',
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
    <div>
      {/* Status + duration summary */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
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
      </div>

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
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] italic mb-2">
          Aucune note enregistrée
        </p>
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
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-[var(--accent)]"><Notes size={14} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.6875rem] font-semibold">{labels[step]}</p>
                  </div>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                  <p className="cn-text-body1 text-[0.6875rem] whitespace-pre-wrap">{note}</p>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Raw notes fallback if no structured notes */}
          {!hasNotes && intervention.notes && (
            <div className="p-2 bg-[var(--field)] rounded-[10px] mb-2">
              <p className="cn-text-body1 text-[0.6875rem] text-[var(--body)] whitespace-pre-wrap">{intervention.notes}</p>
            </div>
          )}
        </>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Signalements */}
      <div className="flex items-center justify-between mb-1.5">
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
      </div>

      {signalements.length === 0 ? (
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] italic">
          Aucun signalement
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {signalements.map((s, i) => (
            <div className="p-2 border border-[var(--line)] rounded-[10px] flex items-start gap-1.5" key={i}>
              {(() => { const t = SEVERITY_TOKENS[s.severity] || SEVERITY_TOKENS.moyenne; return (
              <>
              <Box component="span" sx={{ display: 'inline-flex', color: t.color, mt: 0.25 }}><Warning size={16} strokeWidth={1.75} /></Box>
              <div className="flex-1 min-w-0">
                <Chip
                  label={s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}
                  size="small"
                  sx={{ ...chipSx(t.bg, t.color), mb: 0.5 }}
                />
                <p className="cn-text-body1 text-[0.6875rem] text-[var(--body)]">{s.description}</p>
              </div>
              </>
              ); })()}
            </div>
          ))}
        </div>
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
    </div>
  );
};

export default PanelInterventionRecap;
