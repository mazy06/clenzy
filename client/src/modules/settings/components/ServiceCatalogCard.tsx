import React from 'react';
import { Box, Tooltip, Typography, Link } from '@mui/material';
import { OpenInNew as ExternalLinkIcon, Info as InfoIcon } from '../../../icons';
import type { CatalogService } from '../../../services/integrations/servicesCatalog';

/**
 * Card unifiee pour le catalogue de services (Insurance, Cleaning, Smart
 * Locks, Activities, etc.). Meme format visuel que les autres sections
 * d'integration (KYC, Compliance, Channel Manager).
 *
 * <h2>Tooltip riche au survol</h2>
 * <p>Au hover, un tooltip MUI affiche une description longue + URL site
 * + modalites d'acces. Le tooltip est theme-aware (light/dark via
 * theme.palette references). Une vraie tooltip — pas un popper customise —
 * pour garder le comportement natif (focus keyboard, escape pour fermer).</p>
 *
 * <h2>Click</h2>
 * <p>Click sur la card declenche {@code onClick(service)} — le parent gere
 * l'ouverture du modal d'info (qui repeat le contenu du tooltip + bouton
 * "Visiter le site").</p>
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

interface ServiceCatalogCardProps {
  service: CatalogService;
  onClick: (service: CatalogService) => void;
}

export default function ServiceCatalogCard({ service, onClick }: ServiceCatalogCardProps) {
  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={100}
      // Tooltip riche : description + modalites + lien. Le styling
      // (background, border, color) vient du theme global (MuiTooltip
      // override dans darkTheme.ts) — on n'override PAS ici pour rester
      // strictement aligne avec le reste des tooltips du PMS.
      title={
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.5 }}>
            <Typography
              component="span"
              sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit' }}
            >
              {service.name}
            </Typography>
            {service.region && (
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
                {service.region}
              </Box>
            )}
          </Box>

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
            {service.tooltipDescription}
          </Typography>

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
              <strong style={{ fontWeight: 700 }}>Modalités :</strong> {service.accessModality}
            </span>
          </Typography>

          <Link
            href={service.websiteUrl}
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
            {service.websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
            <ExternalLinkIcon size={10} strokeWidth={2} />
          </Link>
        </Box>
      }
      // Seul override : maxWidth pour permettre au contenu riche de respirer.
      // Le background / border / color / fontSize viennent du theme global.
      slotProps={{
        tooltip: { sx: { maxWidth: 320 } },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onClick(service)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onClick(service);
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
          opacity: service.available ? 1 : 0.78,
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
        {/* Logo : tile brand-colored 32x32 avec initiales */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            backgroundColor: service.brandColor,
            color: service.brandTextColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
          aria-hidden="true"
        >
          {getInitials(service.name)}
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
            {service.name}
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
            {service.shortDescription}
          </Typography>
        </Box>

        {/* Chip droit : status / region */}
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            fontSize: '0.56rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: service.available ? ACCENT : NEUTRAL,
            backgroundColor: service.available ? `${ACCENT}14` : `${NEUTRAL}14`,
            border: `1px solid ${service.available ? ACCENT : NEUTRAL}33`,
            borderRadius: '4px',
            px: 0.5,
            py: 0.125,
            lineHeight: 1.4,
          }}
        >
          {service.available ? 'Configurable' : 'Bientôt'}
        </Box>
      </Box>
    </Tooltip>
  );
}

/** Extrait les 2 premieres lettres significatives du nom (skip parentheses). */
function getInitials(name: string): string {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
