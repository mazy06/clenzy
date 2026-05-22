import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '../../../icons';
import ProviderLogo, { type ProviderId } from './ProviderLogos';
import type { SignatureProvider } from '../../../services/api/integrationsApi';

/**
 * Grille de cards (multi-select) pour activer / configurer plusieurs
 * fournisseurs de signature en parallele.
 *
 * <h2>Multi-selection</h2>
 * Plusieurs providers peuvent etre actifs simultanement — chaque connexion
 * est stockee independamment cote backend (table dediee par provider). La
 * card cochee = "ouvrir le panneau de configuration de ce provider en
 * dessous". L'utilisateur peut configurer plusieurs API keys / OAuth flows
 * en parallele sans bascule.
 *
 * <h2>Accessibilite</h2>
 * - role="group" sur le container, role="checkbox" sur chaque card
 * - aria-checked refletant l'appartenance a la selection
 * - Focus visible au clavier (tabindex 0)
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

type SelectableProvider = Exclude<SignatureProvider, null>;

interface ProviderCardSpec {
  id: ProviderId;
  value: SelectableProvider;
  label: string;
  description: string;
  badge?: string;
  qtspFr?: boolean;
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
    description: 'QTSP français · API + LRE',
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
    description: 'Compta + signature · OAuth2',
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
  /** Liste des providers selectionnes (ouverts pour configuration). */
  value: SelectableProvider[];
  onChange: (next: SelectableProvider[]) => void;
  disabled?: boolean;
}

export default function SignatureProviderCards({
  value,
  onChange,
  disabled = false,
}: SignatureProviderCardsProps) {
  const toggle = (provider: SelectableProvider) => {
    if (disabled) return;
    if (value.includes(provider)) {
      onChange(value.filter((p) => p !== provider));
    } else {
      onChange([...value, provider]);
    }
  };

  return (
    <Box
      role="group"
      aria-label="Fournisseurs de signature electronique"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 1,
        mt: 1,
      }}
    >
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          spec={p}
          selected={value.includes(p.value)}
          onToggle={() => toggle(p.value)}
          disabled={disabled}
        />
      ))}
    </Box>
  );
}

// ─── ProviderCard ──────────────────────────────────────────────────────────

interface ProviderCardInnerProps {
  spec: ProviderCardSpec;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ProviderCard({ spec, selected, onToggle, disabled }: ProviderCardInnerProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Box
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        p: 1,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: selected ? ACCENT : 'divider',
        backgroundColor: selected ? `${ACCENT}08` : 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 56,
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
        transition:
          'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': disabled
          ? {}
          : {
              borderColor: selected ? ACCENT : `${ACCENT}66`,
              backgroundColor: selected ? `${ACCENT}12` : `${ACCENT}06`,
              boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 10px rgba(45, 55, 72, 0.05)',
            },
        '&:focus-visible': {
          borderColor: ACCENT,
          boxShadow: `0 0 0 3px ${ACCENT}33`,
        },
      }}
    >
      <ProviderLogo provider={spec.id} size={32} muted={disabled} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                  fontSize: '0.56rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: ACCENT,
                  backgroundColor: `${ACCENT}14`,
                  border: `1px solid ${ACCENT}33`,
                  borderRadius: '3px',
                  px: 0.375,
                  py: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  cursor: 'help',
                  flexShrink: 0,
                }}
              >
                QTSP
                <span aria-hidden="true" style={{ fontSize: '0.85em' }}>🇫🇷</span>
              </Box>
            </Tooltip>
          )}
        </Box>
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
          {spec.description}
        </Typography>
      </Box>
      {/* Checkmark coche en haut a droite */}
      {selected && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'inline-flex',
            color: ACCENT,
          }}
        >
          <CheckCircleIcon size={14} strokeWidth={2.5} />
        </Box>
      )}
    </Box>
  );
}
