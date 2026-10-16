import { parseSignalements, parseStepNotes, parseBaitlyPhotoUrls, type BaitlySignalement as Signalement } from '../utils/baitlyInterventionParsers';
import { getBaitlyServiceCost } from '../utils/baitlyFinancial';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Info } from '../../../icons/glyphs';
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
import { Money } from '../../../components/Money';

// ─── Signalement parsing ────────────────────────────────────────────────────

/** Sévérité → tons sémantiques partagés (haute = err, moyenne = warn, basse = info). */
const SEVERITY_TOKENS: Record<string, ToneTokens> = {
  haute: STATUS_TONES.err,
  moyenne: STATUS_TONES.warn,
  basse: STATUS_TONES.info,
};

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */

const OVERLINE_CLASS = 'text-xs font-medium uppercase tracking-[0.05em] text-[var(--bui-muted-foreground)]';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PanelInterventionRecapProps {
  event: PlanningEvent;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PanelInterventionRecap: React.FC<PanelInterventionRecapProps> = ({ event }) => {
  const { t } = useTranslation();
  const intervention = event.intervention;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSeverity, setNewSeverity] = useState<Signalement['severity']>('moyenne');
  const [newDescription, setNewDescription] = useState('');

  if (!intervention) {
    return (
      <Alert variant="info" className="text-[0.75rem]">
        <Info />
        <AlertDescription>{t('planning.panel.intervention.noData')}</AlertDescription>
      </Alert>
    );
  }

  const beforePhotos = parseBaitlyPhotoUrls(intervention.beforePhotosUrls);

  const afterPhotos = parseBaitlyPhotoUrls(intervention.afterPhotosUrls);

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
          <StatusChip pill tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label={<Money value={getBaitlyServiceCost(intervention)} from="EUR" decimals={0} />} icon={<AttachMoney size={12} strokeWidth={1.75} />} />
        )}
      </div>

      {/* Photos avant */}
      <PanelPhotoGallery photos={beforePhotos} label={t('planning.panel.intervention.photosBefore', 'Photos avant')} />

      <Separator className="my-[9px]" />

      {/* Photos après */}
      <PanelPhotoGallery photos={afterPhotos} label={t('planning.panel.intervention.photosAfter', 'Photos après')} />

      <Separator className="my-[9px]" />

      {/* Notes per step */}
      {/* mb: 1 = 6 px (theme.spacing vaut 6). */}
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1 mb-[6px]')}>
        {t('planning.panel.recap.notes', 'Notes')}
      </p>

      {!hasNotes && !intervention.notes ? (
        <p className="cn-text-body1 text-xs text-[var(--muted)] italic mb-2">
          {t('planning.panel.recap.noNotes', 'Aucune note enregistrée')}
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
              // Libellés d'étape : lus au rendu, jamais figés à l'import.
              const stepLabel = t(`planning.panel.recap.steps.${step}`);
              return (
                <AccordionItem
                  key={step}
                  value={step}
                  className="border border-solid border-[var(--bui-border)] rounded-[9px] bg-[var(--bui-card)]"
                >
                  <AccordionTrigger className="min-h-8 items-center px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <span className="inline-flex text-[var(--brand-ink)]"><Notes size={14} strokeWidth={1.75} /></span>
                      <p className="cn-text-body1 text-xs font-semibold">{stepLabel}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pt-0 pb-[6px]">
                    <p className="cn-text-body1 text-xs whitespace-pre-wrap">{note}</p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Raw notes fallback if no structured notes */}
          {!hasNotes && intervention.notes && (
            <div className="p-2 bg-[var(--field)] rounded-[10px] mb-2">
              <p className="cn-text-body1 text-xs text-[var(--body)] whitespace-pre-wrap">{intervention.notes}</p>
            </div>
          )}
        </>
      )}

      <Separator className="my-[9px]" />

      {/* Signalements */}
      <div className="flex items-center justify-between mb-1.5">
        <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
          {t('planning.panel.recap.reports', { count: signalements.length })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="text-xs"
        >
          <Add size={14} strokeWidth={1.75} />
          {t('planning.panel.recap.add', 'Ajouter')}
        </Button>
      </div>

      {signalements.length === 0 ? (
        <p className="cn-text-body1 text-xs text-[var(--muted)] italic">
          {t('planning.panel.recap.noReports', 'Aucun signalement')}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {signalements.map((s, i) => (
            <div className="p-2 border border-[var(--bui-border)] rounded-[10px] flex items-start gap-1.5" key={i}>
              {(() => { const tone = SEVERITY_TOKENS[s.severity] || SEVERITY_TOKENS.moyenne; return (
              <>
              <span className="inline-flex mt-[1.5px]" style={{ color: tone.color }}><Warning size={16} strokeWidth={1.75} /></span>
              <div className="flex-1 min-w-0">
                <StatusChip pill tokens={{ color: tone.color, bg: tone.bg }} label={t(`planning.panel.recap.severities.${s.severity}`)} className="mb-0.5" />
                <p className="cn-text-body1 text-xs text-[var(--body)]">{s.description}</p>
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
            <DialogTitle>{t('planning.panel.recap.addTitle', 'Ajouter un signalement')}</DialogTitle>
          </DialogHeader>
          <Field className="mt-1.5 mb-3">
            <FieldLabel htmlFor="signalement-severity">{t('planning.panel.recap.severity', 'Sévérité')}</FieldLabel>
            <NativeSelect
              id="signalement-severity"
              className="w-full"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as Signalement['severity'])}
            >
              <NativeSelectOption value="basse">{t('planning.panel.recap.severities.basse')}</NativeSelectOption>
              <NativeSelectOption value="moyenne">{t('planning.panel.recap.severities.moyenne')}</NativeSelectOption>
              <NativeSelectOption value="haute">{t('planning.panel.recap.severities.haute')}</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="signalement-description">{t('planning.panel.recap.description', 'Description')}</FieldLabel>
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
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)} size="sm">{t('planning.panel.recap.cancel', 'Annuler')}</Button>
            <Button
              size="sm"
              disabled={!newDescription.trim()}
              onClick={() => {
                // Would append [SIGNALEMENT:severity] description to notes
                setAddDialogOpen(false);
                setNewDescription('');
              }}
            >
              {t('planning.panel.recap.add', 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PanelInterventionRecap;
