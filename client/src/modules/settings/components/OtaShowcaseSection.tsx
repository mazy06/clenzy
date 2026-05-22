import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowRightIcon } from '../../../icons';
import { OTA_CHANNELS } from '../../../services/channels/otaChannels';

/**
 * Vitrine visuelle des OTAs (canaux de reservation) dans l'onglet Integrations.
 *
 * <h2>Layout uniforme avec les autres sections</h2>
 * <p>Utilise strictement le meme format de card que KYC / ChannelManager /
 * Pricing / Compliance : grille 3 cols, layout horizontal logo+texte,
 * minHeight 56px, padding 1, border-radius 10px. Seule difference fonctionnelle :
 * le click navigue vers /channels (pas de modal config) car la gestion
 * des OTAs reste dans la tab Channels dediee.</p>
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';
const SEGMENT_B2B = '#7BA3C2';

export default function OtaShowcaseSection() {
  const navigate = useNavigate();

  return (
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
            Aperçu des plateformes de réservation supportées. La configuration des connexions se fait depuis l'onglet <strong>Channels</strong>.
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
          Gérer dans Channels
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
          return (
            <Box
              key={ota.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate('/channels')}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  navigate('/channels');
                }
              }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                p: 1,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
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
                  backgroundColor: `${ACCENT}06`,
                  boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
                },
                '&:focus-visible': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}33` },
              }}
            >
              {/* Logo : tile 32x32 — image brand OU initiales fallback */}
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
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {ota.name.slice(0, 2).toUpperCase()}
                  </Typography>
                )}
              </Box>

              {/* Bloc texte — meme format que les autres cards d'integration */}
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
                  {ota.available ? 'Disponible' : 'Bientôt disponible'} · {ota.segment}
                </Typography>
              </Box>

              {/* Chip discret a droite : segment B2C/B2B ou "Bientot" */}
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  fontSize: '0.56rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: ota.available ? segmentColor : NEUTRAL,
                  backgroundColor: ota.available ? `${segmentColor}14` : `${NEUTRAL}14`,
                  border: `1px solid ${ota.available ? segmentColor : NEUTRAL}33`,
                  borderRadius: '4px',
                  px: 0.5,
                  py: 0.125,
                  lineHeight: 1.4,
                  alignSelf: 'center',
                }}
              >
                {ota.available ? ota.segment : 'Bientôt'}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
