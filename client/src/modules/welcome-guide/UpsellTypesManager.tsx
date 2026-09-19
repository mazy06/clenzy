import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../components/ui';
import StatusChip from '../../components/baitly/StatusChip';
import { Delete } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useCreateUpsellType,
  useDeactivateUpsellType,
  useUpsellTypes,
} from '../../hooks/useUpsellTypes';

/**
 * Gestion des types de vente additionnelle.
 *
 * <p>L'écran proposait neuf catégories figées dans le code : vendre un massage,
 * un forfait de ski ou une carte SIM demandait un déploiement. Le référentiel
 * vit désormais en base, et cette fenêtre en est la porte d'entrée.</p>
 *
 * <p>Trois natures de types y cohabitent, et la distinction est visible parce
 * qu'elle change ce qu'on peut faire :</p>
 * <ul>
 *   <li><b>Historiques</b> — référencés nommément par le code (l'agent de
 *       supervision cherche l'arrivée anticipée) : ni modifiables ni retirables ;</li>
 *   <li><b>Catalogue</b> — issus des prestations de la place de marché vendables
 *       au voyageur, proposés à toutes les organisations ;</li>
 *   <li><b>Les vôtres</b> — ajoutés ici, et eux seuls peuvent être retirés.</li>
 * </ul>
 */
export default function UpsellTypesManager({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: types = [], isLoading } = useUpsellTypes();
  const createType = useCreateUpsellType();
  const deactivateType = useDeactivateUpsellType();

  const [label, setLabel] = useState('');

  const mine = types.filter((type) => !type.platform);
  const fromCatalogue = types.filter((type) => type.platform && !type.system && type.serviceItemCode);
  const historical = types.filter((type) => type.system);

  const submit = () => {
    const value = label.trim();
    if (!value) return;
    // Le champ se vide TOUT DE SUITE et se remplit à nouveau en cas d'échec,
    // plutôt que d'attendre le rappel de succès : celui-ci ne s'exécutait pas de
    // façon fiable et le libellé restait dans le champ après l'ajout, donnant à
    // croire que rien n'était parti.
    setLabel('');
    // Le code dérive du libellé côté serveur : un hôte saisit « Cours de surf »,
    // pas un identifiant.
    createType.mutate({ label: value }, { onError: () => setLabel(value) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('upsells.types.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('upsells.types.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* ─── Ajout ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
                maxLength={120}
                placeholder={t('upsells.types.newPlaceholder')}
                aria-label={t('upsells.types.newAria')}
              />
              <Button
                onClick={submit}
                disabled={!label.trim() || createType.isPending}
              >
                {t('upsells.preview.add')}
              </Button>
            </div>
            {createType.isError && (
              <p className="m-0 text-xs text-destructive-ink">
                {(createType.error as Error)?.message
                  ?? t('upsells.types.createError')}
              </p>
            )}
          </div>

          {isLoading ? (
            <p className="m-0 text-sm text-muted-foreground">{t('upsells.types.loading')}</p>
          ) : (
            <div className="flex max-h-[22rem] flex-col gap-4 overflow-y-auto">
              <TypeGroup
                title={t('upsells.types.mine')}
                emptyLabel={t('upsells.types.mineEmpty')}
                types={mine}
                onRemove={(id) => deactivateType.mutate(id)}
                removing={deactivateType.isPending}
              />
              <TypeGroup
                title={t('upsells.types.fromCatalogue')}
                emptyLabel={t('upsells.types.fromCatalogueEmpty')}
                types={fromCatalogue}
              />
              <TypeGroup
                title={t('upsells.types.historical')}
                emptyLabel={t('upsells.types.historicalEmpty')}
                types={historical}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeGroup({ title, types, emptyLabel, onRemove, removing }: {
  title: string;
  types: Array<{ id: number; code: string; labelFr: string; system: boolean }>;
  emptyLabel: string;
  onRemove?: (id: number) => void;
  removing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        {types.length > 0 && <span className="ms-1.5 tabular-nums opacity-70">{types.length}</span>}
      </h3>
      {types.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {types.map((type) => (
            <li
              key={type.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs',
                onRemove ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {type.labelFr}
              {type.system && <StatusChip size="sm" tone="neutral" label={t('upsells.types.system')} />}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(type.id)}
                  disabled={removing}
                  aria-label={t('upsells.types.removeAria', { name: type.labelFr })}
                  title={t('upsells.types.removeTitle')}
                  className="cursor-pointer rounded-sm text-primary/70 outline-none hover:text-primary focus-visible:ring-[2px] focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <Delete className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
