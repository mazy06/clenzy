import React, { useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowRightIcon, CheckCircle as CheckCircleIcon } from '../../../icons';
import { OTA_CHANNELS, type OtaChannel } from '../../../services/channels/otaChannels';
import { useChannelConnections } from '../../../hooks/useChannelConnections';
import { useAirbnbConnectionStatus } from '../../../hooks/useAirbnb';
import { CONNECTABLE_CHANNELS, type ChannelId } from '../../../services/api/channelConnectionApi';
import OtaInfoDialog from './OtaInfoDialog';

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

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';
const SEGMENT_B2B = '#7BA3C2';

export default function OtaShowcaseSection() {
  const navigate = useNavigate();
  const { isConnected, getStatus } = useChannelConnections();
  const { data: airbnbStatus } = useAirbnbConnectionStatus();

  // State : quel OTA a son modal ouvert (un seul dialog unifie pour tous les cas)
  const [openOta, setOpenOta] = useState<OtaChannel | null>(null);

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
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
              Canaux de réservation (OTAs)
            </Typography>
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
              '&:hover': { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}0F`, color: ACCENT },
            }}
          >
            Voir dans Channels
          </Button>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
          }}
        >
          {OTA_CHANNELS.map((ota) => {
            const segmentColor = ota.segment === 'B2C' ? ACCENT : SEGMENT_B2B;
            const connected = isOtaConnected(ota);

            return (
              <Box
                key={ota.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenOta(ota)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setOpenOta(ota);
                  }
                }}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  p: 1,
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: connected ? `${ACCENT}55` : 'divider',
                  backgroundColor: connected ? `${ACCENT}05` : 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  minHeight: 56,
                  opacity: ota.available ? 1 : 0.7,
                  outline: 'none',
                  transition:
                    'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': {
                    borderColor: `${ACCENT}66`,
                    backgroundColor: connected ? `${ACCENT}10` : `${ACCENT}06`,
                    boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                  },
                  '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
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
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                      {ota.name.slice(0, 2).toUpperCase()}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ota.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.67rem',
                      color: 'text.secondary',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {!ota.available
                      ? `Bientôt disponible · ${ota.segment}`
                      : connected
                        ? `Connecté · ${ota.segment}`
                        : `Disponible · ${ota.segment}`}
                  </Typography>
                </Box>

                {/* Chip droit : "Connecté" ou segment B2C/B2B ou "Bientôt" */}
                <Box
                  component="span"
                  sx={{
                    flexShrink: 0,
                    fontSize: '0.56rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: connected ? ACCENT : ota.available ? segmentColor : NEUTRAL,
                    backgroundColor: connected ? `${ACCENT}14` : ota.available ? `${segmentColor}14` : `${NEUTRAL}14`,
                    border: `1px solid ${connected ? ACCENT : ota.available ? segmentColor : NEUTRAL}33`,
                    borderRadius: '4px',
                    px: 0.5,
                    py: 0.125,
                    lineHeight: 1.4,
                    alignSelf: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {connected && <CheckCircleIcon size={10} strokeWidth={2.5} />}
                  {connected ? 'Connecté' : ota.available ? ota.segment : 'Bientôt'}
                </Box>
              </Box>
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
