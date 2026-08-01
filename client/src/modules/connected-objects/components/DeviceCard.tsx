import React, { useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import {
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
// Snackbar reste MUI : basculer le mecanisme de notification (sonner) depasse
// la migration des primitives et changerait le comportement de la carte.
import { Snackbar } from '@mui/material';
import { Wifi, WifiOff, ChevronRight, Lock, LockOpen, MoreVert, Delete } from '../../../icons';
import { cn } from '../../../utils/cn';
import { useThemeMode } from '../../../hooks/useThemeMode';
import { useIconSize } from '../../../hooks/useResponsiveSize';
import StatusPill from './StatusPill';
import BatteryIndicator from './BatteryIndicator';
import AccessCodeSection from './AccessCodeSection';
import { DEVICE_KINDS } from '../deviceRegistry';
import { useDeleteDevice } from '../useDeleteDevice';
import { useLockLiveStatus } from '../useLockLiveStatus';
import { useNoiseLiveStatus } from '../useNoiseLiveStatus';
import { useSensorLiveStatus } from '../useSensorLiveStatus';
import { isDeviceDeletable, type ConnectedDevice, type DeviceAction } from '../types';

interface DeviceCardProps {
  device: ConnectedDevice;
  /** Déclenche une action rapide (lock/unlock/view). */
  onAction?: (uid: string, action: DeviceAction) => void;
  /** Action lock/unlock en cours (spinner + désactivation). */
  acting?: boolean;
}

/**
 * Carte d'objet connecté UNIFIÉE — même forme quel que soit le type. L'accent vit
 * dans le badge d'icône (couleur de type) ; l'état dans la pastille (couleur de
 * sens). Action rapide contextualisée par le type (verrouiller/déverrouiller pour
 * une serrure, « Gérer » sinon). Respecte les bans Impeccable : pas de side-stripe,
 * pas de carte-dans-carte.
 */
export default function DeviceCard({ device, onAction, acting = false }: DeviceCardProps) {
  const { isDark } = useThemeMode();
  const iconSize = useIconSize('row');
  const meta = DEVICE_KINDS[device.kind];
  // `meta.color` est une valeur d'execution : le voile derriere l'icone se compose
  // donc en style inline (aucune classe Tailwind ne peut naitre d'une variable).
  const iconVeil = `color-mix(in srgb, ${meta.color} ${isDark ? 20 : 12}%, transparent)`;
  const locked = device.kind === 'lock' && (device.raw as { lockState?: string })?.lockState?.toUpperCase() === 'LOCKED';

  // Suppression auto-portée par la carte : fonctionne partout où elle est rendue
  // (Hub, vue par logement…) sans câblage par l'hôte. Confirmation explicite
  // (geste destructif) ; au succès la carte disparaît au refetch, l'erreur reste
  // affichée en snackbar pour permettre un nouvel essai.
  // Sync ponctuelle du statut réel au montage (online réel via provider), qui
  // rafraîchit le read-model → carte + KPIs cohérents. No-op hors du type concerné.
  useLockLiveStatus(device.id, device.kind === 'lock');
  useNoiseLiveStatus(device.id, device.kind === 'noise');
  // Capteurs d'environnement (Tuya/Netatmo) : 1re lecture auto au montage (init).
  useSensorLiveStatus(
    device.id,
    device.kind === 'climate' || device.kind === 'contact' || device.kind === 'motion' || device.kind === 'smoke',
  );

  const deletable = isDeviceDeletable(device.kind);
  const { remove, removing } = useDeleteDevice();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le menu du kit se ferme de lui-meme a la selection : plus d'ancre a piloter.
  const handleDeleteClick = () => setConfirmOpen(true);
  const handleConfirmDelete = async () => {
    try {
      await remove(device);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression.');
    }
  };

  return (
    <Card className="gap-0 py-0 p-2 border-[var(--line)] flex flex-col gap-1.5 transition-colors duration-200 hover:border-[var(--line-2)]">
      {/* En-tête : badge type + nom (+ pièce) | indicateur en ligne */}
      <div className="flex items-start gap-1.5 min-w-0">
        {device.kind === 'camera' ? (
          // Caméra : aperçu (snapshot) du flux. Repli sur l'icône (placée derrière) si hors
          // ligne, pas de snapshot, ou image en erreur (onError masque l'img → l'icône réapparaît).
          <div className="relative w-[40px] h-[30px] rounded-[8px] shrink-0 overflow-hidden flex items-center justify-center" style={{ color: meta.color, backgroundColor: iconVeil }}>
            {meta.icon(iconSize)}
            {device.online && device.previewUrl && (
              <img className="absolute inset-[0px] w-full h-full object-cover" src={device.previewUrl} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>
        ) : (
          <div className="w-[30px] h-[30px] rounded-[8px] shrink-0 flex items-center justify-center" style={{ color: meta.color, backgroundColor: iconVeil }}>
            {meta.icon(iconSize)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            onClick={() => onAction?.(device.uid, 'view')}
            className="cn-text-body1 text-[0.875rem] font-semibold leading-[1.25] text-[var(--ink)] truncate cursor-pointer hover:text-[var(--accent)]"
          >
            {device.name}
          </p>
          <span className="cn-text-caption text-muted-foreground block overflow-hidden text-ellipsis whitespace-nowrap">
            {device.roomName ? `${device.roomName} · ` : ''}{meta.singular}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex shrink-0 mt-[1.5px]', device.online ? 'text-[#4A9B8E]' : 'text-[var(--faint)]')}>
              {device.online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
            </span>
          </TooltipTrigger>
          <TooltipContent>{device.online ? 'En ligne' : 'Hors ligne'}</TooltipContent>
        </Tooltip>
      </div>

      {/* État + métrique principale */}
      <div className="flex items-center gap-1 flex-wrap">
        <StatusPill level={device.statusLevel} label={device.statusLabel} pulse={device.online} />
        {device.kind === 'lock' ? (
          <BatteryIndicator level={device.battery} />
        ) : (
          <>
            {device.primaryMetric && (
              <span className="cn-text-caption text-muted-foreground tabular-nums">
                {device.primaryMetric.label} : <strong>{device.primaryMetric.value}</strong>
              </span>
            )}
            {device.battery != null && <BatteryIndicator level={device.battery} />}
          </>
        )}
      </div>

      {/* Code d'accès (serrures uniquement) */}
      {device.kind === 'lock' && <AccessCodeSection deviceId={device.id} />}

      {/* Action rapide contextualisée */}
      <div className="flex items-center gap-1 mt-auto pt-0.5">
        {device.kind === 'lock' ? (
          <BuiButton
            size="sm"
            variant="outline"
            disabled={acting || !device.online}
            onClick={() => onAction?.(device.uid, locked ? 'unlock' : 'lock')}
            className="flex-1 justify-start"
          >
            {acting ? <Spinner className="size-[13px]" /> : locked ? <LockOpen strokeWidth={1.75} /> : <Lock strokeWidth={1.75} />}
            {locked ? 'Déverrouiller' : 'Verrouiller'}
          </BuiButton>
        ) : (
          <BuiButton
            size="sm"
            variant="ghost"
            onClick={() => onAction?.(device.uid, 'view')}
            className="flex-1 justify-between text-[var(--muted)]"
          >
            Gérer
            <ChevronRight strokeWidth={1.75} />
          </BuiButton>
        )}

        {/* Menu d'options (⋮) — actions secondaires dont la suppression. */}
        {deletable && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Le declencheur porte lui-meme le gabarit de bouton : passer par
                    `Button` en asChild casserait la ref dont Radix a besoin. */}
                <DropdownMenuTrigger
                  aria-label="Options de l'objet"
                  disabled={removing}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'shrink-0 text-[var(--muted)] cursor-pointer',
                  )}
                >
                  {removing ? <Spinner className="size-4" /> : <MoreVert size={16} strokeWidth={1.75} />}
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem variant="destructive" className="gap-1.5" onSelect={handleDeleteClick}>
                <Delete size={16} strokeWidth={1.75} />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Confirmation de suppression (geste destructif → dialog explicite). */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => { if (!next && !removing) setConfirmOpen(false); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cet objet ?</DialogTitle>
            <DialogDescription>
              «&nbsp;{device.name}&nbsp;» sera retiré de vos objets connectés.
              Le service relié reste connecté — vous pourrez le rajouter ensuite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <BuiButton variant="outline" onClick={() => setConfirmOpen(false)} disabled={removing}>
              Annuler
            </BuiButton>
            <BuiButton
              onClick={() => { void handleConfirmDelete(); }}
              variant="destructive"
              disabled={removing}
            >
              {removing ? <Spinner className="size-3.5" /> : <Delete strokeWidth={1.75} />}
              Supprimer
            </BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {error ? (
          <BuiAlert variant="destructive" className="w-full">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
                <X />
              </BuiButton>
            </AlertAction>
          </BuiAlert>
        ) : undefined}
      </Snackbar>
    </Card>
  );
}
