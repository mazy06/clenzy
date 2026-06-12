import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowRightIcon } from '../../../icons';
import { OTA_CHANNELS, type OtaChannel } from '../../../services/channels/otaChannels';
import { useChannelConnections } from '../../../hooks/useChannelConnections';
import { useAirbnbConnectionStatus } from '../../../hooks/useAirbnb';
import { CONNECTABLE_CHANNELS, type ChannelId } from '../../../services/api/channelConnectionApi';
import OtaInfoDialog from './OtaInfoDialog';
import ServiceGridCard from './ServiceGridCard';
import {
  COMING_SOON_CHIP_SX,
  DISABLED_CARDS_SX,
  blockInteraction,
} from './disabledIntegration';

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

const ACCENT = 'var(--ok)';

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
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Canaux de réservation (OTAs)
              </Typography>
              {disabled && (
                <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
              )}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              Connectez vos OTAs ici ou depuis l'onglet <strong>Channels</strong> dédié. Les modifications sont synchronisées entre les deux vues.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/channels')}
            endIcon={<ArrowRightIcon size={14} strokeWidth={2} />}
            sx={{
              flexShrink: 0,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.74rem',
              borderRadius: '8px',
              py: 0.5,
              px: 1.25,
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: 'color-mix(in srgb, var(--ok) 40%, transparent)', backgroundColor: 'var(--ok-soft)', color: ACCENT },
            }}
          >
            Voir dans Channels
          </Button>
        </Box>

        <Box
          aria-disabled={disabled || undefined}
          onClickCapture={disabled ? blockInteraction : undefined}
          onKeyDownCapture={disabled ? blockInteraction : undefined}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 1.5,
            mt: 1,
            ...(disabled && DISABLED_CARDS_SX),
          }}
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
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '8px',
                      backgroundColor: ota.logo ? 'transparent' : ota.brandColor,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {ota.logo ? (
                      <Box
                        component="img"
                        src={ota.logo}
                        alt=""
                        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--on-accent)', letterSpacing: '-0.02em' }}>
                        {ota.name.slice(0, 2).toUpperCase()}
                      </Typography>
                    )}
                  </Box>
                }
              />
            );
          })}
        </Box>
      </Paper>

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
