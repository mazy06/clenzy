import React from 'react';
import { Box, Tooltip, Typography, Link } from '@mui/material';
import { OpenInNew as ExternalLinkIcon, Info as InfoIcon } from '../../../icons';
import { SERVICE_TOOLTIPS, type ServiceTooltipData } from '../../../services/integrations/serviceTooltips';

/**
 * Wrapper Tooltip reutilisable pour tous les services d'integration (Signature,
 * Pricing, Accounting, Compliance, KYC, Channel Manager, OTAs, Catalog).
 *
 * <h2>Source unique</h2>
 * <p>Lookup dans {@link SERVICE_TOOLTIPS} via {@code providerId}. Si la cle
 * n'existe pas, on rend les children sans tooltip (no-op gracieux — pas
 * d'erreur, juste pas de tooltip).</p>
 *
 * <h2>Style</h2>
 * <p>Strictement aligne sur PlanningPropertyColumn (pattern rich-tooltip du PMS) :
 * background.paper en light, dark surface en dark mode. Bordure divider,
 * boxShadow theme-aware.</p>
 */

interface ServiceTooltipProps {
  /** Provider ID (cle dans SERVICE_TOOLTIPS). Case-sensitive. */
  providerId: string;
  /** Override optionnel des donnees du tooltip (pour les services dynamiques). */
  data?: ServiceTooltipData & { name?: string };
  /** Nom du service (pour le header du tooltip). Defaut : provider ID. */
  name?: string;
  children: React.ReactElement;
}

export default function ServiceTooltip({ providerId, data, name, children }: ServiceTooltipProps) {
  const tooltipData = data ?? SERVICE_TOOLTIPS[providerId];
  // Pas de tooltip si pas de donnees — rendu transparent
  if (!tooltipData) return children;

  const displayName = name ?? data?.name ?? providerId;

  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={100}
      title={
        <Box>
          {/* Header : nom + chip region */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.5 }}>
            <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit' }}>
              {displayName}
            </Typography>
            {tooltipData.region && (
              <Box
                component="span"
                sx={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  px: 0.5,
                  py: 0.125,
                  borderRadius: '3px',
                  border: '1px solid currentColor',
                  opacity: 0.7,
                }}
              >
                {tooltipData.region}
              </Box>
            )}
          </Box>

          {/* Description longue */}
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.7rem',
              color: 'inherit',
              opacity: 0.92,
              lineHeight: 1.45,
              mb: 0.75,
            }}
          >
            {tooltipData.description}
          </Typography>

          {/* Modalites d'acces */}
          <Typography
            component="span"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.5,
              fontSize: '0.68rem',
              color: 'inherit',
              opacity: 0.85,
              lineHeight: 1.4,
              mb: 0.5,
            }}
          >
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, opacity: 0.7 }} />
            <span>
              <strong style={{ fontWeight: 700 }}>Modalités :</strong> {tooltipData.accessModality}
            </span>
          </Typography>

          {/* Lien officiel */}
          <Link
            href={tooltipData.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            sx={{
              fontSize: '0.68rem',
              color: 'inherit',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: '2px',
              opacity: 0.92,
              '&:hover': { opacity: 1 },
            }}
          >
            {tooltipData.websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
            <ExternalLinkIcon size={10} strokeWidth={2} />
          </Link>
        </Box>
      }
      // Pattern PlanningPropertyColumn : background.paper + text.primary
      // -> blanc en mode clair, dark surface en mode sombre.
      slotProps={{
        tooltip: {
          sx: (theme) => ({
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            maxWidth: 320,
            p: 1.5,
            fontSize: '0.75rem',
            boxShadow: 'var(--shadow-pop)',
            '& .MuiTooltip-arrow': {
              color: theme.palette.background.paper,
              '&::before': {
                border: '1px solid',
                borderColor: theme.palette.divider,
                backgroundColor: theme.palette.background.paper,
              },
            },
          }),
        },
      }}
    >
      {children}
    </Tooltip>
  );
}
