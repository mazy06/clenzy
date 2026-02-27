import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingIcon,
  ArrowForward as ArrowIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material';
import { subscriptionApi } from '../../services/api/subscriptionApi';

// ─── Couleurs Clenzy (brand) ───────────────────────────────────────────────
const C = {
  primary:      '#6B8A9A',
  primaryLight: '#8BA3B3',
  primaryDark:  '#5A7684',
} as const;

// ─── Forfaits ──────────────────────────────────────────────────────────────

interface ForfaitInfo {
  label: string;
  features: string[];
  highlight: boolean;
}

const FORFAITS: Record<string, ForfaitInfo> = {
  essentiel: {
    label: 'Essentiel',
    features: ['Gestion des proprietes', 'Interventions manuelles', 'Suivi basique'],
    highlight: false,
  },
  confort: {
    label: 'Confort',
    features: ['Planning interactif', 'Import iCal automatique', 'Interventions auto', 'Notifications'],
    highlight: true,
  },
  premium: {
    label: 'Premium',
    features: ['Tout Confort inclus', 'Rapports & analytics', 'Support prioritaire', 'API dediee'],
    highlight: false,
  },
};

// ─── Composant ─────────────────────────────────────────────────────────────

interface UpgradeBannerProps {
  currentForfait?: string;
  onUpgradeComplete?: () => void;
}

const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ currentForfait }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (targetForfait: string) => {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await subscriptionApi.upgrade(targetForfait);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch {
      setError('Impossible de lancer la mise a niveau. Veuillez reessayer.');
      setLoading(false);
    }
  };

  if (!currentForfait || currentForfait.toLowerCase() !== 'essentiel') {
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        borderLeft: `4px solid ${C.primary}`,
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(107,138,154,0.12)',
        p: 2.5,
        mb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* ── Ligne 1 : Description (gauche) + Forfaits (droite) ──────── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2.5,
          alignItems: { md: 'flex-start' },
        }}
      >
        {/* Colonne gauche : icone + texte descriptif */}
        <Box sx={{ display: 'flex', gap: 2, flex: '1 1 0', minWidth: 0 }}>
          {/* Icone cercle */}
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'rgba(107,138,154,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CalendarIcon sx={{ fontSize: 24, color: C.primary }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', lineHeight: 1.3 }}
              >
                Debloquez le Planning & l'import iCal
              </Typography>
              <Chip
                label="Forfait Essentiel"
                size="small"
                variant="outlined"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                  borderWidth: 1.5,
                  borderColor: 'divider',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.813rem', lineHeight: 1.6 }}>
              Votre forfait actuel ne permet pas l'acces au planning interactif ni a l'import
              automatique de vos calendriers Airbnb, Booking et autres plateformes. Passez au
              forfait Confort pour automatiser la gestion de vos reservations.
            </Typography>
          </Box>
        </Box>

        {/* Colonne droite : 3 forfaits cote a cote */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flex: '1 1 0',
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          {Object.entries(FORFAITS).map(([key, { label, features, highlight }]) => {
            const isCurrent = key === currentForfait?.toLowerCase();
            return (
              <Box
                key={key}
                sx={{
                  flex: '1 1 0',
                  minWidth: 0,
                  bgcolor: highlight
                    ? (isDark ? 'rgba(107,138,154,0.12)' : 'rgba(107,138,154,0.05)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                  borderRadius: '8px',
                  p: 1.5,
                  border: highlight
                    ? `1.5px solid ${C.primary}`
                    : '1px solid',
                  borderColor: highlight ? C.primary : 'divider',
                  position: 'relative',
                  transition: 'box-shadow 0.2s ease',
                  ...(highlight && {
                    boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(107,138,154,0.10)',
                  }),
                }}
              >
                {highlight && (
                  <Chip
                    label="Recommande"
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: -10,
                      right: 8,
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      height: 20,
                      borderWidth: 1.5,
                      bgcolor: 'background.paper',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )}
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.813rem',
                    color: highlight ? C.primary : isCurrent ? 'text.secondary' : 'text.primary',
                    mb: 0.75,
                  }}
                >
                  {label}
                  {isCurrent && (
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 400, ml: 0.5 }}
                    >
                      (actuel)
                    </Typography>
                  )}
                </Typography>
                {features.map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <CheckIcon
                      sx={{
                        fontSize: 13,
                        color: highlight ? C.primary : isCurrent ? 'text.disabled' : C.primaryLight,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: isCurrent ? 'text.secondary' : 'text.primary',
                        lineHeight: 1.35,
                        fontSize: '0.7rem',
                        ...(isCurrent && { textDecoration: 'line-through', opacity: 0.6 }),
                      }}
                    >
                      {f}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Ligne 2 : Boutons CTA en dessous ────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          size="medium"
          disabled={loading}
          onClick={() => handleUpgrade('confort')}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CalendarIcon />}
          endIcon={!loading ? <ArrowIcon sx={{ fontSize: 18 }} /> : undefined}
          sx={{
            bgcolor: C.primary,
            color: '#fff',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '6px',
            px: 2.5,
            py: 0.75,
            fontSize: '0.813rem',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(107,138,154,0.3)',
            '&:hover': {
              bgcolor: C.primaryDark,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
            '&:disabled': {
              bgcolor: C.primaryLight,
              color: '#fff',
              opacity: 0.6,
            },
          }}
        >
          {loading ? 'Redirection...' : 'Passer au Confort'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          onClick={() => handleUpgrade('premium')}
          startIcon={<TrendingIcon sx={{ fontSize: 16 }} />}
          sx={{
            borderColor: 'divider',
            color: 'text.secondary',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '6px',
            fontSize: '0.75rem',
            py: 0.5,
            '&:hover': {
              borderColor: C.primary,
              color: C.primary,
              bgcolor: 'rgba(107,138,154,0.04)',
            },
          }}
        >
          Passer au Premium
        </Button>

        {/* Error message */}
        {error && (
          <Typography variant="caption" sx={{ color: 'error.main', ml: 1 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default UpgradeBanner;
