import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Skeleton } from '../../components/ui';
import { Add, Check, ChevronRight } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardPeriod } from './DashboardDateFilter';
import { SourceTileOptions, TILE_SOURCES, TileThumbnail, importedWidgetId } from './importedWidgets';
import './dashboardWidgetPicker.css';

export interface RemovedNativeWidget { id: string; label: string; }
interface DashboardWidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: DashboardPeriod;
  removedNative: RemovedNativeWidget[];
  placedIds: string[];
  onAdd: (id: string) => void;
}

/** Only the selected source mounts its report hooks and loads its previews. */
export default function DashboardWidgetPicker({ open, onOpenChange, period, removedNative, placedIds, onAdd }: DashboardWidgetPickerProps) {
  const { t } = useTranslation();
  const placed = React.useMemo(() => new Set(placedIds), [placedIds]);
  const [selection, setSelection] = React.useState('reports.overview');
  const source = TILE_SOURCES.find((item) => item.id === selection);
  const restoring = selection === 'native';
  const title = restoring ? t('dashboard.picker.removed', 'Retirés du tableau de bord') : source ? t(source.labelKey, source.fallback) : '';
  const panelId = React.useId();
  const headingId = React.useId();

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="db-picker">
      <DialogHeader className="db-picker__header">
        <DialogTitle>{t('dashboard.picker.title', 'Ajouter un composant')}</DialogTitle>
        <DialogDescription>{t('dashboard.picker.browseDescription', 'Choisissez une catégorie, puis ajoutez les indicateurs utiles à votre tableau de bord.')}</DialogDescription>
      </DialogHeader>
      <div className="db-picker__workspace">
        <nav className="db-picker__nav" aria-label={t('dashboard.picker.categories', 'Catégories de composants')}>
          {removedNative.length > 0 && <button type="button" aria-current={restoring ? 'true' : undefined} aria-controls={panelId} onClick={() => setSelection('native')}>
            <span>{t('dashboard.picker.removed', 'Retirés du tableau de bord')}</span><span className="db-picker__count">{removedNative.length}</span>
          </button>}
          {TILE_SOURCES.map((item) => <button key={item.id} type="button" aria-current={selection === item.id ? 'true' : undefined}
            aria-controls={panelId} onClick={() => setSelection(item.id)}>
            <span><span className="db-picker__category">{t(item.labelKey, item.fallback)}</span><small>{t(item.originKey, item.originFallback)}</small></span>
            <ChevronRight size={14} className="cn-rtl-flip" aria-hidden />
          </button>)}
        </nav>
        <section className="db-picker__results" id={panelId} aria-labelledby={headingId}>
          <div className="db-picker__section-heading"><h3 id={headingId}>{title}</h3><span>{t('dashboard.picker.previewLabel', 'Aperçu des composants')}</span></div>
          {restoring ? <ul className="db-picker__native">
            {removedNative.map((widget) => <li key={widget.id}><span>{widget.label}</span>
              <Button variant="outline" size="sm" onClick={() => onAdd(widget.id)}><Add size={14} aria-hidden />{t('dashboard.picker.restore', 'Remettre')}</Button>
            </li>)}
            {removedNative.length === 0 && <li>{t('dashboard.picker.allRestored', 'Tous les composants ont été remis.')}</li>}
          </ul> : source && <SourceTileOptions key={source.id} source={source} period={period}>
            {(options, loading, failure) => {
              if (loading) return <div className="db-picker__options" aria-busy="true" aria-label={t('common.loading', 'Chargement…')}>
                {[0, 1, 2, 3].map((key) => <div key={key}><Skeleton className="h-28 w-full" /><Skeleton className="mt-4 h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-1/2" /></div>)}
              </div>;
              if (failure) return <div className="db-picker__empty" role="alert"><p>{t('dashboard.picker.loadError', 'Impossible de charger ces composants.')}</p>
                {failure.retry && <Button variant="outline" onClick={failure.retry}>{t('common.retry', 'Réessayer')}</Button>}</div>;
              if (!options.length) return <p className="db-picker__empty">{t('dashboard.picker.emptySource', 'Aucun graphique sur la période choisie.')}</p>;
              return <ul className="db-picker__options">{options.map((tile) => {
                const id = importedWidgetId(source.id, tile.key);
                const added = placed.has(id);
                return <li key={tile.key} className="db-picker__option" data-placed={added || undefined}>
                  <TileThumbnail tile={tile} large />
                  <div className="db-picker__option-description"><h4>{tile.title}</h4>{tile.hint && <p>{tile.hint}</p>}</div>
                  <Button variant={added ? 'ghost' : 'outline'} size="sm" disabled={added} onClick={() => onAdd(id)}
                    aria-label={`${added ? t('dashboard.picker.placed', 'Déjà posé') : t('dashboard.picker.add', 'Ajouter')} : ${tile.title}`}>
                    {added ? <Check size={14} aria-hidden /> : <Add size={14} aria-hidden />}
                    {added ? t('dashboard.picker.placed', 'Déjà posé') : t('dashboard.picker.add', 'Ajouter')}
                  </Button>
                </li>;
              })}</ul>;
            }}
          </SourceTileOptions>}
        </section>
      </div>
      <footer className="db-picker__footer"><span>{t('dashboard.picker.savedHint', 'Vous pourrez déplacer et redimensionner chaque composant.')}</span>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close', 'Fermer')}</Button></footer>
    </DialogContent>
  </Dialog>;
}
