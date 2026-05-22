import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowRightIcon } from '../../../icons';
import { OTA_CHANNELS } from '../../../services/channels/otaChannels';

/**
 * Vitrine visuelle des OTAs (canaux de reservation) dans l'onglet Integrations.
 *
 * <h2>Intent UX</h2>
 * <ul>
 *   <li>Permettre a l'utilisateur de voir tous les canaux dispo en restant
 *       dans Integrations (sans switcher de tab juste pour verifier la liste).</li>
 *   <li>Ne PAS dupliquer le flow de connexion : la gestion reste dans la tab
 *       <code>Channels</code> dediee. Click sur une card -> navigation vers
 *       <code>/channels</code>.</li>
 *   <li>Distinguer visuellement des Channel Managers middleware (section
 *       precedente) — ici on liste les OTAs eux-memes.</li>
 * </ul>
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

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
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 1,
          mt: 1.5,
        }}
      >
        {OTA_CHANNELS.map((ota) => (
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
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.625,
              minHeight: 84,
              outline: 'none',
              opacity: ota.available ? 1 : 0.65,
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
            {/* Logo : tile brand-colored 32x32 avec image OU initiales en fallback */}
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
            >
              {ota.logo ? (
                <Box
                  component="img"
                  src={ota.logo}
                  alt={ota.name}
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

            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.primary',
                lineHeight: 1.15,
                textAlign: 'center',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ota.name}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
              <Box
                component="span"
                sx={{
                  fontSize: '0.56rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: ota.segment === 'B2C' ? ACCENT : '#7BA3C2',
                  backgroundColor: ota.segment === 'B2C' ? `${ACCENT}14` : '#7BA3C214',
                  border: `1px solid ${ota.segment === 'B2C' ? ACCENT : '#7BA3C2'}33`,
                  borderRadius: '3px',
                  px: 0.375,
                  py: 0,
                  lineHeight: 1.4,
                }}
              >
                {ota.segment}
              </Box>
              {!ota.available && (
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.56rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: NEUTRAL,
                    backgroundColor: `${NEUTRAL}14`,
                    border: `1px solid ${NEUTRAL}33`,
                    borderRadius: '3px',
                    px: 0.375,
                    py: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Bientôt
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
