import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, Checkbox, Skeleton } from '../../../../components/ui';
import EmptyState from '../../../../components/EmptyState';
import { AlertTriangle, Home, Info } from 'lucide-react';
import { propertiesApi, type Property } from '../../../../services/api/propertiesApi';
import type { StudioConfigState } from '../useStudioConfig';
import { SettingsPage, SettingCard, SettingRow, SaveBar, ToggleControl } from './settingsControls';

/**
 * « Propriétés affichées » (section Contenu) — curation des biens présentés par ce booking engine.
 * Persiste config.featuredPropertyIds (CSV). Réellement consommé : PublicBookingService.getProperties
 * restreint la liste publique à la sélection (vide = toutes). Curation d'affichage, pas de contrôle d'accès.
 */

function parseCsv(csv: string | null | undefined): Set<number> {
  const set = new Set<number>();
  (csv ?? '').split(',').forEach((t) => {
    const n = Number(t.trim());
    if (t.trim() && Number.isFinite(n)) set.add(n);
  });
  return set;
}

export interface PropertySelectionPanelProps {
  cfg: StudioConfigState;
}

export default function PropertySelectionPanel({ cfg }: PropertySelectionPanelProps) {
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Gate d'hydratation one-shot (jamais lu au render) : ref, pas de re-render.
  const hydratedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    propertiesApi.getAll()
      .then((list) => { if (alive) setProperties(list); })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Chargement des propriétés impossible'); });
    return () => { alive = false; };
  }, []);

  // Hydratation unique depuis la config.
  useEffect(() => {
    if (hydratedRef.current || cfg.loading || !cfg.config) return;
    const raw = cfg.config.featuredPropertyIds;
    const ids = parseCsv(raw);
    setShowAll(!raw || ids.size === 0);
    setSelected(ids);
    hydratedRef.current = true;
  }, [cfg.loading, cfg.config]);

  const syncToConfig = (nextShowAll: boolean, nextSelected: Set<number>) => {
    cfg.patch({ featuredPropertyIds: nextShowAll ? null : Array.from(nextSelected).join(',') });
  };

  const onToggleShowAll = (on: boolean) => {
    setShowAll(on);
    syncToConfig(on, selected);
  };

  const onToggleProperty = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    syncToConfig(false, next);
  };

  if (!properties && !loadError) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-6">
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle />
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (properties && properties.length === 0) {
    return (
      <div className="px-6 py-12">
        <EmptyState
          icon={<Home />}
          title="Aucune propriété"
          description="Ajoutez des propriétés pour les proposer à la réservation."
        />
      </div>
    );
  }

  const list = properties ?? [];

  return (
    <SettingsPage
      title="Propriétés affichées"
      description="Choisissez les biens proposés par ce booking engine."
      footer={<SaveBar dirty={cfg.dirty} saving={cfg.saving} onSave={() => { cfg.save().catch(() => {}); }} error={cfg.error} />}
    >
      <SettingCard title="Sélection">
        <SettingRow
          label="Afficher toutes les propriétés"
          helper="Désactivez pour choisir manuellement les biens à présenter."
          control={<ToggleControl checked={showAll} onChange={onToggleShowAll} />}
        />
      </SettingCard>

      {!showAll && (
        <SettingCard title={`Propriétés (${selected.size} sélectionnée${selected.size > 1 ? 's' : ''})`} description="Cochez les biens à afficher.">
          {selected.size === 0 && (
            <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
              <Info size={15} strokeWidth={2} className="shrink-0 text-info" /> Aucune sélection : toutes les propriétés restent affichées.
            </div>
          )}
          <div className="py-0.5">
            {list.map((p) => {
              const checked = selected.has(p.id);
              return (
                // La rangee entiere reste le controle (comme le ButtonBase
                // d'origine) ; la case n'est que le temoin visuel, sortie du
                // parcours clavier et des evenements pour ne pas doubler le clic.
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => onToggleProperty(p.id)}
                  className="flex items-center gap-1.5 w-full text-start px-1 py-[4.5px] rounded-md cursor-pointer bg-transparent border-0 appearance-none font-[inherit] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none shrink-0 data-[state=unchecked]:text-faint"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                    {p.city && <div className="text-2xs text-faint">{p.city}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </SettingCard>
      )}
    </SettingsPage>
  );
}
