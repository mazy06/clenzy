import React, { useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Spinner,
  Textarea,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import type { StatusTone } from '../../components/StatusChip';
import { TriangleAlert } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { issuesApi, type IssueSeverity } from '../../services/api/issuesApi';

/** Memes tons que la liste Anomalies — une anomalie se lit pareil des deux cotes. */
const SEVERITY_TONES: Record<IssueSeverity, StatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'warn',
  HIGH: 'warn',
  CRITICAL: 'err',
};

const SEVERITIES: IssueSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface Props {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  /** Rattache l'anomalie a l'intervention pendant laquelle elle a ete vue. */
  sourceInterventionId?: number;
  /** Pieces du logement — l'anomalie se constate DANS une piece. */
  roomNames?: string[];
  /** Piece ou l'intervenant se trouve, presselectionnee. */
  currentRoom?: string | null;
  onReported?: () => void;
}

/**
 * Signalement d'anomalie par l'INTERVENANT, depuis le logement ou il travaille.
 *
 * L'API le prevoit depuis l'origine (`CreateIssueRequest.sourceInterventionId`,
 * POST ouvert a tout utilisateur authentifie) mais l'interface web ne l'exposait
 * nulle part : le seul point de creation vivait dans l'onglet « Anomalies »,
 * lui-meme reserve aux roles gestionnaires. Le terrain voyait les problemes sans
 * pouvoir les remonter.
 *
 * La severite est un choix a QUATRE etats, en pastilles et non en menu deroulant :
 * l'ecran est tactile, et un menu natif coute deux taps de plus.
 */
export default function IssueReportDialog({
  open,
  onClose,
  propertyId,
  sourceInterventionId,
  roomNames = [],
  currentRoom,
  onReported,
}: Props) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM');
  const [room, setRoom] = useState<string>('');

  // La piece courante change quand l'intervenant avance dans le suivi : la
  // pre-selection doit suivre, tant qu'il n'a pas choisi lui-meme.
  const [roomTouched, setRoomTouched] = useState(false);
  React.useEffect(() => {
    if (!roomTouched) setRoom(currentRoom ?? '');
  }, [currentRoom, roomTouched, open]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const severityLabel = (value: IssueSeverity) => t(
    `issues.severity.${value}`,
    { LOW: 'Mineure', MEDIUM: 'Moyenne', HIGH: 'Importante', CRITICAL: 'Critique' }[value],
  );

  const reset = () => {
    setTitle('');
    setDescription('');
    setSeverity('MEDIUM');
    setRoom(currentRoom ?? '');
    setRoomTouched(false);
    setError(null);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await issuesApi.create({
        propertyId,
        sourceInterventionId,
        // La piece prefixe le TITRE : c'est la colonne que le gestionnaire lit
        // dans la file Anomalies, et « Chambre 1 — joint decolle » s'y trie et
        // s'y comprend sans ouvrir le detail.
        title: room ? `${room} — ${title.trim()}` : title.trim(),
        description: description.trim() || undefined,
        severity,
      });
      notify.success(t('issues.create.success', 'Anomalie signalée'));
      reset();
      onReported?.();
      onClose();
    } catch {
      setError(t('issues.create.error', 'Création impossible — vérifiez les champs.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('issues.report.title', 'Signaler une anomalie')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-y border-solid border-border py-3">
          <p className="m-0 text-xs text-muted-foreground">
            {t('issues.report.help',
              "Le signalement part vers l'onglet Anomalies de la conciergerie, qui le qualifie et le convertit si besoin en demande de maintenance.")}
          </p>

          {roomNames.length > 0 && (
            <Field>
              <FieldLabel htmlFor="issue-report-room">
                {t('issues.report.roomField', 'Où ?')}
              </FieldLabel>
              <NativeSelect
                id="issue-report-room"
                className="w-full"
                value={room}
                onChange={(e) => { setRoomTouched(true); setRoom(e.target.value); }}
              >
                <NativeSelectOption value="">
                  {t('issues.report.roomUnset', 'Logement (hors pièce précise)')}
                </NativeSelectOption>
                {roomNames.map((name) => (
                  <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="issue-report-title">
              {t('issues.report.titleField', 'Que se passe-t-il ?')}
            </FieldLabel>
            <Input
              id="issue-report-title"
              value={title}
              autoFocus
              maxLength={140}
              placeholder={t('issues.report.titlePlaceholder', 'Ex. : fuite sous l’évier de la cuisine')}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="issue-report-description">
              {t('issues.report.descriptionField', 'Détails (optionnel)')}
            </FieldLabel>
            <Textarea
              id="issue-report-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>{t('issues.report.severityField', 'Gravité')}</FieldLabel>
            {/* Pastilles cliquables : quatre cibles de 44px, pas un menu natif. */}
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={severity === value}
                  onClick={() => setSeverity(value)}
                  className={cn(
                    'min-h-[44px] rounded-xl border border-solid px-3 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    severity === value
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <StatusChip tone={SEVERITY_TONES[value]} label={severityLabel(value)} size="sm" dot />
                </button>
              ))}
            </div>
          </Field>

          {error && (
            <Alert variant="destructive" className="py-1.5">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} disabled={saving}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving && <Spinner className="size-4" />}
            {t('issues.report.submit', 'Signaler')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
