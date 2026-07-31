import { useEffect, useRef, useState } from 'react';
import { ButtonBase, Checkbox, Skeleton } from '@mui/material';
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
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-1.5 m-6 p-3 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
        <AlertTriangle size={18} strokeWidth={2} /> {loadError}
      </div>
    );
  }

  if (properties && properties.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-[56px] h-[56px] mx-auto mb-3 flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Home size={26} strokeWidth={1.85} />
        </div>
        <div className="text-[var(--text-lg)] font-[var(--fw-semibold)] mb-0.5">Aucune propriété</div>
        <div className="text-[var(--text-md)] text-[var(--muted)]">Ajoutez des propriétés pour les proposer à la réservation.</div>
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
            <div className="flex items-center gap-1.5 py-2 text-[var(--text-sm)] text-[var(--muted)]">
              <Info size={15} strokeWidth={2} /> Aucune sélection : toutes les propriétés restent affichées.
            </div>
          )}
          <div className="py-0.5">
            {list.map((p) => {
              const checked = selected.has(p.id);
              return (
                <ButtonBase
                  key={p.id}
                  onClick={() => onToggleProperty(p.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
                    px: 0.5, py: 0.75, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'var(--hover)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
                  }}
                >
                  <Checkbox checked={checked} tabIndex={-1} disableRipple size="small" sx={{ p: 0.5, color: 'var(--faint)', '&.Mui-checked': { color: 'var(--accent)' } }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--text-md)] text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                    {p.city && <div className="text-[var(--text-2xs)] text-[var(--faint)]">{p.city}</div>}
                  </div>
                </ButtonBase>
              );
            })}
          </div>
        </SettingCard>
      )}
    </SettingsPage>
  );
}
