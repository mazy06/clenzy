import React, { useMemo } from 'react';
import { NativeSelect } from '../../../components/ui';
import { Search as SearchIcon, Close as CloseIcon } from '../../../icons';
import { Badge, Button } from '../../../components/ui';
import {
  useScreenCommands,
  type CommandDescriptor,
} from '../../../components/command-center';
import {
  ALL_SERVICES,
  CATEGORIES,
  getDomIdForCategory,
  type ServiceIndexEntry,
} from '../../../services/integrations/allServicesIndex';

/**
 * Header compact de la tab Intégrations, destiné au slot {@code filters} du
 * PageHeader des Paramètres.
 *
 * <h2>Où est passée la recherche de service ?</h2>
 * <p>Dans le centre de commande. Les 71 services sont publiés comme commandes
 * d'écran ({@code useScreenCommands}) : ⌘K puis « stripe », « airbnb »… mène au
 * même filtre qu'avant. Ce header ne dessinait pas un filtre de plus mais un
 * SECOND champ de recherche, collé au champ unique du bandeau de titre — deux
 * loupes voisines pour deux moteurs différents.</p>
 *
 * <p>Reste ici ce qui n'est pas de la recherche : le filtre par catégorie
 * (liste fermée de 20 entrées, un déroulant la montre mieux qu'une palette) et
 * la pastille du service filtré, qui rend l'état visible et annulable.</p>
 */

/** Valeur sentinelle du select : « pas de filtre categorie ». */
const ALL_CATEGORIES = '_all';

interface IntegrationsHeaderProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  /** Service actuellement filtré, ou {@code null}. Mode contrôlé : le parent possède l'état. */
  selectedService?: ServiceIndexEntry | null;
  /**
   * Callback déclenché avec un service (sélection) ou {@code null} (reset du
   * filtre depuis la pastille).
   */
  onSelectService?: (service: ServiceIndexEntry | null) => void;
}

export default function IntegrationsHeader({
  selectedCategoryId,
  onCategoryChange,
  selectedService = null,
  onSelectService,
}: IntegrationsHeaderProps) {
  // Repli quand le parent ne pilote pas la sélection : on se contente de
  // rejoindre la section du service (comportement historique).
  const selectService = React.useCallback(
    (service: ServiceIndexEntry | null) => {
      if (onSelectService) {
        onSelectService(service);
        return;
      }
      if (!service) return;
      const domId = getDomIdForCategory(service.categoryId);
      if (domId) document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [onSelectService],
  );

  const commands = useMemo<CommandDescriptor[]>(() => {
    const items: CommandDescriptor[] = ALL_SERVICES.map((service) => ({
      id: `integrations.service.${service.id}`,
      section: 'screen',
      label: service.name,
      // La catégorie sert de contexte affiché ET de terme de recherche : on
      // trouve « Airbnb » aussi bien en tapant « OTA ».
      hint: service.categoryLabel,
      keywords: `${service.categoryLabel} intégration integration connecteur`,
      icon: <SearchIcon />,
      run: () => selectService(service),
    }));
    if (selectedService) {
      items.unshift({
        id: 'integrations.service.reset',
        section: 'screen',
        label: 'Afficher toutes les intégrations',
        keywords: 'reset filtre tout effacer',
        icon: <CloseIcon />,
        run: () => selectService(null),
      });
    }
    return items;
  }, [selectService, selectedService]);

  useScreenCommands('Intégrations', commands);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedService && (
        <Badge variant="secondary" className="gap-1 ps-2 pe-1">
          <span className="truncate">{selectedService.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Retirer le filtre ${selectedService.name}`}
            onClick={() => selectService(null)}
          >
            <CloseIcon size={12} strokeWidth={2} />
          </Button>
        </Badge>
      )}

      <NativeSelect
        size="sm"
        className="w-[160px] min-[600px]:w-[180px]"
        aria-label="Filtrer par catégorie"
        value={selectedCategoryId ?? ALL_CATEGORIES}
        onChange={(e) => {
          const v = e.target.value;
          onCategoryChange(v === ALL_CATEGORIES ? null : v);
        }}
      >
        <option value={ALL_CATEGORIES}>Toutes les catégories</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
