import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeSelect, NativeSelectOption } from '../../../components/ui';
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
import { VpnKey, ContentCopy, Visibility, VisibilityOff, Refresh, Lock } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { useLockAccessCodeHistory, lockAccessCodesKey } from '../useLockAccessCodeHistory';
import { usePropertyAccessCode } from '../usePropertyAccessCode';
import type { SmartLockAccessCodeHistoryDto } from '../../../services/api/smartLockApi';
import { smartLockApi, type SmartLockAccessCodeMode } from '../../../services/api/smartLockApi';

interface AccessCodeSectionProps {
  deviceId: number;
  /**
   * Logement de l'objet — porte le code STATIQUE (digicode / boîte à clés),
   * distinct du code de séjour poussé sur la serrure.
   *
   * <p>À ne renseigner que là où la section est seule à l'écran (fiche d'une
   * serrure). Omis dans une liste de cartes : le digicode y est rendu une seule
   * fois, au niveau du logement (`PropertyAccessCodeChip`).</p>
   */
  propertyId?: number | null;
}

/**
 * Ce que l'écran dit quand la serrure n'a pas de code en vigueur.
 *
 * <p>« Aucun code actif » servait pour trois situations que rien ne distinguait :
 * pas de séjour en cours (normal), génération en échec (à corriger), code
 * révoqué au départ (trace). Le journal permet enfin de les séparer — et c'est
 * le premier évènement qui tranche, puisqu'un échec de génération n'a aucun code
 * rattaché et n'apparaîtrait dans aucune autre lecture.</p>
 */
function describeAbsence(history: SmartLockAccessCodeHistoryDto | undefined): {
  label: string;
  hint: string;
  warning?: boolean;
} {
  const lastEvent = history?.events?.[0];
  if (lastEvent?.eventType === 'GENERATION_FAILED') {
    return {
      label: 'Dernière génération en échec',
      hint: lastEvent.notes
        ? `${lastEvent.notes} — ${formatUntil(lastEvent.createdAt)}`
        : `Échec le ${formatUntil(lastEvent.createdAt)}. Aucun code n'a été posé sur la serrure.`,
      warning: true,
    };
  }

  const lastCode = history?.past?.[0];
  if (lastCode?.status === 'REVOKED') {
    return {
      label: 'Code révoqué',
      hint: lastCode.revokedAt
        ? `Le code du séjour précédent a été révoqué le ${formatUntil(lastCode.revokedAt)}. Le prochain sera généré à l'arrivée du voyageur.`
        : "Le code du séjour précédent a été révoqué. Le prochain sera généré à l'arrivée du voyageur.",
    };
  }
  if (lastCode?.status === 'EXPIRED') {
    return {
      label: 'Code expiré',
      hint: lastCode.validUntil
        ? `Le code du séjour précédent a expiré le ${formatUntil(lastCode.validUntil)}. Le prochain sera généré à l'arrivée du voyageur.`
        : "Le code du séjour précédent a expiré. Le prochain sera généré à l'arrivée du voyageur.",
    };
  }

  return {
    label: 'Aucun code de séjour',
    hint: "Le prochain sera généré à l'arrivée du voyageur.",
  };
}

/** Date seule (une date de départ n'a pas d'heure dans la réservation). */
function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
  } catch {
    return iso;
  }
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
 * Section « Codes d'accès » d'une carte serrure.
 *
 * <p>Deux codes coexistent sur un logement, et les confondre a déjà fait lire
 * l'écran comme une panne : la notification « Nouveau code d'accès » annonçait
 * un code pendant que la carte affichait « Aucun code actif ». Les deux
 * disaient vrai, sur deux objets différents.</p>
 *
 * <ul>
 *   <li><b>Code de séjour</b> — `smart_lock_access_code`, poussé sur CETTE
 *       serrure, un par réservation, révoqué au départ du voyageur. Entre deux
 *       séjours, son absence est l'état NORMAL : le prochain naîtra à l'arrivée
 *       suivante. C'est ce que dit la ligne, plutôt qu'« aucun code », qui se
 *       lit comme une perte.</li>
 *   <li><b>Digicode / boîte à clés</b> — `check_in_instructions.access_code`,
 *       porté par le LOGEMENT. Régénéré après chaque départ, c'est celui que la
 *       notification demande de reporter à la main sur la boîte. En lecture
 *       seule ici : il se modifie sur la fiche du logement, avec son format et
 *       son renouvellement automatique.</li>
 * </ul>
 *
 * <p><b>Où le second code est rendu.</b> Sur une VUE D'ENSEMBLE, il vit à
 * hauteur du logement (`PropertyAccessCodeChip`, à côté du nom du logement) :
 * une maison à porte, portail et boîte à clés afficherait sinon trois fois la
 * même valeur. Ici, il n'est rendu que quand `propertyId` est fourni — c'est-à-
 * dire sur la FICHE d'une serrure, seule à l'écran, où il n'y a rien à
 * répéter.</p>
 *
 * <p>Rendu inline dans la carte (pas de carte-dans-carte) ; icônes lucide, code
 * en tabular-nums.</p>
 */
export default function AccessCodeSection({ deviceId, propertyId = null }: AccessCodeSectionProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const qc = useQueryClient();
  const { data: history, isLoading } = useLockAccessCodeHistory(deviceId, true);
  const code = history?.current ?? null;
  const { data: instructions } = usePropertyAccessCode(propertyId);
  const [revealed, setRevealed] = useState(false);
  const [staticRevealed, setStaticRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  // Origine du code (PMS pousse / serrure génère) — lue depuis la liste des serrures.
  const { data: lockDevices } = useQuery({ queryKey: ['smart-lock-devices'], queryFn: () => smartLockApi.getAll() });
  const lockDevice = lockDevices?.find((d) => d.id === deviceId);

  const hasCode = !!code?.code;
  const staticCode = instructions?.accessCode?.trim() || null;
  const absence = describeAbsence(history);
  const ongoingStay = history?.ongoingStay ?? null;

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

  const handleCopyStatic = async () => {
    if (!staticCode) return;
    try {
      await navigator.clipboard.writeText(staticCode);
      notify.success('Digicode copié');
    } catch {
      notify.error('Copie impossible');
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
      await qc.invalidateQueries({ queryKey: lockAccessCodesKey(deviceId) });
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
          <TooltipContent>Code de séjour — poussé sur cette serrure</TooltipContent>
        </Tooltip>

        {isLoading ? (
          <span className="text-xs text-muted-foreground opacity-60">Code de séjour…</span>
        ) : hasCode ? (
          <>
            <span className="text-xs text-muted-foreground shrink-0">Séjour</span>
            {/* Code PIN : display (Space Grotesk) tabular-nums sur fond de champ.
                Sa validité se lit au survol — elle qualifie CE code, elle n'a pas
                à occuper une ligne de la carte. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <p className={cn('text-sm tabular-nums font-semibold text-foreground bg-field rounded-md px-1.5 py-[1.5px] leading-[1.4]', revealed ? 'tracking-[0.06em]' : 'tracking-[0.18em]')} style={{ fontFamily: 'var(--font-display)' }}>
                  {revealed ? code!.code : '••••••'}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                {code!.validUntil
                  ? `Valide jusqu'au ${formatUntil(code!.validUntil)}`
                  : 'Code de séjour poussé sur cette serrure'}
              </TooltipContent>
            </Tooltip>
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
                    className="text-muted-foreground"
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
            {/* L'absence de code entre deux séjours est l'état NORMAL. Le dire
                au survol de la mention elle-même : sans explication du tout,
                « Aucun code de séjour » se lit comme une panne — c'est
                exactement la lecture qu'en faisait l'écran face à une
                notification de rotation. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('text-xs', absence.warning ? 'text-warning-ink' : 'text-muted-foreground')}>
                  {absence.label}
                </span>
              </TooltipTrigger>
              <TooltipContent>{absence.hint}</TooltipContent>
            </Tooltip>
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

      {/* Le code du LOGEMENT — celui que la notification de rotation demande de
          reporter sur la boîte. En lecture seule : il se modifie sur la fiche du
          logement, avec son format et son renouvellement automatique. */}
      {staticCode && (
        <>
          <div className="flex items-center gap-0.5 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground opacity-60 inline-flex shrink-0">
                  <Lock size={14} strokeWidth={1.75} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Digicode / boîte à clés — code du logement</TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground shrink-0">Logement</span>
            <p
              className={cn(
                'text-sm tabular-nums font-semibold text-foreground bg-field rounded-md px-1.5 py-[1.5px] leading-[1.4]',
                staticRevealed ? 'tracking-[0.06em]' : 'tracking-[0.18em]',
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {staticRevealed ? staticCode : '••••••'}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={staticRevealed ? 'Masquer le digicode' : 'Afficher le digicode'}
                    onClick={() => setStaticRevealed((v) => !v)}
                  >
                    {staticRevealed ? <VisibilityOff size={14} strokeWidth={1.75} /> : <Visibility size={14} strokeWidth={1.75} />}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{staticRevealed ? 'Masquer' : 'Afficher'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" size="icon-xs" aria-label="Copier le digicode" onClick={() => { void handleCopyStatic(); }}>
                    <ContentCopy size={14} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Copier</TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground opacity-60 ps-3.5 block leading-[1.2]">
            {instructions?.accessCodeAutoRotate
              ? 'Renouvelé après chaque départ — à reporter sur la boîte.'
              : 'Code du logement, commun à tous ses accès.'}
          </span>
        </>
      )}

      {lockDevice ? (
        // Le select porte sa propre intitule : ses deux options nomment deja ce
        // qu'il regle (« Le PMS genere… » / « La serrure genere… »), un libelle
        // au-dessus ne faisait que le repeter. Sans <FieldLabel>, l'accessible
        // name vient donc de `aria-label` — a ne pas retirer : un select nu n'a
        // aucun nom pour un lecteur d'ecran.
        //
        // L id porte le deviceId : plusieurs cartes serrure cohabitent dans la page.
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mt-1.5 block">
              <NativeSelect
                id={`access-code-mode-${deviceId}`}
                aria-label={t('connectedObjects.codeMode.label', "Origine du code d'accès")}
                className="w-full"
                value={lockDevice.accessCodeMode || 'PMS_GENERATED'}
                onChange={(e) => { void handleModeChange(e.target.value as SmartLockAccessCodeMode); }}
                disabled={savingMode}
              >
                <NativeSelectOption value="PMS_GENERATED">{t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}</NativeSelectOption>
                <NativeSelectOption value="LOCK_GENERATED">{t('connectedObjects.codeMode.lock', 'La serrure génère le code')}</NativeSelectOption>
              </NativeSelect>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t('connectedObjects.codeMode.applied', 'Appliqué aux prochains codes générés (réservations à venir).')}
          </TooltipContent>
        </Tooltip>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => { if (!next && !rotating) setConfirmOpen(false); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasCode ? 'Régénérer le code ?' : 'Générer un code ?'}</DialogTitle>
            <DialogDescription>
              {/* Un séjour en cours change la nature du geste : ce n'est plus une
                  rotation de confort, c'est le code d'un voyageur présent qu'on
                  révoque. Il reçoit le nouveau, mais il doit le savoir. */}
              {ongoingStay
                ? `Un voyageur séjourne ici jusqu'au ${formatDay(ongoingStay.checkOut)} : son code actuel cessera de fonctionner et le nouveau code lui sera envoyé.`
                : hasCode
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
