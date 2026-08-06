/**
 * ChannexHealthBadge — Quick Win #4.
 *
 * <p>Petit indicateur visuel discret affiche sur les cards / lignes de propriete
 * pour signaler l'etat de sync Channex en un coup d'oeil, sans necessiter
 * d'ouvrir la page Integrations.</p>
 *
 * <p>States :</p>
 * <ul>
 *   <li>ACTIVE   : point vert  · "Sync OK · last sync 14:32"</li>
 *   <li>PENDING  : point orange · "Connexion en cours · push declenche au 1er OTA actif"</li>
 *   <li>ERROR    : point rouge  · last error message en tooltip</li>
 *   <li>DISABLED : point gris   · "Sync mise en pause"</li>
 *   <li>null     : pas de badge (property non connectee)</li>
 * </ul>
 *
 * <p>Le badge est cliquable (curseur pointer) si {@code onClick} est fourni.</p>
 */
import React from 'react';
import { Cable, AlertCircle, Pause, Clock, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';

import { cn } from '../../../utils/cn';

import type { ChannexSyncStatus, ChannexMappingDto } from '../../../services/api/channexApi';

interface ChannexHealthBadgeProps {
  mapping: ChannexMappingDto | null;
  /** Taille du badge en px (icone + dot). Default 12 (compact). */
  size?: number;
  /** Style 'dot' = petit point seul. 'icon' = icone + dot superpose. */
  variant?: 'dot' | 'icon';
  /** Si fourni, le badge devient cliquable (typiquement : ouvre les settings Channex). */
  onClick?: () => void;
}

interface StatusMeta {
  color: string;
  label: string;
  Icon: typeof CheckCircle2;
}

/**
 * Teintes VIVES et non `-ink` : ici la couleur peint une pastille et une icone,
 * jamais du texte (cf. contrat Baitly UI §2.4).
 */
const STATUS_META: Record<ChannexSyncStatus, StatusMeta> = {
  ACTIVE: { color: 'var(--bui-success)', label: 'Sync Channex active', Icon: CheckCircle2 },
  PENDING: { color: 'var(--bui-warning)', label: 'Connexion Channex en cours', Icon: Clock },
  ERROR: { color: 'var(--bui-destructive)', label: 'Erreur de sync Channex', Icon: AlertCircle },
  DISABLED: { color: 'var(--bui-muted-foreground)', label: 'Sync Channex mise en pause', Icon: Pause },
};

function formatLastSync(iso: string | null): string {
  if (!iso) return 'pas encore synchronisee';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  } catch {
    return iso;
  }
}

export default function ChannexHealthBadge({
  mapping,
  size = 12,
  variant = 'dot',
  onClick,
}: ChannexHealthBadgeProps) {
  if (!mapping) return null;

  const meta = STATUS_META[mapping.syncStatus];
  const lastSyncStr = formatLastSync(mapping.lastSyncAt);

  const tooltipContent = (
    <div className="max-w-[260px]">
      <p className="text-xs font-semibold leading-[1.3] mb-0.5">
        {meta.label}
      </p>
      <span className="text-xs block leading-[1.45] opacity-85">
        Derniere sync : {lastSyncStr}
      </span>
      {mapping.lastSyncError && mapping.syncStatus === 'ERROR' && (
        // Filet dans une infobulle : la couleur du texte courant a 20 %, seule
        // teinte qui reste lisible sur le fond inverse du tooltip.
        <span className="text-xs block mt-[3px] pt-[3px] border-t border-solid border-current/20 opacity-90 italic">
          {mapping.lastSyncError.slice(0, 200)}
          {mapping.lastSyncError.length > 200 && '…'}
        </span>
      )}
      {onClick && (
        <span className="text-2xs block mt-0.5 opacity-70">
          Cliquer pour ouvrir les details
        </span>
      )}
    </div>
  );

  // Couleur du statut (runtime) : reste en `style` — une classe Tailwind ne peut
  // pas naitre d'une variable. `outlineColor` est inerte tant que le focus-visible
  // n'a pas pose la largeur d'outline.
  const badgeStyle: React.CSSProperties = { color: meta.color, outlineColor: meta.color };
  const badgeClass = cn(
    'inline-flex items-center gap-[3px] p-0 border-none bg-transparent leading-[0]',
    // Pas de `scale()` au survol (interdit : decalage de mise en page) — la
    // reponse au survol passe par l'opacite.
    onClick
      ? 'cursor-pointer transition-opacity duration-150 ease-out-quart motion-reduce:transition-none hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-full'
      : 'cursor-default',
  );

  // Le clignotement d'erreur passe par `animate-pulse` (2s, meme cadence que
  // l'ancien keyframe local), neutralise si l'utilisateur refuse le mouvement.
  const pulseClass = mapping.syncStatus === 'ERROR' ? 'animate-pulse motion-reduce:animate-none' : '';

  const badgeContent = (
    <>
      {variant === 'icon' ? (
          <span className="relative rounded-full inline-flex items-center justify-center" style={{ width: size + 8, height: size + 8, backgroundColor: `color-mix(in srgb, ${meta.color} 10%, transparent)` }}>
            <Cable size={size} strokeWidth={2.2} />
            {/* Dot exposant en bas a la fin de ligne (logique : RTL) */}
            <span
              className={cn('absolute -bottom-px -end-px rounded-full border-[1.5px] border-solid border-card', pulseClass)}
              style={{ width: size * 0.5, height: size * 0.5, backgroundColor: meta.color }}
            />
          </span>
        ) : (
          <span
            className={cn('inline-block shrink-0 rounded-full', pulseClass)}
            style={{
              width: size,
              height: size,
              backgroundColor: meta.color,
              boxShadow: `0 0 0 2px color-mix(in srgb, ${meta.color} 15%, transparent)`,
            }}
          />
        )}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            className={badgeClass}
            style={badgeStyle}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClick(); }}
            aria-label={meta.label}
          >
            {badgeContent}
          </button>
        ) : (
          <span className={badgeClass} style={badgeStyle} aria-label={meta.label}>
            {badgeContent}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
