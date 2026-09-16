import { useMarketplacePresentation } from './useMarketplacePresentation';
import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Switch,
} from '../../components/ui';
import { Search } from '../../icons';
import { cn } from '../../utils/cn';
import type {
  EngagementMode,
  FacetCount,
  MarketplaceFacetsDto,
  ServiceCategoryDto,
} from '../../services/api/marketplaceProvidersApi';
import {
  categoryIcon,
  ENGAGEMENT_ORDER,
  FAMILY_ORDER,
} from './providerPresentation';

/**
 * Filtres de la place de marché — panneau permanent, tiroir en mobile.
 *
 * <p>Deux montages pour un seul contenu : {@link MarketplaceFilterPanel} est
 * rendu en COLONNE FIXE à partir de `lg`, et enveloppé dans un tiroir en
 * dessous. Sur un grand écran, les filtres doivent rester sous les yeux — les
 * rouvrir à chaque affinage coûte un aller-retour à chaque fois ; sur un
 * téléphone, une colonne de seize rem ne laisserait rien au contenu.</p>
 *
 * <h2>Ce qu'il corrige</h2>
 * <p>La barre précédente alignait quarante-six contrôles de poids identique sur
 * sept cents pixels de haut : les professionnels commençaient sous la ligne de
 * flottaison. Et surtout elle proposait à égalité « Ménage », qui compte
 * vingt-neuf professionnels, et vingt-neuf métiers qui n'en comptent aucun.</p>
 *
 * <h2>Ce qui crée la clarté</h2>
 * <ul>
 *   <li><b>Des compteurs</b> : un métier vide se voit avant le clic, pas après
 *       un écran blanc.</li>
 *   <li><b>Un tri par volume</b> : l'ordre du référentiel sert à administrer le
 *       catalogue, pas à chercher dedans.</li>
 *   <li><b>Les entrées vides repliées</b> : le catalogue reste consultable —
 *       c'est une place de marché ouverte — sans voler l'écran.</li>
 * </ul>
 *
 * <p>Les volumes portent sur l'ENSEMBLE du catalogue, pas sur le sous-ensemble
 * filtré : ils disent où chercher, et des comptes qui tomberaient à zéro au fil
 * du filtrage cacheraient les pistes de repli.</p>
 */
export interface MarketplaceFilterPanelProps {
  categories: ServiceCategoryDto[];
  facets?: MarketplaceFacetsDto;

  selectedCategories: string[];
  onToggleCategory: (code: string) => void;
  selectedServices: string[];
  onToggleService: (code: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  engagements: EngagementMode[];
  onToggleEngagement: (mode: EngagementMode) => void;
  availableOnDay: string;
  onAvailableOnDayChange: (day: string) => void;
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (value: boolean) => void;
  acceptsUrgent: boolean;
  onAcceptsUrgentChange: (value: boolean) => void;

  activeCount: number;
  onReset: () => void;
}

/** Index clef → volume, pour lire un compteur sans reparcourir la liste. */
function indexOf(facets?: FacetCount[]): Map<string, number> {
  return new Map((facets ?? []).map((facet) => [facet.key, facet.count]));
}

/** Contenu des filtres, sans coque : la coque dépend de la largeur d'écran. */
export function MarketplaceFilterPanel(props: MarketplaceFilterPanelProps) {
  const { t, catalogLabel, DAY_NAMES, ENGAGEMENT_HINTS, ENGAGEMENT_LABELS, FAMILY_LABELS } = useMarketplacePresentation();
  const {
    categories, facets,
    selectedCategories, onToggleCategory,
    selectedServices, onToggleService,
    city, onCityChange,
    engagements, onToggleEngagement,
    availableOnDay, onAvailableOnDayChange,
    verifiedOnly, onVerifiedOnlyChange,
    acceptsUrgent, onAcceptsUrgentChange,
    activeCount, onReset,
  } = props;

  const [trade, setTrade] = useState('');

  const categoryCounts = useMemo(() => indexOf(facets?.categories), [facets]);
  const serviceCounts = useMemo(() => indexOf(facets?.services), [facets]);
  const engagementCounts = useMemo(() => indexOf(facets?.engagements), [facets]);

  /**
   * Métiers triés par volume, filtrés par la recherche interne.
   *
   * Un métier SÉLECTIONNÉ reste toujours visible même s'il est vide ou hors
   * recherche : le masquer priverait du moyen de le désélectionner.
   */
  const { pourvus, vides } = useMemo(() => {
    const needle = trade.trim().toLowerCase();
    const matching = categories.filter((category) =>
      needle === '' || catalogLabel(category).toLowerCase().includes(needle));

    const withCount = matching
      .map((category) => ({ category, count: categoryCounts.get(category.code) ?? 0 }))
      .sort((a, b) => b.count - a.count || catalogLabel(a.category).localeCompare(catalogLabel(b.category)));

    // Trois raisons de figurer en tête, et elles se cumulent :
    //   — avoir des prestataires, c'est là qu'on cherche en premier ;
    //   — être un métier USUEL, car « personne ne couvre la serrurerie » est
    //     une information, pas un vide à masquer ;
    //   — être sélectionné, sinon on ne pourrait plus se désélectionner.
    // Sans la deuxième, un catalogue jeune affichait trois lignes et un repli.
    const isSelected = (code: string) => selectedCategories.includes(code);
    const shown = withCount.filter((e) =>
      e.count > 0 || e.category.common || isSelected(e.category.code));
    shown.sort((a, b) => {
      const sa = isSelected(a.category.code) ? 1 : 0;
      const sb = isSelected(b.category.code) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      // Le volume prime : on va d'abord là où il y a du monde. À volume égal —
      // typiquement zéro — les métiers usuels passent devant les autres.
      if (a.count !== b.count) return b.count - a.count;
      const ca = a.category.common ? 1 : 0;
      const cb = b.category.common ? 1 : 0;
      return cb - ca || a.category.sortOrder - b.category.sortOrder;
    });

    return {
      pourvus: shown,
      vides: withCount.filter((e) =>
        e.count === 0 && !e.category.common && !isSelected(e.category.code)),
    };
  }, [categories, categoryCounts, trade, selectedCategories, catalogLabel]);

  /**
   * Métiers vides, groupés par FAMILLE.
   *
   * <p>C'est le seul endroit où la famille sert vraiment : une fois dépliés,
   * vingt-neuf métiers à plat ne se parcourent pas, alors que « Technique &
   * réglementaire » oriente en un coup d'œil. En tête de liste, au contraire,
   * trois métiers pourvus n'ont pas besoin d'être classés.</p>
   */
  const videsParFamille = useMemo(() => {
    return FAMILY_ORDER
      .map((family) => ({
        family,
        entries: vides.filter((e) => e.category.family === family),
      }))
      .filter((group) => group.entries.length > 0);
  }, [vides]);

  const [emptyShown, setEmptyShown] = useState(false);

  /** Prestations des métiers choisis — le second niveau ne s'ouvre qu'après le premier. */
  const services = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    return categories
      .filter((category) => selectedCategories.includes(category.code))
      .flatMap((category) => category.items)
      .map((item) => ({ item, count: serviceCounts.get(item.code) ?? 0 }))
      .sort((a, b) => b.count - a.count || catalogLabel(a.item).localeCompare(catalogLabel(b.item)));
  }, [categories, selectedCategories, serviceCounts, catalogLabel]);

  const cities = facets?.cities ?? [];

  return (
    <div className="flex min-h-0 flex-col">
        <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
          <span className="text-[11px] text-muted-foreground">{t('marketplaceAdmin.countsHint')}</span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
            >
              {t('marketplaceAdmin.clear')} ({activeCount})
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {/* ─── Métier ──────────────────────────────────────────────── */}
          <Group
            title={t('marketplaceAdmin.trade')}
            aside={pourvus.length > 0 ? `${pourvus.length}` : undefined}
          >
            {/* La recherche n'apparaît qu'une fois la liste assez longue pour
                qu'on s'y perde. Au-dessus de trois métiers pourvus, un champ de
                saisie encombre plus qu'il n'aide. */}
            {(pourvus.length > 8 || emptyShown || trade !== '') && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-3.5 text-muted-foreground" />
              <Input
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                placeholder={t('marketplaceAdmin.findTrade')}
                aria-label={t('marketplaceAdmin.tradeSearch')}
                className="h-8 ps-8 text-xs"
              />
            </div>
            )}

            {/* Ce message parle de la RECHERCHE, pas du catalogue : sans la
                garde, un catalogue simplement vide affichait « aucun métier ne
                correspond » alors que rien n'avait été cherché. */}
            {pourvus.length === 0 && trade.trim() !== '' && (
              <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
                {t("marketplaceAdmin.noTrade", { query: trade.trim() })}
              </p>
            )}

            {pourvus.map(({ category, count }) => (
              <FacetRow
                key={category.code}
                label={catalogLabel(category)}
                icon={categoryIcon(category.iconKey)}
                count={count}
                active={selectedCategories.includes(category.code)}
                onClick={() => onToggleCategory(category.code)}
              />
            ))}

            {vides.length > 0 && (
              emptyShown ? (
                <>
                  {videsParFamille.map(({ family, entries }) => (
                    <div key={family} className="mt-2">
                      <p className="m-0 px-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {FAMILY_LABELS[family]}
                      </p>
                      {entries.map(({ category, count }) => (
                        <FacetRow
                          key={category.code}
                          label={catalogLabel(category)}
                          icon={categoryIcon(category.iconKey)}
                          count={count}
                          active={false}
                          onClick={() => onToggleCategory(category.code)}
                        />
                      ))}
                    </div>
                  ))}
                  <MoreButton onClick={() => setEmptyShown(false)}>{t('marketplaceAdmin.hideTrades')}</MoreButton>
                </>
              ) : (
                // Le catalogue reste consultable — c'est une place de marché
                // ouverte — mais il ne vole plus l'écran.
                <MoreButton onClick={() => setEmptyShown(true)}>
                  {t('marketplaceAdmin.otherTrades', { count: vides.length })}
                </MoreButton>
              )
            )}
          </Group>

          {/* ─── Prestation ──────────────────────────────────────────── */}
          {services.length > 0 && (
            <Group title={t('marketplaceAdmin.service')} aside={t('marketplaceAdmin.selectedTrade')}>
              {services.slice(0, 8).map(({ item, count }) => (
                <FacetRow
                  key={item.code}
                  label={catalogLabel(item)}
                  count={count}
                  active={selectedServices.includes(item.code)}
                  onClick={() => onToggleService(item.code)}
                />
              ))}
              {services.length > 8 && (
                <p className="m-0 px-1 pt-1 text-[11px] text-muted-foreground">
                  {t('marketplaceAdmin.otherServices', { count: services.length - 8 })}
                </p>
              )}
            </Group>
          )}

          {/* ─── Ville ───────────────────────────────────────────────── */}
          {cities.length > 0 && (
            <Group title={t('marketplaceAdmin.city')} aside={`${cities.length}`}>
              {cities.slice(0, 6).map((facet) => (
                <FacetRow
                  key={facet.key}
                  label={facet.key}
                  count={facet.count}
                  active={city === facet.key}
                  onClick={() => onCityChange(city === facet.key ? '' : facet.key)}
                />
              ))}
            </Group>
          )}

          {/* ─── Engagement ──────────────────────────────────────────── */}
          <Group title={t('marketplaceAdmin.engagement')}>
            {ENGAGEMENT_ORDER.map((mode) => (
              <FacetRow
                key={mode}
                label={ENGAGEMENT_LABELS[mode]}
                title={ENGAGEMENT_HINTS[mode]}
                count={engagementCounts.get(mode) ?? 0}
                active={engagements.includes(mode)}
                onClick={() => onToggleEngagement(mode)}
              />
            ))}
          </Group>

          {/* ─── Disponibilité ───────────────────────────────────────── */}
          <Group title={t('marketplaceAdmin.availableOn')}>
            <div className="flex flex-wrap gap-1">
              {DAY_NAMES.map((name, index) => {
                const value = String(index + 1);
                const active = availableOnDay === value;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-pressed={active}
                    onClick={() => onAvailableOnDayChange(active ? '' : value)}
                    className={cn(
                      'inline-flex size-8 cursor-pointer items-center justify-center rounded-md border text-xs font-semibold',
                      'transition-colors duration-150 outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50',
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {name.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </Group>

          {/* ─── Bascules ────────────────────────────────────────────── */}
          <Group title={t('marketplaceAdmin.other')}>
            <ToggleRow
              label={t('marketplaceAdmin.verifiedOnly')}
              checked={verifiedOnly}
              onChange={onVerifiedOnlyChange}
            />
            <ToggleRow
              label={t('marketplaceAdmin.urgent')}
              checked={acceptsUrgent}
              onChange={onAcceptsUrgentChange}
            />
          </Group>
        </div>
    </div>
  );
}

/**
 * Coque mobile : le même panneau dans un tiroir.
 *
 * <p>N'existe qu'en dessous de `lg` — au-dessus, le panneau est monté en
 * colonne et ce tiroir n'est jamais rendu.</p>
 */
export function MarketplaceFilterSheet({ open, onOpenChange, ...panel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & MarketplaceFilterPanelProps) {
  const { t, locale } = useMarketplacePresentation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={locale.startsWith("ar") ? "left" : "right"} className="flex w-full flex-col gap-0 px-4 py-3 sm:max-w-sm">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle className="text-base">{t('marketplaceAdmin.filters')}</SheetTitle>
          <SheetDescription className="sr-only">{t('marketplaceAdmin.filterHint')}</SheetDescription>
        </SheetHeader>
        <MarketplaceFilterPanel {...panel} />
      </SheetContent>
    </Sheet>
  );
}

// ─── Pièces ─────────────────────────────────────────────────────────────────

function Group({ title, aside, children }: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 border-b border-border pb-4 last:mb-0 last:border-b-0 last:pb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Une valeur de filtre et son volume.
 *
 * <p>Le compteur reste lisible à zéro plutôt que masqué : « aucun professionnel
 * ici » est une réponse, et la masquer obligerait à cliquer pour l'obtenir.</p>
 */
function FacetRow({ label, icon, count, active, onClick, title }: {
  label: string;
  icon?: React.ReactElement;
  count: number;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-start text-sm',
        'transition-colors duration-150 outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50',
        active
          ? 'bg-primary-soft font-semibold text-primary'
          : count === 0
            ? 'text-muted-foreground hover:bg-accent'
            : 'text-foreground hover:bg-accent',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {icon && <span className="shrink-0 [&>svg]:size-3.5">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn(
        'shrink-0 text-xs tabular-nums',
        active ? 'text-primary' : 'text-muted-foreground',
        count === 0 && !active && 'opacity-60',
      )}>
        {count}
      </span>
    </button>
  );
}

function MoreButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 w-full cursor-pointer rounded-md border border-dashed border-border px-1.5 py-1 text-start text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-1.5 py-1 text-sm text-foreground">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
