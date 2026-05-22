import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '../../../icons';
import ProviderLogo, { type ProviderId } from './ProviderLogos';
import type { SignatureProvider } from '../../../services/api/integrationsApi';
import ServiceTooltip from './ServiceTooltip';

/**
 * Grille de cards pour selectionner UN provider a visualiser / configurer
 * en bas. La selection ici est de la navigation pure (single-focus) — pas de
 * connexion / deconnexion. Chaque provider conserve sa propre connexion
 * stockee independamment cote backend.
 *
 * <h2>Badge "Configuré"</h2>
 * Chaque card affiche un check vert quand le provider a deja une connexion
 * active (loaded via prop {@code connectedSet}). Permet de savoir d'un
 * coup d'oeil quels providers sont deja parametres sans avoir a ouvrir
 * chaque panneau.
 *
 * <h2>Accessibilite</h2>
 * - role="radiogroup" sur le container, role="radio" sur chaque card
 * - aria-checked = true sur la card focus
 * - Focus visible au clavier
 */

const ACCENT = '#4A9B8E';

type SelectableProvider = Exclude<SignatureProvider, null>;

interface ProviderCardSpec {
  id: ProviderId;
  value: SelectableProvider;
  label: string;
  description: string;
  qtspFr?: boolean;
}

const PROVIDERS: ProviderCardSpec[] = [
  { id: 'YOUSIGN',    value: 'YOUSIGN',    label: 'Yousign',    description: 'QTSP français · API key', qtspFr: true },
  { id: 'UNIVERSIGN', value: 'UNIVERSIGN', label: 'Universign', description: 'QTSP français · API key', qtspFr: true },
  { id: 'DOCAPOSTE',  value: 'DOCAPOSTE',  label: 'DocaPoste',  description: 'QTSP français · API + LRE', qtspFr: true },
  { id: 'DOCUSIGN',   value: 'DOCUSIGN',   label: 'DocuSign',   description: 'Leader mondial · OAuth2' },
  { id: 'PENNYLANE',  value: 'PENNYLANE',  label: 'Pennylane',  description: 'Compta + signature · OAuth2' },
  { id: 'ODOO',       value: 'ODOO',       label: 'Odoo',       description: 'ERP open source · API key' },
];

interface SignatureProviderCardsProps {
  /** Provider actuellement focuse (panneau affiche en bas). null si aucun. */
  value: SelectableProvider | null;
  onChange: (next: SelectableProvider) => void;
  /** Set des providers qui ont deja une connexion active (pour le badge). */
  connectedSet?: Set<SelectableProvider>;
  disabled?: boolean;
}

export default function SignatureProviderCards({
  value,
  onChange,
  connectedSet,
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
          active={value === p.value}
          configured={connectedSet?.has(p.value) ?? false}
          onSelect={() => onChange(p.value)}
          disabled={disabled}
        />
      ))}
    </Box>
  );
}

// ─── ProviderCard ──────────────────────────────────────────────────────────

interface ProviderCardInnerProps {
  spec: ProviderCardSpec;
  active: boolean;
  configured: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ProviderCard({ spec, active, configured, onSelect, disabled }: ProviderCardInnerProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <ServiceTooltip providerId={spec.value} name={spec.label}>
    <Box
      role="radio"
      aria-checked={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        p: 1,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: active ? ACCENT : (configured ? `${ACCENT}55` : 'divider'),
        backgroundColor: active ? `${ACCENT}10` : (configured ? `${ACCENT}05` : 'background.paper'),
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
              borderColor: ACCENT,
              backgroundColor: active ? `${ACCENT}14` : `${ACCENT}08`,
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

      {/* Badge "configure" — petit check vert en haut a droite */}
      {configured && (
        <Tooltip title="Connexion enregistrée" arrow placement="top">
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
        </Tooltip>
      )}
    </Box>
    </ServiceTooltip>
  );
}
