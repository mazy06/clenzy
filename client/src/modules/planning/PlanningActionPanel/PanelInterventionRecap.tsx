import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Info } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Alert,
  AlertDescription,
  Separator,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../../components/ui';
import {
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

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

/** Report en classes de `OVERLINE_SX`. */
const OVERLINE_CLASS = 'text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

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
      <Alert variant="info" className="text-[0.75rem]">
        <Info />
        <AlertDescription>Aucune donnée d'intervention disponible</AlertDescription>
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
            <StatusChip pill tokens={{ color: t.color, bg: t.bg }} label={intervention.status} />
          );
        })()}
        {intervention.estimatedDurationHours && (
          <StatusChip pill tokens={{ color: 'var(--info)', bg: 'var(--info-soft)' }} label={`${intervention.estimatedDurationHours}h estimées`} icon={<Schedule size={12} strokeWidth={1.75} />} />
        )}
        {intervention.estimatedDurationHours && (
          <StatusChip pill tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label={`${(intervention.estimatedDurationHours * 25).toFixed(0)} EUR`} icon={<AttachMoney size={12} strokeWidth={1.75} />} />
        )}
      </div>

      {/* Photos avant */}
      <PanelPhotoGallery photos={beforePhotos} label="Photos avant" />

      <Separator className="my-[9px]" />

      {/* Photos après */}
      <PanelPhotoGallery photos={afterPhotos} label="Photos après" />

      <Separator className="my-[9px]" />

      {/* Notes per step */}
      {/* mb: 1 = 6 px (theme.spacing vaut 6). */}
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1 mb-[6px]')}>
        Notes
      </p>

      {!hasNotes && !intervention.notes ? (
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] italic mb-2">
          Aucune note enregistrée
        </p>
      ) : (
        <>
          <Accordion
            type="multiple"
            defaultValue={['inspection', 'rooms', 'after_photos']}
            className="gap-[4.5px]"
          >
            {['inspection', 'rooms', 'after_photos'].map((step) => {
              const note = stepNotes[step];
              if (!note) return null;
              const labels: Record<string, string> = {
                inspection: 'Inspection',
                rooms: 'Pièces',
                after_photos: 'Photos après',
              };
              return (
                <AccordionItem
                  key={step}
                  value={step}
                  className="border border-solid border-[var(--line)] rounded-[9px] bg-[var(--card)]"
                >
                  <AccordionTrigger className="min-h-8 items-center px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <span className="inline-flex text-[var(--brand-ink)]"><Notes size={14} strokeWidth={1.75} /></span>
                      <p className="cn-text-body1 text-[0.6875rem] font-semibold">{labels[step]}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pt-0 pb-[6px]">
                    <p className="cn-text-body1 text-[0.6875rem] whitespace-pre-wrap">{note}</p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Raw notes fallback if no structured notes */}
          {!hasNotes && intervention.notes && (
            <div className="p-2 bg-[var(--field)] rounded-[10px] mb-2">
              <p className="cn-text-body1 text-[0.6875rem] text-[var(--body)] whitespace-pre-wrap">{intervention.notes}</p>
            </div>
          )}
        </>
      )}

      <Separator className="my-[9px]" />

      {/* Signalements */}
      <div className="flex items-center justify-between mb-1.5">
        <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
          Signalements ({signalements.length})
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="text-[0.625rem]"
        >
          <Add size={14} strokeWidth={1.75} />
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
              <span className="inline-flex mt-[1.5px]" style={{ color: t.color }}><Warning size={16} strokeWidth={1.75} /></span>
              <div className="flex-1 min-w-0">
                <StatusChip pill tokens={{ color: t.color, bg: t.bg }} label={s.severity.charAt(0).toUpperCase() + s.severity.slice(1)} className="mb-0.5" />
                <p className="cn-text-body1 text-[0.6875rem] text-[var(--body)]">{s.description}</p>
              </div>
              </>
              ); })()}
            </div>
          ))}
        </div>
      )}

      {/* Add signalement dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(next) => { if (!next) setAddDialogOpen(false); }}>
        {/* maxWidth="xs" MUI = 444 px. */}
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>Ajouter un signalement</DialogTitle>
          </DialogHeader>
          <Field className="mt-1.5 mb-3">
            <FieldLabel htmlFor="signalement-severity">Sévérité</FieldLabel>
            <NativeSelect
              id="signalement-severity"
              className="w-full"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as Signalement['severity'])}
            >
              <NativeSelectOption value="basse">Basse</NativeSelectOption>
              <NativeSelectOption value="moyenne">Moyenne</NativeSelectOption>
              <NativeSelectOption value="haute">Haute</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="signalement-description">Description</FieldLabel>
            <Textarea
              id="signalement-description"
              // field-sizing:content neutralise `rows` : min-h garantit les 3 lignes
              className="min-h-[3lh]"
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)} size="sm">Annuler</Button>
            <Button
              size="sm"
              disabled={!newDescription.trim()}
              onClick={() => {
                // Would append [SIGNALEMENT:severity] description to notes
                setAddDialogOpen(false);
                setNewDescription('');
              }}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PanelInterventionRecap;
