import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, FieldLabel, FieldDescription, NativeSelect, NativeSelectOption } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { VpnKey, ContentCopy, Visibility, VisibilityOff, Refresh } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { useLockAccessCode } from '../useLockAccessCode';
import { smartLockApi, type SmartLockAccessCodeMode } from '../../../services/api/smartLockApi';

interface AccessCodeSectionProps {
  deviceId: number;
}

function formatUntil(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Section « Code d'accès » d'une carte serrure : affiche le code courant (masqué
 * par défaut), copie, validité, et régénération (avec confirmation → déclenche un
 * event côté backend). Rendu inline dans la carte (pas de carte-dans-carte) ;
 * icônes lucide, code en tabular-nums.
 */
export default function AccessCodeSection({ deviceId }: AccessCodeSectionProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const qc = useQueryClient();
  const { data: code, isLoading } = useLockAccessCode(deviceId, true);
  const [revealed, setRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  // Origine du code (PMS pousse / serrure génère) — lue depuis la liste des serrures.
  const { data: lockDevices } = useQuery({ queryKey: ['smart-lock-devices'], queryFn: () => smartLockApi.getAll() });
  const lockDevice = lockDevices?.find((d) => d.id === deviceId);

  const hasCode = !!code?.code;

  const handleModeChange = async (mode: SmartLockAccessCodeMode) => {
    setSavingMode(true);
    try {
      await smartLockApi.updateAccessCodeMode(deviceId, mode);
      await qc.invalidateQueries({ queryKey: ['smart-lock-devices'] });
      notify.success(t('connectedObjects.codeMode.saved', 'Origine du code mise à jour (appliquée à la prochaine réservation)'));
    } catch {
      notify.error(t('connectedObjects.codeMode.error', 'Échec du changement de mode'));
    } finally {
      setSavingMode(false);
    }
  };

  const handleCopy = async () => {
    if (!code?.code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      notify.success('Code copié');
    } catch {
      notify.error('Copie impossible');
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await smartLockApi.rotateAccessCode(deviceId);
      await qc.invalidateQueries({ queryKey: ['lock-access-code', deviceId] });
      setConfirmOpen(false);
      notify.success('Nouveau code généré');
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Échec de la génération');
    } finally {
      setRotating(false);
    }
  };

  return (
    <>
      <Separator className="mt-[1.5px]" />
      <div className="flex items-center gap-0.5 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground opacity-60 inline-flex shrink-0">
              <VpnKey size={14} strokeWidth={1.75} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Code d'accès</TooltipContent>
        </Tooltip>

        {isLoading ? (
          <span className="cn-text-caption text-muted-foreground opacity-60">Code d'accès…</span>
        ) : hasCode ? (
          <>
            {/* Code PIN : display (Space Grotesk) tabular-nums sur fond --field */}
            <p className={cn('cn-text-body1 tabular-nums font-semibold text-[0.875rem] text-[var(--ink)] bg-[var(--field)] rounded-[9px] px-1.5 py-[1.5px] leading-[1.4]', revealed ? 'tracking-[0.06em]' : 'tracking-[0.18em]')} style={{ fontFamily: 'var(--font-display)' }}>
              {revealed ? code!.code : '••••••'}
            </p>
            {/* Le Button du kit est une fonction : il ne transmet pas de ref
                (React 18). L'enveloppe porte l'ancre du Tooltip a sa place. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={revealed ? 'Masquer le code' : 'Afficher le code'}
                    onClick={() => setRevealed((v) => !v)}
                  >
                    {revealed ? <VisibilityOff size={14} strokeWidth={1.75} /> : <Visibility size={14} strokeWidth={1.75} />}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{revealed ? 'Masquer' : 'Afficher'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" size="icon-xs" aria-label="Copier le code" onClick={handleCopy}>
                    <ContentCopy size={14} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Copier</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Un bouton desactive n'emet pas d'evenement de survol : l'enveloppe
                    porte le declencheur a sa place. */}
                <span className="inline-flex ms-auto">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Régénérer le code"
                    onClick={() => setConfirmOpen(true)}
                    disabled={rotating}
                    className="text-[var(--muted)]"
                  >
                    {rotating ? <Spinner className="size-3.5" /> : <Refresh size={14} strokeWidth={1.75} />}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Régénérer le code</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <span className="cn-text-caption text-muted-foreground">Aucun code actif</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={rotating}
              className="ms-auto"
            >
              {rotating ? <Spinner className="size-[13px]" /> : <Refresh size={14} strokeWidth={1.75} />}
              Générer
            </Button>
          </>
        )}
      </div>

      {hasCode && code!.validUntil && (
        <span className="cn-text-caption text-muted-foreground opacity-60 ps-3.5 block leading-[1.2]">
          Valide jusqu'au {formatUntil(code!.validUntil)}
        </span>
      )}

      {lockDevice ? (
        // L id porte le deviceId : plusieurs cartes serrure cohabitent dans la page.
        <Field className="mt-1.5">
          <FieldLabel htmlFor={`access-code-mode-${deviceId}`}>
            {t('connectedObjects.codeMode.label', "Origine du code d'accès")}
          </FieldLabel>
          <NativeSelect
            id={`access-code-mode-${deviceId}`}
            className="w-full"
            value={lockDevice.accessCodeMode || 'PMS_GENERATED'}
            onChange={(e) => { void handleModeChange(e.target.value as SmartLockAccessCodeMode); }}
            disabled={savingMode}
          >
            <NativeSelectOption value="PMS_GENERATED">{t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}</NativeSelectOption>
            <NativeSelectOption value="LOCK_GENERATED">{t('connectedObjects.codeMode.lock', 'La serrure génère le code')}</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>
            {t('connectedObjects.codeMode.applied', 'Appliqué aux prochains codes générés (réservations à venir).')}
          </FieldDescription>
        </Field>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => { if (!next && !rotating) setConfirmOpen(false); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasCode ? 'Régénérer le code ?' : 'Générer un code ?'}</DialogTitle>
            <DialogDescription>
              {hasCode
                ? "L'ancien code sera révoqué sur la serrure et un nouveau code prendra effet. Un évènement est enregistré."
                : 'Un nouveau code d\'accès sera programmé sur la serrure. Un évènement est enregistré.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={rotating}>Annuler</Button>
            <Button
              variant="default"
              onClick={() => { void handleRotate(); }}
              disabled={rotating}
            >
              {rotating ? <Spinner className="size-3.5" /> : null}
              {hasCode ? 'Régénérer' : 'Générer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
