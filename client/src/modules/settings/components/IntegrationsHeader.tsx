import React, { useMemo } from 'react';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  InputGroupAddon,
  NativeSelect,
} from '../../../components/ui';
import { Search as SearchIcon } from '../../../icons';
import {
  ALL_SERVICES,
  CATEGORIES,
  getDomIdForCategory,
  type ServiceIndexEntry,
} from '../../../services/integrations/allServicesIndex';

/**
 * Header compact (recherche + filtre categorie) destine au slot {@code filters}
 * du PageHeader de la page Parametres. Aucune surface propre : juste 2 champs
 * inline qui s'integrent visuellement dans le bandeau de titre.
 *
 * <h2>Tailles</h2>
 * <ul>
 *   <li>Combobox : largeur 200-260px responsive</li>
 *   <li>Select natif : largeur 160-180px</li>
 *   <li>Gap 6px entre les 2</li>
 * </ul>
 */

/** Valeur sentinelle du select : « pas de filtre categorie ». */
const ALL_CATEGORIES = '_all';

interface IntegrationsHeaderProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  /**
   * Service actuellement filtre (affiche dans l'input de la combobox).
   * {@code null} = aucun filtre service actif → l'input affiche son
   * placeholder. Mode controle complet : le parent possede l'etat.
   */
  selectedService?: ServiceIndexEntry | null;
  /**
   * Callback declenche soit avec un service (selection dans la liste), soit
   * avec {@code null} quand l'utilisateur vide le champ pour reset le filtre.
   */
  onSelectService?: (service: ServiceIndexEntry | null) => void;
}

export default function IntegrationsHeader({
  selectedCategoryId,
  onCategoryChange,
  selectedService = null,
  onSelectService,
}: IntegrationsHeaderProps) {
  // Les services sont regroupes par categorie : c'est le pendant du `groupBy`
  // de l'ancien Autocomplete. La combobox reconnait un groupe a sa cle `items`.
  const groupedServices = useMemo(() => {
    const groups: { label: string; items: ServiceIndexEntry[] }[] = [];
    const byLabel = new Map<string, ServiceIndexEntry[]>();
    for (const service of ALL_SERVICES) {
      let bucket = byLabel.get(service.categoryLabel);
      if (!bucket) {
        bucket = [];
        byLabel.set(service.categoryLabel, bucket);
        groups.push({ label: service.categoryLabel, items: bucket });
      }
      bucket.push(service);
    }
    return groups;
  }, []);

  // Mode controle : la valeur de la combobox vient du parent
  // ({@code selectedService}). Quand un service est filtre, son nom apparait
  // dans l'input — l'utilisateur voit ce qu'il a recherche au lieu d'un
  // placeholder vide. Champ vide → onValueChange(null) → le parent reset.
  const handleSelectService = (service: ServiceIndexEntry | null) => {
    if (onSelectService) {
      onSelectService(service);
    } else if (service) {
      const domId = getDomIdForCategory(service.categoryId);
      if (domId) {
        document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Combobox<ServiceIndexEntry>
        items={groupedServices}
        value={selectedService}
        itemToStringLabel={(option) => option.name}
        isItemEqualToValue={(option, other) => option.id === other.id}
        onValueChange={(next) => handleSelectService(next)}
      >
        <ComboboxInput
          placeholder="Rechercher…"
          aria-label="Rechercher un service"
          showClear
          className="w-[200px] min-[600px]:w-[240px] min-[900px]:w-[260px] text-[0.78rem]"
        >
          <InputGroupAddon align="inline-start">
            <span className="inline-flex text-muted-foreground">
              <SearchIcon size={14} strokeWidth={2} />
            </span>
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent className="max-h-[340px] text-[0.78rem]">
          <ComboboxEmpty>Aucun service trouvé</ComboboxEmpty>
          <ComboboxList>
            {(group: { label: string; items: ServiceIndexEntry[] }) => (
              <ComboboxGroup key={group.label} items={group.items}>
                <ComboboxLabel className="text-[0.6rem] font-bold tracking-[0.06em] uppercase">
                  {group.label}
                </ComboboxLabel>
                <ComboboxCollection>
                  {(service: ServiceIndexEntry) => (
                    <ComboboxItem key={service.id} value={service} className="text-[0.78rem] font-medium">
                      {service.name}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

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
