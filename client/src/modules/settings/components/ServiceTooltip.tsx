import React from 'react';
import { Tooltip, Link } from '@mui/material';
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
        <div>
          {/* Header : nom + chip region */}
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[0.75rem] font-bold text-inherit">
              {displayName}
            </span>
            {tooltipData.region && (
              <span className="text-[0.58rem] font-bold tracking-[0.02em] px-0.5 py-0 rounded-[3px] border border-[currentColor] opacity-70">
                {tooltipData.region}
              </span>
            )}
          </div>

          {/* Description longue */}
          <span className="block text-[0.7rem] text-inherit opacity-92 leading-[1.45] mb-1">
            {tooltipData.description}
          </span>

          {/* Modalites d'acces */}
          <span className="flex items-start gap-0.5 text-[0.68rem] text-inherit opacity-85 leading-[1.4] mb-0.5">
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, opacity: 0.7 }} />
            <span>
              <strong style={{ fontWeight: 700 }}>Modalités :</strong> {tooltipData.accessModality}
            </span>
          </span>

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
        </div>
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
