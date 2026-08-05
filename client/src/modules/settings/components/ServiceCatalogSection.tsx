import React, { useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Badge, Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { cn } from '../../../utils/cn';
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
import { blockInteraction } from './disabledIntegration';

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

// Neutralise le survol et le focus des cartes grisees. `pointer-events: none`
// est volontairement absent — il tuerait le survol, donc les tooltips d'info.
const DISABLED_GRID_CLASS =
  'opacity-[0.55] grayscale-[0.7] select-none '
  + '[&_[role=radio]]:cursor-not-allowed [&_[role=button]]:cursor-not-allowed '
  + '[&_[role=radio]:hover]:border-border! [&_[role=button]:hover]:border-border! '
  + '[&_[role=radio]:hover]:bg-transparent! [&_[role=button]:hover]:bg-transparent! '
  + '[&_[role=radio]:hover]:shadow-none! [&_[role=button]:hover]:shadow-none! '
  + '[&_[role=radio]:focus-visible]:shadow-none! [&_[role=button]:focus-visible]:shadow-none!';

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
          <p className="text-sm font-semibold tracking-tight">
            {title}
          </p>
          {disabled && (
            <Badge variant="secondary" className="h-[18px] px-1.5 text-2xs">
              Bientôt disponible
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">
          {description}
        </p>
        <div
          aria-disabled={disabled || undefined}
          onClickCapture={disabled ? blockInteraction : undefined}
          onKeyDownCapture={disabled ? blockInteraction : undefined}
          className={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[9px] mt-1.5',
            disabled && DISABLED_GRID_CLASS,
          )}
        >
          {services.map((service) => (
            <ServiceCatalogCard
              key={service.id}
              service={service}
              onClick={(s) => setOpenService(s)}
            />
          ))}
        </div>
      </Card>

      {/* Modal d'info — meme format visuel que les autres modales d'integration */}
      <IntegrationConfigDialog
        open={openService !== null}
        onClose={() => setOpenService(null)}
      >
        {openService && (
          <Card className="gap-0 py-0 border-border overflow-hidden">
            {/* Header — uniforme avec les autres cards */}
            <div className="px-3 py-2.5 flex items-start gap-2 border-b border-border">
              <div className="size-10 rounded-lg inline-flex items-center justify-center shrink-0 text-sm font-bold tracking-tight" style={{ backgroundColor: openService.brandColor, color: openService.brandTextColor }} aria-hidden="true">
                {getInitials(openService.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-sm font-semibold tracking-tight">{openService.name}</p>
                  {openService.region && (
                    <Badge variant="success" className="h-[18px] px-1.5 text-2xs">{openService.region}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {openService.shortDescription}
                </p>
              </div>
              <div className="shrink-0">
                <Badge variant="secondary">
                  <ErrorOutline size={11} strokeWidth={2} />
                  {openService.available ? 'Configurable' : 'Bientôt'}
                </Badge>
              </div>
            </div>

            {/* Body — description longue + modalites + lien */}
            <div className="p-3">
              <p className="text-sm text-foreground leading-relaxed mb-2">
                {openService.tooltipDescription}
              </p>

              <Alert variant="info" className="text-xs mb-2">
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
                      className="hover:border-success/40 hover:bg-success-soft hover:text-success-ink"
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
                <Alert variant="warning" className="text-xs mb-2">
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
                    className="hover:border-success/40 hover:bg-success-soft hover:text-success-ink"
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
