import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  OpenInNew as ExternalLinkIcon,
  ArrowForward as ArrowRightIcon,
  ErrorOutline,
} from '../../../icons';
import ServiceCatalogCard from './ServiceCatalogCard';
import IntegrationConfigDialog from './IntegrationConfigDialog';
import {
  type CatalogService,
  type ServiceCategory,
  getServicesByCategory,
} from '../../../services/integrations/servicesCatalog';
import {
  COMING_SOON_CHIP_SX,
  DISABLED_CARDS_SX,
  blockInteraction,
} from './disabledIntegration';

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
  /**
   * Filtre par ID de service : si non-null, on n'affiche QUE la card du
   * service correspondant (utile depuis l'autocomplete de recherche). null =
   * toutes les cards de la categorie sont visibles (comportement par defaut).
   * Si le service ne fait pas partie de la categorie courante, la section
   * entiere ne rend rien.
   */
  serviceFilter?: string | null;
  /**
   * Si true, grise toutes les cards et bloque clic + clavier. Affiche une
   * chip "Bientot disponible" a cote du titre. Les tooltips d'info au survol
   * restent disponibles.
   */
  disabled?: boolean;
  /**
   * Optionnel : rend un formulaire de configuration propre au service DANS son
   * modal de detail (ex: clé API d'un fournisseur d'activités). Retourner {@code null}
   * pour un service non configurable (le modal garde le comportement par defaut).
   */
  configForService?: (service: CatalogService) => React.ReactNode;
}

export default function ServiceCatalogSection({
  category,
  title,
  description,
  serviceFilter = null,
  disabled = false,
  configForService,
}: ServiceCatalogSectionProps) {
  const allServices = getServicesByCategory(category);
  const services = serviceFilter
    ? allServices.filter((s) => s.id === serviceFilter)
    : allServices;
  const navigate = useNavigate();
  const [openService, setOpenService] = useState<CatalogService | null>(null);
  const configNode = openService && configForService ? configForService(openService) : null;

  const handleAction = (service: CatalogService) => {
    if (service.internalRoute) {
      navigate(service.internalRoute);
      setOpenService(null);
    } else {
      window.open(service.websiteUrl, '_blank', 'noreferrer,noopener');
    }
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {title}
          </Typography>
          {disabled && (
            <Chip label="Bientôt disponible" size="small" sx={COMING_SOON_CHIP_SX} />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          {description}
        </Typography>
        <Box
          aria-disabled={disabled || undefined}
          onClickCapture={disabled ? blockInteraction : undefined}
          onKeyDownCapture={disabled ? blockInteraction : undefined}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 1.5,
            mt: 1,
            ...(disabled && DISABLED_CARDS_SX),
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

              {configNode ? (
                <Box sx={{ mb: 1.5 }}>
                  {configNode}
                  {openService.websiteUrl && (
                    <Button
                      variant="outlined"
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
                        borderColor: 'divider',
                        color: 'text.primary',
                        '&:hover': { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}0F`, color: ACCENT },
                      }}
                    >
                      En savoir plus
                    </Button>
                  )}
                </Box>
              ) : (
              <>
              {!openService.available && !openService.internalRoute && (
                <Alert
                  severity="warning"
                  variant="outlined"
                  sx={{ borderRadius: '8px', fontSize: '0.78rem', mb: 1.5 }}
                >
                  Cette intégration n'est pas encore configurable depuis Baitly. Créez un compte chez le fournisseur — l'intégration native arrivera dans une prochaine release.
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {/* Bouton primaire : Configurer (internal) ou Visiter le site (external) */}
                <Button
                  variant="contained"
                  size="small"
                  endIcon={
                    openService.internalRoute
                      ? <ArrowRightIcon size={14} strokeWidth={2} />
                      : <ExternalLinkIcon size={14} strokeWidth={2} />
                  }
                  onClick={() => handleAction(openService)}
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
                  {openService.internalRoute
                    ? `Configurer ${openService.name}`
                    : `Visiter ${openService.name}`}
                </Button>

                {/* Bouton secondaire : si internal, ajouter aussi le lien vers le site officiel */}
                {openService.internalRoute && openService.websiteUrl && (
                  <Button
                    variant="outlined"
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
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}0F`, color: ACCENT },
                    }}
                  >
                    En savoir plus
                  </Button>
                )}
              </Box>
              </>
              )}
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
