/**
 * OTA Sync Badges
 *
 * Affiche les OTAs sur lesquels une propriete est synchronisee, sous forme
 * de mini-logos brand color (Airbnb, Booking, Vrbo, ...) avec un check vert
 * en exposant (badge SVG type "validee") pour les OTAs actifs.
 *
 * Utilise dans :
 *   - ChannexImportDiscoveryDialog (sur chaque ligne de la liste)
 *   - ChannexMappingDialog (vue 'CONNECT_EXISTING' — potentiellement)
 *
 * UX :
 *   - Logo coloré (initiale brand) si l'OTA est actif (OAuth complet)
 *   - Logo grisé si OAuth fait mais Save manquant
 *   - Tooltip au hover : "Airbnb · OAuth actif" / "Booking · OAuth en attente"
 *   - Si aucun OTA : affiche "—" (rien à montrer)
 */
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { Check } from 'lucide-react';

import {
  CHANNEX_OTA_OPTIONS,
  type ChannexPropertyOtaSync,
  type ChannexOtaOption,
  type ChannexOtaCode,
} from '../../../services/api/channexApi';

// Logos officiels des OTAs (small SVG/PNG presents dans assets/logo/)
import airbnbLogo from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../../assets/logo/vrbo-logo-small.svg';
import expediaLogo from '../../../assets/logo/expedia-logo.png';
import agodaLogo from '../../../assets/logo/agoda-logo-small.svg';

/** Map code OTA → asset logo importe (path resolu par Vite au build). */
export const OTA_LOGO_BY_CODE: Record<ChannexOtaCode, string> = {
  ABB: airbnbLogo,
  BDC: bookingLogo,
  VRB: vrboLogo,
  EXP: expediaLogo,
  AGO: agodaLogo,
};

interface OtaSyncBadgesProps {
  otas: ChannexPropertyOtaSync[];
  /** Taille du logo (defaut 24). */
  size?: number;
  /** Si true, affiche le label texte "Aucun OTA" quand la liste est vide. */
  showEmptyLabel?: boolean;
}

/**
 * Resoud l'option visuelle (couleur, initiales) pour un nom OTA Channex.
 * Match case-insensitive sur apiChannelName ou name.
 * Fallback : badge gris avec les 2 premieres lettres du nom.
 */
function resolveOtaOption(otaName: string): ChannexOtaOption | null {
  const lower = otaName.toLowerCase();
  return CHANNEX_OTA_OPTIONS.find(
    (o) => o.apiChannelName.toLowerCase() === lower
      || o.name.toLowerCase() === lower,
  ) ?? null;
}

export default function OtaSyncBadges({ otas, size = 24, showEmptyLabel = false }: OtaSyncBadgesProps) {
  if (!otas || otas.length === 0) {
    return showEmptyLabel
      ? <span className="text-xs text-muted-foreground opacity-60 italic">Aucun OTA</span>
      : null;
  }

  return (
    <div className="flex flex-row items-center gap-1">
      {otas.map((ota) => {
        const option = resolveOtaOption(ota.otaName);
        const logoSrc = option ? OTA_LOGO_BY_CODE[option.code] : null;
        const initials = option?.initials ?? ota.otaName.slice(0, 2);
        const displayName = option?.name ?? ota.otaName;

        // Statut visuel :
        // - actif (OAuth complet) → badge color + check vert exposant
        // - non actif mais OAuth fait → badge color, badge orange (warning)
        // - non authentifie → badge gris semi-opaque
        const opacity = ota.isActive || ota.hasOauthToken ? 1 : 0.4;

        const tooltipLabel = ota.isActive
          ? `${displayName} · Synchronisation active`
          : ota.hasOauthToken
            ? `${displayName} · OAuth fait, mapping a finaliser`
            : `${displayName} · Non authentifie`;

        return (
          <Tooltip key={ota.otaName}>
            {/* `size` et `opacity` sont des valeurs runtime : style inline. */}
            <TooltipTrigger asChild>
              <div className="relative inline-flex shrink-0" style={{ width: size, height: size, opacity }}>
                {/* Logo officiel OTA (SVG/PNG) ou fallback initiales */}
                {logoSrc ? (
                  <img className="w-full h-full rounded-sm object-contain bg-card border border-border p-0.5" src={logoSrc} alt={displayName} />
                ) : (
                  // Fond et encre viennent de la MARQUE de l'OTA (valeurs runtime) :
                  // ils restent en style inline. Le repli d'un OTA inconnu forme un
                  // couple neutre lisible, la ou l'ancien blanc sur teinte faible
                  // plafonnait sous le seuil AA.
                  <div className="w-full h-full rounded-sm flex items-center justify-center font-bold tracking-tight border border-solid border-border" style={{ backgroundColor: option?.brandColor ?? 'var(--bui-muted)', color: option?.brandColorFg ?? 'var(--bui-muted-foreground)', fontSize: size * 0.42 }}>
                    {initials}
                  </div>
                )}

                {/* Pastille de validation en exposant (aplat plein → teinte vive) */}
                {ota.isActive && (
                  <div className="absolute rounded-full bg-success text-white flex items-center justify-center border-2 border-solid border-card" style={{ top: -3, insetInlineEnd: -3, width: size * 0.5, height: size * 0.5 }}>
                    <Check size={size * 0.32} strokeWidth={3} />
                  </div>
                )}

                {/* Pastille d'attente si OAuth fait mais mapping non finalise */}
                {!ota.isActive && ota.hasOauthToken && (
                  <div className="absolute rounded-full bg-warning border-2 border-solid border-card" style={{ top: -3, insetInlineEnd: -3, width: size * 0.4, height: size * 0.4 }} />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>{tooltipLabel}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
