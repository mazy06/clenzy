import React, { useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowRightIcon } from '../../../icons';
import { OTA_CHANNELS, type OtaChannel } from '../../../services/channels/otaChannels';
import { useChannelConnections } from '../../../hooks/useChannelConnections';
import { useAirbnbConnectionStatus } from '../../../hooks/useAirbnb';
import { CONNECTABLE_CHANNELS, type ChannelId } from '../../../services/api/channelConnectionApi';
import OtaInfoDialog from './OtaInfoDialog';
import ServiceGridCard from './ServiceGridCard';
import { blockInteraction } from './disabledIntegration';

/**
 * Vitrine visuelle des OTAs dans l'onglet Integrations.
 *
 * <h2>Modal unifie</h2>
 * <p>Click sur n'importe quelle card -> ouvre {@link OtaInfoDialog} qui gere
 * les 4 cas (coming-soon, connecte, Airbnb OAuth, form-based). Visuellement
 * strictement identique aux autres modales de l'ecran Integrations.</p>
 *
 * <p>Les cards conservent le format uniforme : grille 3 cols, layout
 * horizontal logo+texte+chip, minHeight 56px.</p>
 */

// Transcription du COMING_SOON_CHIP_SX de disabledIntegration.ts, encore
// utilise par les puces MUI restantes ailleurs — d'ou la copie plutot que
// l'ajout d'un export cote constantes.
const COMING_SOON_TOKENS = {
  color: 'var(--muted)',
  bg: 'color-mix(in srgb, var(--muted) 8%, transparent)',
};
const COMING_SOON_BORDER = 'color-mix(in srgb, var(--muted) 20%, transparent)';

// Transcription du DISABLED_CARDS_SX (meme copie que ServiceCatalogSection) :
// on ne touche pas au .ts, qui reste la source des sections encore en MUI.
// `pointer-events: none` est volontairement absent — il tuerait le survol,
// donc les tooltips d'info. theme.palette.divider -> var(--line).
const DISABLED_GRID_CLASS =
  'opacity-[0.55] grayscale-[0.7] select-none '
  + '[&_[role=radio]]:cursor-not-allowed [&_[role=button]]:cursor-not-allowed '
  + '[&_[role=radio]:hover]:border-[var(--line)]! [&_[role=button]:hover]:border-[var(--line)]! '
  + '[&_[role=radio]:hover]:bg-transparent! [&_[role=button]:hover]:bg-transparent! '
  + '[&_[role=radio]:hover]:shadow-none! [&_[role=button]:hover]:shadow-none! '
  + '[&_[role=radio]:focus-visible]:shadow-none! [&_[role=button]:focus-visible]:shadow-none!';

interface OtaShowcaseSectionProps {
  /**
   * Filtre par ID d'OTA : si non-null, on n'affiche QUE la card de l'OTA
   * correspondant (utile depuis l'autocomplete de recherche). null = toutes
   * les cards visibles (comportement par defaut).
   */
  serviceFilter?: string | null;
  /**
   * Si true, grise toutes les cards OTA et bloque clic + clavier. Affiche une
   * chip "Bientot disponible" a cote du titre. Les tooltips d'info au survol
   * restent disponibles.
   */
  disabled?: boolean;
}

export default function OtaShowcaseSection({ serviceFilter = null, disabled = false }: OtaShowcaseSectionProps = {}) {
  const navigate = useNavigate();
  const { isConnected, getStatus } = useChannelConnections();
  const { data: airbnbStatus } = useAirbnbConnectionStatus();

  // State : quel OTA a son modal ouvert (un seul dialog unifie pour tous les cas)
  const [openOta, setOpenOta] = useState<OtaChannel | null>(null);

  const visibleChannels = serviceFilter
    ? OTA_CHANNELS.filter((ota) => ota.id === serviceFilter)
    : OTA_CHANNELS;

  const isOtaConnected = (ota: OtaChannel): boolean => {
    if (ota.id === 'airbnb') return !!airbnbStatus?.connected;
    if (CONNECTABLE_CHANNELS.includes(ota.id as ChannelId)) {
      return isConnected(ota.id as ChannelId);
    }
    return false;
  };

  return (
    <>
      <Card className="gap-0 py-0 border-border mt-4 mb-3 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="cn-text-body1 text-[0.82rem] font-semibold">
                Canaux de réservation (OTAs)
              </p>
              {disabled && (
                <StatusChip
                  size="sm"
                  tokens={COMING_SOON_TOKENS}
                  label="Bientôt disponible"
                  className="rounded-[5px] border border-solid text-[0.62rem] tracking-[0.01em]"
                  sx={{ borderColor: COMING_SOON_BORDER }}
                />
              )}
            </div>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground">
              Connectez vos OTAs ici ou depuis l'onglet <strong>Channels</strong> dédié. Les modifications sont synchronisées entre les deux vues.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/channels')}
            className="shrink-0"
          >
            Voir dans Channels
            <ArrowRightIcon size={14} strokeWidth={2} />
          </Button>
        </div>

        <div
          aria-disabled={disabled || undefined}
          onClickCapture={disabled ? blockInteraction : undefined}
          onKeyDownCapture={disabled ? blockInteraction : undefined}
          // gap: 1.5 et mt: 1 = 9 px et 6 px (spacing MUI du projet = 6 px).
          className={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[9px] mt-1.5',
            disabled && DISABLED_GRID_CLASS,
          )}
        >
          {visibleChannels.map((ota) => {
            const connected = isOtaConnected(ota);
            return (
              <ServiceGridCard
                key={ota.id}
                serviceTooltipId={ota.id}
                label={ota.name}
                description={`Canal de réservation · ${ota.segment}`}
                role="button"
                status={connected ? 'connected' : ota.available ? 'idle' : 'comingSoon'}
                onClick={() => setOpenOta(ota)}
                logo={
                  <div className="w-[40px] h-[40px] rounded-[8px] inline-flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: ota.logo ? 'transparent' : ota.brandColor }} aria-hidden="true">
                    {ota.logo ? (
                      <img className="max-w-full max-h-[100%] object-contain" src={ota.logo} alt="" />
                    ) : (
                      <p className="cn-text-body1 text-[0.85rem] font-bold text-[var(--on-accent)] tracking-[-0.02em]">
                        {ota.name.slice(0, 2).toUpperCase()}
                      </p>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      </Card>

      {/* Modal unifie — gere les 4 cas (coming-soon, connecte, Airbnb OAuth,
          form-based). Strictement le meme format visuel que les autres
          modales d'integration. */}
      <OtaInfoDialog
        ota={openOta}
        open={openOta !== null}
        onClose={() => setOpenOta(null)}
        channelStatus={
          openOta && CONNECTABLE_CHANNELS.includes(openOta.id as ChannelId)
            ? getStatus(openOta.id as ChannelId) ?? null
            : null
        }
        airbnbStatus={airbnbStatus ?? null}
      />
    </>
  );
}
