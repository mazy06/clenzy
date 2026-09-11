import React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Separator,
  Spinner,
} from '../../components/ui';
import { Add, Check, ChevronRight, ExpandMore } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardPeriod } from './DashboardDateFilter';
import {
  SourceTileOptions,
  TILE_SOURCES,
  TileThumbnail,
  importedWidgetId,
  type TileSource,
} from './importedWidgets';

/**
 * Selecteur de composants du tableau de bord.
 *
 * <p>Deux familles s'y cotoient : les tuiles NATIVES qu'on a retirees et qu'on
 * peut remettre, et les graphiques des Rapports et des statistiques de
 * Portefeuilles qu'on importe un par un.</p>
 *
 * <p><b>Les sources se deplient une par une.</b> Lister les quarante
 * graphiques d'emblee aurait demande de monter les neuf ecrans d'analyse en
 * meme temps — autant de requetes pour un choix qui n'en concernera qu'une.
 * Ouvrir une source, c'est la charger ; le reste dort.</p>
 */

export interface RemovedNativeWidget {
  id: string;
  label: string;
}

interface DashboardWidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: DashboardPeriod;
  /** Tuiles natives ecartees, reproposees en tete. */
  removedNative: RemovedNativeWidget[];
  /** Identifiants deja poses — pour ne pas proposer deux fois la meme tuile. */
  placedIds: string[];
  onAdd: (id: string) => void;
}

const SourceSection: React.FC<{
  source: TileSource;
  period: DashboardPeriod;
  placedIds: Set<string>;
  onAdd: (id: string) => void;
  /** Une seule source dépliée à la fois — l'état vit chez le parent. */
  open: boolean;
  onToggle: () => void;
}> = ({ source, period, placedIds, onAdd, open, onToggle }) => {
  const { t } = useTranslation();
  const label = t(source.labelKey, source.fallback);
  const origin = t(source.originKey, source.originFallback);

  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-2.5 text-start outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
      >
        <ExpandMore
          size={15}
          strokeWidth={1.75}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{origin}</span>
        </span>
      </button>

      {open && (
        <SourceTileOptions source={source} period={period}>
          {(options, loading) => {
            if (loading) {
              return (
                <div className="flex items-center gap-2 px-2 pb-3 text-xs text-muted-foreground">
                  <Spinner className="size-4" />
                  {t('common.loading', 'Chargement…')}
                </div>
              );
            }
            if (options.length === 0) {
              return (
                <p className="m-0 px-2 pb-3 text-xs text-muted-foreground">
                  {t('dashboard.picker.emptySource', 'Aucun graphique sur la période choisie.')}
                </p>
              );
            }
            return (
              <ul className="m-0 list-none pb-2 ps-6 pe-1">
                {options.map((tile) => {
                  const id = importedWidgetId(source.id, tile.key);
                  const placed = placedIds.has(id);
                  return (
                    <li key={tile.key}>
                      <button
                        type="button"
                        disabled={placed}
                        onClick={() => onAdd(id)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-start outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-55 motion-reduce:transition-none"
                      >
                        {/* On choisit sur ce qu'on VOIT : le graphique lui-même,
                            réduit, plutôt qu'un intitulé à interpréter. */}
                        <TileThumbnail tile={tile} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">{tile.title}</span>
                          {tile.hint && (
                            <span className="block truncate text-xs text-muted-foreground">{tile.hint}</span>
                          )}
                        </span>
                        {placed ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Check size={14} strokeWidth={1.75} />
                            {t('dashboard.picker.placed', 'Déjà posé')}
                          </span>
                        ) : (
                          <Add size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </SourceTileOptions>
      )}
    </section>
  );
};

export default function DashboardWidgetPicker({
  open,
  onOpenChange,
  period,
  removedNative,
  placedIds,
  onAdd,
}: DashboardWidgetPickerProps) {
  const { t } = useTranslation();
  const placed = React.useMemo(() => new Set(placedIds), [placedIds]);

  // Une seule source dépliée : dix listes ouvertes demandaient un défilement
  // interminable, et montaient dix écrans d'analyse en même temps.
  const [openSourceId, setOpenSourceId] = React.useState<string | null>(null);

  // Repartir fermé à chaque ouverture : on revient au sélecteur pour AJOUTER
  // quelque chose, pas pour retrouver son dépliage de la fois d'avant.
  React.useEffect(() => {
    if (!open) setOpenSourceId(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ⚠️ `.cn-dialog-content` est une GRILLE, pas une colonne flex. Un enfant
          en `flex-1 min-h-0` n'y a aucun effet : la rangée se dimensionne sur
          son contenu, dépasse la hauteur maximale, et `overflow-hidden` la
          coupe — la liste était tronquée SANS ascenseur.

          On travaille donc AVEC la grille : trois rangées explicites, celle du
          milieu à `minmax(0, 1fr)` pour qu'elle puisse se comprimer et défiler.
          En-tête et pied restent en place (cf. `ExportPreviewDialog`). Le
          bouton de fermeture du primitive est en absolu : il ne compte pas
          comme une quatrième rangée. */}
      <DialogContent className="grid max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dashboard.picker.title', 'Ajouter un composant')}</DialogTitle>
          <DialogDescription>
            {t(
              'dashboard.picker.description',
              'Les graphiques des Rapports et des statistiques de portefeuilles se posent ici, un par un.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 overflow-y-auto px-1">
          {removedNative.length > 0 && (
            <>
              <p className="m-0 px-1 py-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('dashboard.picker.removed', 'Retirés du tableau de bord')}
              </p>
              <ul className="m-0 list-none p-0">
                {removedNative.map((widget) => (
                  <li key={widget.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(widget.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-start outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{widget.label}</span>
                      <ChevronRight size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              <Separator className="my-2" />
            </>
          )}

          <p className="m-0 px-1 py-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('dashboard.picker.fromScreens', 'Depuis les autres écrans')}
          </p>
          {TILE_SOURCES.map((source) => (
            <SourceSection
              key={source.id}
              source={source}
              period={period}
              placedIds={placed}
              onAdd={onAdd}
              open={openSourceId === source.id}
              onToggle={() => setOpenSourceId((current) => (current === source.id ? null : source.id))}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close', 'Fermer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
