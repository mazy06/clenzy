import React, { useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Card } from '../../../components/ui';
import { Box } from '@mui/material';
import { Button } from '../../../components/ui';
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

const ACCENT = 'var(--ok)';
const NEUTRAL = 'var(--muted)';

// Transcription du COMING_SOON_CHIP_SX de disabledIntegration.ts, encore
// utilise par les puces MUI restantes ailleurs — d'ou la copie plutot que
// l'ajout d'un export cote constantes.
const COMING_SOON_TOKENS = {
  color: NEUTRAL,
  bg: `color-mix(in srgb, ${NEUTRAL} 8%, transparent)`,
};
const COMING_SOON_BORDER = `color-mix(in srgb, ${NEUTRAL} 20%, transparent)`;

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
      <Card className="gap-0 py-0 border-border mt-4 mb-3 px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="cn-text-body1 text-[0.82rem] font-semibold">
            {title}
          </p>
          {disabled && (
            <StatusChip
              size="sm"
              tokens={COMING_SOON_TOKENS}
              label="Bientôt disponible"
              className="rounded-[5px] border border-solid text-[0.62rem] tracking-[0.01em]"
              sx={{ borderColor: COMING_SOON_BORDER }}
            />
          )}
        </div>
        <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mb-0.5">
          {description}
        </p>
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
      </Card>

      {/* Modal d'info — meme format visuel que les autres modales d'integration */}
      <IntegrationConfigDialog
        open={openService !== null}
        onClose={() => setOpenService(null)}
      >
        {openService && (
          <Card className="gap-0 py-0 border-border overflow-hidden">
            {/* Header — uniforme avec les autres cards */}
            <div className="px-3 py-2.5 flex items-start gap-2 border-b border-[var(--line)]">
              <div className="w-[40px] h-[40px] rounded-[10px] inline-flex items-center justify-center shrink-0 text-[0.85rem] font-bold tracking-[-0.02em]" style={{ backgroundColor: openService.brandColor, color: openService.brandTextColor }} aria-hidden="true">
                {getInitials(openService.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-0.5 flex-wrap">
                  <p className="cn-text-body1 text-[0.92rem] font-semibold">{openService.name}</p>
                  {openService.region && (
                    <StatusChip size="sm" tokens={{ color: ACCENT, bg: 'var(--ok-soft)' }} label={openService.region} className="text-[0.62rem]" />
                  )}
                </div>
                <p className="cn-text-body1 text-[0.74rem] text-muted-foreground mt-0.5">
                  {openService.shortDescription}
                </p>
              </div>
              <div className="shrink-0">
                <StatusChip tokens={{ color: NEUTRAL, bg: `color-mix(in srgb, ${NEUTRAL} 8%, transparent)` }} label={openService.available ? 'Configurable' : 'Bientôt'} icon={<ErrorOutline size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
              </div>
            </div>

            {/* Body — description longue + modalites + lien */}
            <div className="p-3">
              <p className="cn-text-body1 text-[0.82rem] text-foreground leading-[1.55] mb-2">
                {openService.tooltipDescription}
              </p>

              <Alert variant="info" className="text-[0.78rem] mb-2">
                <Info />
                <AlertDescription><strong>Modalités d'accès :</strong>{openService.accessModality}</AlertDescription>
              </Alert>

              {configNode ? (
                <div className="mb-2">
                  {configNode}
                  {openService.websiteUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="hover:border-[color-mix(in_srgb,var(--ok)_40%,transparent)] hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]"
                    >
                      <a href={openService.websiteUrl} target="_blank" rel="noreferrer noopener">
                        En savoir plus
                        <ExternalLinkIcon size={14} strokeWidth={2} />
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
              <>
              {!openService.available && !openService.internalRoute && (
                <Alert variant="warning" className="text-[0.78rem] mb-2">
                  <TriangleAlert />
                  <AlertDescription>Cette intégration n'est pas encore configurable depuis Baitly. Créez un compte chez le fournisseur — l'intégration native arrivera dans une prochaine release.</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-1.5 flex-wrap">
                {/* Bouton primaire : Configurer (internal) ou Visiter le site (external) */}
                <Button
                  size="sm"
                  onClick={() => handleAction(openService)}
                >
                  {openService.internalRoute
                    ? `Configurer ${openService.name}`
                    : `Visiter ${openService.name}`}
                  {openService.internalRoute
                    ? <ArrowRightIcon size={14} strokeWidth={2} />
                    : <ExternalLinkIcon size={14} strokeWidth={2} />}
                </Button>

                {/* Bouton secondaire : si internal, ajouter aussi le lien vers le site officiel */}
                {openService.internalRoute && openService.websiteUrl && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="hover:border-[color-mix(in_srgb,var(--ok)_40%,transparent)] hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]"
                  >
                    <a href={openService.websiteUrl} target="_blank" rel="noreferrer noopener">
                      En savoir plus
                      <ExternalLinkIcon size={14} strokeWidth={2} />
                    </a>
                  </Button>
                )}
              </div>
              </>
              )}
            </div>
          </Card>
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
