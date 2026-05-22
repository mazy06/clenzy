import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Ban as BanIcon } from '../../../icons';
import ProviderLogo, { type ProviderId } from './ProviderLogos';
import type { SignatureProvider } from '../../../services/api/integrationsApi';

/**
 * Grille de cards selectionnables pour le choix du fournisseur de signature.
 * Remplace l'ancien RadioGroup horizontal.
 *
 * Comportement :
 *   - Une seule card selectionnee a la fois (radio-like).
 *   - Card cliquable -> appelle onChange avec la nouvelle valeur.
 *   - Card "DocuSign" desactivee (OAuth pas encore cable) -> non cliquable.
 *   - Card "Aucun" -> envoie null.
 *
 * Accessibilite :
 *   - role="radiogroup" sur le container, role="radio" sur chaque card.
 *   - aria-checked refletant la selection.
 *   - Focus visible au clavier (tabindex 0).
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

interface ProviderCardSpec {
  id: ProviderId | 'NONE';
  value: SignatureProvider;
  label: string;
  description: string;
  badge?: string;
  qtspFr?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

const PROVIDERS: ProviderCardSpec[] = [
  {
    id: 'YOUSIGN',
    value: 'YOUSIGN',
    label: 'Yousign',
    description: 'QTSP français · API key',
    badge: 'SES + AES + QES',
    qtspFr: true,
  },
  {
    id: 'UNIVERSIGN',
    value: 'UNIVERSIGN',
    label: 'Universign',
    description: 'QTSP français · API key',
    badge: 'SES + AES + QES',
    qtspFr: true,
  },
  {
    id: 'DOCAPOSTE',
    value: 'DOCAPOSTE',
    label: 'DocaPoste',
    description: 'QTSP français · API key + LRE',
    badge: 'SES + AES + QES',
    qtspFr: true,
  },
  {
    id: 'DOCUSIGN',
    value: 'DOCUSIGN',
    label: 'DocuSign',
    description: 'Leader mondial · OAuth2',
    badge: 'SES + AES + QES',
  },
  {
    id: 'PENNYLANE',
    value: 'PENNYLANE',
    label: 'Pennylane',
    description: 'Comptabilité + signature · OAuth2',
    badge: 'SES',
  },
  {
    id: 'ODOO',
    value: 'ODOO',
    label: 'Odoo',
    description: 'ERP open source · API key',
    badge: 'Module Sign',
  },
];

interface SignatureProviderCardsProps {
  value: SignatureProvider;
  onChange: (next: SignatureProvider) => void;
  disabled?: boolean;
}

export default function SignatureProviderCards({
  value,
  onChange,
  disabled = false,
}: SignatureProviderCardsProps) {
  return (
    <Box
      role="radiogroup"
      aria-label="Fournisseur de signature electronique"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 1.25,
        mt: 1,
      }}
    >
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          spec={p}
          selected={value === p.value}
          onSelect={() => onChange(p.value)}
          disabled={disabled || p.disabled}
        />
      ))}
      <NoneCard
        selected={value === null}
        onSelect={() => onChange(null)}
        disabled={disabled}
      />
    </Box>
  );
}

// ─── ProviderCard ──────────────────────────────────────────────────────────

interface ProviderCardInnerProps {
  spec: ProviderCardSpec;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ProviderCard({ spec, selected, onSelect, disabled }: ProviderCardInnerProps) {
  const handleClick = () => {
    if (disabled) return;
    onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    }
  };

  const card = (
    <Box
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        p: 1.5,
        borderRadius: '12px',
        border: '1px solid',
        borderColor: selected ? ACCENT : 'divider',
        backgroundColor: selected ? `${ACCENT}08` : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        minHeight: 110,
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
        transition:
          'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': disabled
          ? {}
          : {
              borderColor: selected ? ACCENT : `${ACCENT}66`,
              backgroundColor: selected ? `${ACCENT}12` : `${ACCENT}06`,
              boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
            },
        '&:focus-visible': {
          borderColor: ACCENT,
          boxShadow: `0 0 0 3px ${ACCENT}33`,
        },
      }}
    >
      {/* Indicateur de selection en haut a droite */}
      {selected && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'inline-flex',
            color: ACCENT,
          }}
        >
          <CheckCircleIcon size={16} strokeWidth={2.5} />
        </Box>
      )}

      {/* Header : logo + label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <ProviderLogo provider={spec.id as ProviderId} size={40} muted={disabled} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'text.primary',
                lineHeight: 1.2,
              }}
            >
              {spec.label}
            </Typography>
            {spec.qtspFr && (
              <Tooltip
                title="Qualified Trust Service Provider certifie ANSSI (France)"
                arrow
                placement="top"
              >
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: ACCENT,
                    backgroundColor: `${ACCENT}14`,
                    border: `1px solid ${ACCENT}33`,
                    borderRadius: '4px',
                    px: 0.5,
                    py: 0.125,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'help',
                  }}
                >
                  QTSP
                  <span aria-hidden="true" style={{ fontSize: '0.75em' }}>🇫🇷</span>
                </Box>
              </Tooltip>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.secondary',
              lineHeight: 1.3,
              mt: 0.125,
            }}
          >
            {spec.description}
          </Typography>
        </Box>
      </Box>

      {/* Badge en bas */}
      {spec.badge && (
        <Box sx={{ mt: 'auto', pt: 0.5 }}>
          <Chip
            label={spec.badge}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              borderRadius: '5px',
              backgroundColor: disabled ? `${NEUTRAL}14` : `${ACCENT}10`,
              color: disabled ? NEUTRAL : ACCENT,
              border: `1px solid ${disabled ? NEUTRAL : ACCENT}26`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
      )}
    </Box>
  );

  if (disabled && spec.disabledHint) {
    return (
      <Tooltip title={spec.disabledHint} arrow placement="top">
        <Box>{card}</Box>
      </Tooltip>
    );
  }
  return card;
}

// ─── NoneCard (style different — pas un provider) ──────────────────────────

interface NoneCardProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function NoneCard({ selected, onSelect, disabled }: NoneCardProps) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      aria-label="Aucun fournisseur"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        p: 1.5,
        borderRadius: '12px',
        border: '1px dashed',
        borderColor: selected ? NEUTRAL : 'divider',
        backgroundColor: selected ? `${NEUTRAL}08` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 110,
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
        transition:
          'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': disabled
          ? {}
          : {
              borderColor: NEUTRAL,
              backgroundColor: `${NEUTRAL}06`,
            },
        '&:focus-visible': {
          borderColor: NEUTRAL,
          boxShadow: `0 0 0 3px ${NEUTRAL}33`,
        },
      }}
    >
      {/* Icone barre */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          border: '1.5px dashed',
          borderColor: `${NEUTRAL}66`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: NEUTRAL,
          flexShrink: 0,
        }}
      >
        <BanIcon size={18} strokeWidth={2} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: selected ? 'text.primary' : 'text.secondary',
            lineHeight: 1.2,
          }}
        >
          Aucun fournisseur
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            lineHeight: 1.3,
            mt: 0.125,
          }}
        >
          Pas de signature électronique pour le moment
        </Typography>
      </Box>
      {selected && (
        <Box sx={{ display: 'inline-flex', color: NEUTRAL }}>
          <CheckCircleIcon size={16} strokeWidth={2.5} />
        </Box>
      )}
    </Box>
  );
}
