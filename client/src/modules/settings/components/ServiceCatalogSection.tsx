import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Chip,
} from '@mui/material';
import { OpenInNew as ExternalLinkIcon, ErrorOutline } from '../../../icons';
import ServiceCatalogCard from './ServiceCatalogCard';
import IntegrationConfigDialog from './IntegrationConfigDialog';
import {
  type CatalogService,
  type ServiceCategory,
  getServicesByCategory,
} from '../../../services/integrations/servicesCatalog';

/**
 * Section generique pour le catalogue de services dans l'onglet Integrations.
 *
 * <h2>Pattern unifie</h2>
 * <ul>
 *   <li>Header : titre + description courte</li>
 *   <li>Grille 3 cols de {@link ServiceCatalogCard}</li>
 *   <li>Modal au click : {@link IntegrationConfigDialog} avec details +
 *       bouton "Visiter le site" (meme format visuel que les autres
 *       modales)</li>
 * </ul>
 *
 * <h2>Reutilise pour 9 categories</h2>
 * <p>Messaging, Market Intelligence, Tax, Insurance, Cleaning, Smart Locks,
 * Activities, Reviews, Marketing. Toutes les sections utilisent ce
 * composant avec une categorie differente, donc UI strictement uniforme.</p>
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

interface ServiceCatalogSectionProps {
  category: ServiceCategory;
  title: string;
  description: string;
}

export default function ServiceCatalogSection({
  category,
  title,
  description,
}: ServiceCatalogSectionProps) {
  const services = getServicesByCategory(category);
  const [openService, setOpenService] = useState<CatalogService | null>(null);

  if (services.length === 0) return null;

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
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          {description}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
            mt: 1,
          }}
        >
          {services.map((service) => (
            <ServiceCatalogCard
              key={service.id}
              service={service}
              onClick={(s) => setOpenService(s)}
            />
          ))}
        </Box>
      </Paper>

      {/* Modal d'info — meme format visuel que les autres modales d'integration */}
      <IntegrationConfigDialog
        open={openService !== null}
        onClose={() => setOpenService(null)}
      >
        {openService && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Header — uniforme avec les autres cards */}
            <Box
              sx={{
                px: 2,
                py: 1.75,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  backgroundColor: openService.brandColor,
                  color: openService.brandTextColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
                aria-hidden="true"
              >
                {getInitials(openService.name)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{openService.name}</Typography>
                  {openService.region && (
                    <Chip
                      label={openService.region}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        bgcolor: `${ACCENT}14`,
                        color: ACCENT,
                        border: `1px solid ${ACCENT}33`,
                        '& .MuiChip-label': { px: 0.625 },
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 0.5 }}>
                  {openService.shortDescription}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                <Chip
                  icon={<ErrorOutline size={11} strokeWidth={2} />}
                  label={openService.available ? 'Configurable' : 'Bientôt'}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    borderRadius: '6px',
                    px: 0.25,
                    backgroundColor: `${NEUTRAL}14`,
                    color: NEUTRAL,
                    border: `1px solid ${NEUTRAL}33`,
                    '& .MuiChip-icon': { color: `${NEUTRAL} !important`, ml: '6px', mr: '-2px' },
                    '& .MuiChip-label': { px: 0.875 },
                  }}
                />
              </Box>
            </Box>

            {/* Body — description longue + modalites + lien */}
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.primary', lineHeight: 1.55, mb: 1.5 }}>
                {openService.tooltipDescription}
              </Typography>

              <Alert
                severity="info"
                variant="outlined"
                sx={{ borderRadius: '8px', fontSize: '0.78rem', mb: 1.5 }}
              >
                <strong>Modalités d'accès :</strong> {openService.accessModality}
              </Alert>

              {!openService.available && (
                <Alert
                  severity="warning"
                  variant="outlined"
                  sx={{ borderRadius: '8px', fontSize: '0.78rem', mb: 1.5 }}
                >
                  Cette intégration n'est pas encore configurable depuis Clenzy. Créez un compte chez le fournisseur — l'intégration native arrivera dans une prochaine release.
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  endIcon={<ExternalLinkIcon size={14} strokeWidth={2} />}
                  component="a"
                  href={openService.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    bgcolor: ACCENT,
                    color: '#fff',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
                  }}
                >
                  Visiter {openService.name}
                </Button>
              </Box>
            </Box>
          </Paper>
        )}
      </IntegrationConfigDialog>
    </>
  );
}

function getInitials(name: string): string {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
