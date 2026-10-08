import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Badge, Alert, AlertDescription } from '../../../components/ui';
import { BaitlyCatalog, CatalogFilterGroup, CatalogFilter, CatalogResults, CatalogCard, type CatalogView } from '../../../components/catalog/BaitlyCatalog';
import EmptyState from '../../../components/EmptyState';
import { useUserPreference } from '../../../hooks/useUserPreference';
import { Money } from '../../../components/Money';
import {
  Star, Plus, Check, Clock, Users, Globe, Calendar, Search, Store, Layers, ChevronRight,
  ShieldCheck, ArrowLeft, BookOpen, Boxes, Tag,
} from '../../../icons/glyphs';
import { type UpsellOffer } from '../../../services/api/upsellApi';
import {
  MARKETPLACE_EXPERIENCES, PARTNER_COLOR, PARTNERS,
  type MarketplaceExperience, type PartnerName,
} from './marketplaceData';
import './marketplace.css';
import PagePagination from '../../../components/PagePagination';
import { useTranslation } from '../../../hooks/useTranslation';

type Filter = 'Tous' | 'Internes' | PartnerName;
/** Item unifié : service interne (géré) OU expérience partenaire (à ajouter). */
type Item = { kind: 'internal'; o: UpsellOffer } | { kind: 'partner'; e: MarketplaceExperience };

interface Props {
  /** Chargement de la liste (skeletons). */
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  filters?: ReactNode;
  internalOnly?: boolean;
  onResetFilters?: () => void;
  /** Services internes (déjà filtrés recherche/canal/catégorie par le parent). */
  offers: UpsellOffer[];
  /** Recherche libre (PageHeader) — filtre aussi les expériences partenaires. */
  search?: string;
  /** Synthèse rendue par le parent, masquée en détail. */
  kpis?: ReactNode;
  /** Titres des services déjà au catalogue → amorce l'état « Ajouté » des partenaires. */
  addedTitles?: string[];
  /** Libellé i18n d'un type de service interne. */
  typeLabel: (type: string) => string;
  /** Ajoute une expérience partenaire au catalogue (crée un service interne). Optimiste côté parent. */
  onAdd: (exp: MarketplaceExperience) => Promise<void>;
  /** Ouvre le détail d'un service interne (géré par le parent). */
  onOpenInternal: (o: UpsellOffer) => void;
  /**
   * Menu d'actions « … » d'un service interne, rendu par le parent AVEC son
   * declencheur. Le catalogue ne fait que lui donner sa place dans la ligne :
   * un menu Radix ancre son panneau sur le declencheur qu'il rend lui-meme, et
   * ne saurait pas quoi faire d'un `anchorEl` recu apres coup.
   */
  renderRowMenu: (o: UpsellOffer) => React.ReactNode;
}

const fmtEur = (n: number) => `${n} €`;
/**
 * Catalogue de services unifié : services internes + expériences partenaires dans une
 * seule grille/liste, filtre par source (Tous / Internes / partenaires), toggle Cartes/Liste,
 * pagination, et détail partenaire intégré. (Le détail des services internes vit dans UpsellsAdmin.)
 */
export default function ServicesCatalog({
  loading = false, error = false, onRetry, filters, internalOnly = false, onResetFilters, offers, search = '', kpis, addedTitles = [], typeLabel,
  onAdd, onOpenInternal, renderRowMenu,
}: Props) {
  const { t } = useTranslation();
  const [view, setView] = useUserPreference<CatalogView>('baitly.catalog.view', 'cards');
  const [filter, setFilter] = useUserPreference<Filter>('baitly.services.source', 'Tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState({ livret: true, booking: true });
  const [page, setPage] = useState(1);

  const experiences = MARKETPLACE_EXPERIENCES;

  // Items unifiés (internes d'abord, puis partenaires), filtrés par source + recherche.
  const allItems: Item[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const internal: Item[] = offers.map((o) => ({ kind: 'internal', o }));
    const partner: Item[] = internalOnly ? [] : experiences.flatMap((e) =>
      !q || e.title.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)
        ? [{ kind: 'partner', e } as Item]
        : [],
    );
    return [...internal, ...partner];
  }, [offers, experiences, search, internalOnly]);

  const visible = useMemo(() => {
    if (filter === 'Tous') return allItems;
    if (filter === 'Internes') return allItems.filter((i) => i.kind === 'internal');
    return allItems.filter((i) => i.kind === 'partner' && i.e.partner === filter);
  }, [allItems, filter]);

  const selected = experiences.find((e) => e.id === selectedId) ?? null;

  // « Ajouté » = ajouté optimistiquement OU déjà présent au catalogue (match par titre).
  const addedTitleSet = useMemo(() => new Set(addedTitles.map((t) => t.trim().toLowerCase())), [addedTitles]);
  const isAdded = (e: MarketplaceExperience) => !!added[e.id] || addedTitleSet.has(e.title.trim().toLowerCase());

  // Même pagination dans les deux vues pour conserver les repères du catalogue.
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = visible.slice((curPage - 1) * pageSize, curPage * pageSize);
  useEffect(() => { setPage(1); }, [filter, view, search, offers]);

  const handleAdd = async (e: MarketplaceExperience) => {
    if (isAdded(e) || busy[e.id]) return;
    setAdded((s) => ({ ...s, [e.id]: true }));            // optimiste
    setBusy((s) => ({ ...s, [e.id]: true }));
    try {
      await onAdd(e);
    } catch {
      setAdded((s) => ({ ...s, [e.id]: false }));         // rollback en cas d'échec
    } finally {
      setBusy((s) => { const n = { ...s }; delete n[e.id]; return n; });
    }
  };

  // ── Bouton Ajouter / Ajouté (réutilisé carte + ligne partenaire) ────────────
  const addBtn = (e: MarketplaceExperience) => {
    const done = isAdded(e);
    return (
      <Button variant="outline" size="sm"
        disabled={done || !!busy[e.id]} aria-busy={!!busy[e.id]}
        aria-label={done
          ? t('welcomeGuide.marketplace.addedAria', { title: e.title })
          : t('welcomeGuide.marketplace.addAria', { title: e.title })}
        onClick={() => { void handleAdd(e); }}>
        {done ? <Check size={15} /> : <Plus size={15} />}
        {busy[e.id] ? t('common.processing') : done ? t('welcomeGuide.marketplace.added') : t('welcomeGuide.marketplace.add')}
      </Button>
    );
  };

  // ── Écran de détail (expérience partenaire) ─────────────────────────────────
  if (selected) {
    const Icon = selected.icon;
    const color = PARTNER_COLOR[selected.partner];
    const commission = (selected.price * selected.commission) / 100;
    const commissionTxt = `+ ${commission.toFixed(2).replace('.', ',')} €`;
    const done = isAdded(selected);
    const know: Array<{ icon: typeof Clock; label: string; value: string }> = [
      { icon: Clock, label: 'Durée', value: selected.duration },
      { icon: Globe, label: 'Langues', value: selected.language },
      { icon: Users, label: 'Groupe', value: selected.group },
      { icon: Calendar, label: 'Annulation', value: selected.cancel },
    ];
    return (
      <div className="be-home"><section className="mp" style={{ ['--mp-action' as string]: 'var(--bui-primary)', ['--mp-action-soft' as string]: 'var(--bui-primary-soft)' }}>
        <button type="button" className="mp-back" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={16} strokeWidth={2} /> {t('welcomeGuide.marketplace.back')}
        </button>
        <div className="mp-detail">
          <div className="mp-detail__main">
            <div className="mp-detail__gallery">
              <div className="mp-detail__hero">
                {selected.imageUrl ? <img src={selected.imageUrl} alt="" /> : <Icon size={64} strokeWidth={1.5} style={{ color, opacity: 0.4 }} />}
                <span className="mp-pbadge mp-pbadge--over"><span className="mp-dot" style={{ background: color }} />{selected.partner}</span>
              </div>
              <div className="mp-detail__thumbs">
                {[0, 1, 2].map((i) => (
                  <div className="mp-detail__thumb" key={i}><Icon size={22} strokeWidth={1.5} style={{ color, opacity: 0.35 }} /></div>
                ))}
              </div>
            </div>

            <p className="mp-detail__eyebrow" style={{ color }}>{selected.category}</p>
            <h1 className="mp-detail__title">{selected.title}</h1>
            <div className="mp-detail__meta">
              <span><Star size={15} className="mp-star" /> {selected.rating} <span className="mp-faint">({selected.reviews} avis)</span></span>
              <span className="mp-sep" />
              <span><Clock size={15} /> {selected.duration}</span>
              <span className="mp-sep" />
              <span><Users size={15} /> {selected.group}</span>
            </div>

            <h3 className="mp-detail__h3">Description</h3>
            <p className="mp-detail__desc">{selected.long}</p>

            <h3 className="mp-detail__h3">{t('welcomeGuide.marketplace.included')}</h3>
            <div className="mp-detail__incl">
              {selected.includes.map((it) => (
                <span className="mp-incl" key={it}><span className="mp-incl__chk"><Check size={13} strokeWidth={2.6} /></span>{it}</span>
              ))}
            </div>

            <h3 className="mp-detail__h3">{t('welcomeGuide.marketplace.goodToKnow')}</h3>
            <div className="mp-detail__know">
              {know.map((k) => {
                const KIcon = k.icon;
                return (
                  <div className="mp-know" key={k.label}>
                    <span className="mp-know__ic"><KIcon size={17} strokeWidth={2} /></span>
                    <span><span className="mp-know__lbl">{k.label}</span><span className="mp-know__val">{k.value}</span></span>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="mp-detail__panel">
            <p className="mp-detail__price">{fmtEur(selected.price)} <span>/ pers.</span></p>
            <div className="mp-detail__comm">
              <div className="mp-detail__commrow"><span>Prix voyageur</span><b>{fmtEur(selected.price)}</b></div>
              <div className="mp-detail__commsep" />
              <div className="mp-detail__commrow"><span>{t('welcomeGuide.marketplace.yourCommission', { pct: selected.commission })}</span><b className="mp-action-text">{commissionTxt}</b></div>
              <p className="mp-detail__commnote">{t('welcomeGuide.marketplace.commissionNote')}</p>
            </div>

            <p className="mp-detail__diffuse">{t('welcomeGuide.marketplace.distributeOn')}</p>
            <div className="mp-detail__chans">
              {([['livret', t('welcomeGuide.marketplace.guide'), BookOpen],
               ['booking', t('welcomeGuide.marketplace.booking'), Boxes]] as const).map(([key, label, ChIcon]) => {
                const on = channels[key];
                return (
                  <button
                    type="button" key={key}
                    className={'mp-chan' + (on ? ' mp-chan--on' : '')}
                    role="switch" aria-checked={on}
                    onClick={() => setChannels((c) => ({ ...c, [key]: !c[key] }))}
                  >
                    <ChIcon size={15} strokeWidth={2} /> {label} {on && <Check size={14} strokeWidth={2.6} className="mp-chan__chk" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={'mp-cta' + (done ? ' mp-cta--done' : '')}
              disabled={done || !!busy[selected.id]}
              onClick={() => handleAdd(selected)}
            >
              {done ? <Check size={17} strokeWidth={2.4} /> : <Plus size={17} strokeWidth={2.4} />}
              {done
                ? t('welcomeGuide.marketplace.addedToServices')
                : t('welcomeGuide.marketplace.addToServices')}
            </button>
            <button type="button" className="mp-outline">{t('welcomeGuide.marketplace.viewPartner', { partner: selected.partner })}</button>
            <p className="mp-detail__mention"><ShieldCheck size={14} strokeWidth={2} /> {t('welcomeGuide.marketplace.partnerHandled')}</p>
          </aside>
        </div>
      </section></div>
    );
  }

  const resetFilters = () => { setFilter('Tous'); onResetFilters?.(); };
  const sourceLabel = filter === 'Tous' ? t('baitlyCatalog.services')
    : filter === 'Internes' ? t('welcomeGuide.marketplace.filterInternal') : filter;

  return <BaitlyCatalog title={sourceLabel} count={visible.length} view={view} onViewChange={setView}
    summary={kpis}
    filters={<>
      <CatalogFilterGroup title={t('baitlyCatalog.sources')}>
        <CatalogFilter label={t('welcomeGuide.marketplace.filterAll')} count={allItems.length}
          active={filter === 'Tous'} onClick={() => setFilter('Tous')} icon={<Layers />} />
        <CatalogFilter label={t('welcomeGuide.marketplace.filterInternal')} count={offers.length}
          active={filter === 'Internes'} onClick={() => setFilter('Internes')} icon={<Store />} />
        {PARTNERS.map(partner => <CatalogFilter key={partner} label={partner}
          count={allItems.filter(item => item.kind === 'partner' && item.e.partner === partner).length}
          active={filter === partner} onClick={() => setFilter(partner)} />)}
      </CatalogFilterGroup>
      {filters}
    </>}>
    {error && <Alert variant="destructive" className="mb-4">
      <AlertDescription>{t('baitlyCatalog.loadError')}
        <Button variant="ghost" size="sm" onClick={onRetry}>{t('baitlyCatalog.retry')}</Button>
      </AlertDescription>
    </Alert>}
    {!loading && !visible.length ? <EmptyState variant="transparent" icon={<Search />}
      title={t('baitlyCatalog.empty')} description={t('baitlyCatalog.emptyHelp')}
      action={<Button variant="outline" onClick={resetFilters}>{t('baitlyCatalog.reset')}</Button>} />
      : <CatalogResults view={view} loading={loading}>
        {pageItems.map(item => item.kind === 'partner' ? renderPartner(item.e) : renderInternal(item.o))}
      </CatalogResults>}
    <PagePagination className="mt-4" count={visible.length} rowsPerPage={pageSize}
      page={curPage - 1} onPageChange={value => setPage(value + 1)} />
  </BaitlyCatalog>;

  function renderPartner(e: MarketplaceExperience) {
    const Icon = e.icon;
    return <CatalogCard key={e.id} title={e.title} source={e.partner}
      media={e.imageUrl ? <img src={e.imageUrl} alt="" loading="lazy" /> : <Icon size={26} strokeWidth={1.5} />}
      description={e.desc} onOpen={() => setSelectedId(e.id)}
      trailing={<span className="flex shrink-0 items-center gap-1 text-xs tabular-nums"><Star size={14} className="text-warning-ink" />{e.rating}</span>}
      metadata={<>
        <span><Clock size={14} />{e.duration}</span>
        <span><Users size={14} />{e.group}</span>
      </>}
      price={<><Money value={e.price} from="EUR" /><span className="text-xs font-normal text-muted-foreground">{t('baitlyCatalog.perPerson')}</span></>}
      priceNote={t('baitlyCatalog.commission', { percent: e.commission })}
      action={addBtn(e)} />;
  }

  function renderInternal(o: UpsellOffer) {
    return <CatalogCard key={'int-' + o.id} title={o.title} source={t('welcomeGuide.marketplace.filterInternal')}
      media={o.imageUrl ? <img src={o.imageUrl} alt="" loading="lazy" /> : <Tag size={26} strokeWidth={1.5} />}
      description={o.description || typeLabel(o.type)} onOpen={() => onOpenInternal(o)}
      badges={<Badge variant="secondary">{t(o.active ? 'baitlyCatalog.active' : 'baitlyCatalog.inactive')}</Badge>}
      metadata={<>
        <span>{typeLabel(o.type)}</span>
        {o.diffuseOnLivret && <span><BookOpen size={14} />{t('welcomeGuide.marketplace.guide')}</span>}
        {o.diffuseOnBooking && <span><Boxes size={14} />{t('welcomeGuide.marketplace.booking')}</span>}
      </>}
      price={<Money value={o.price} from={o.currency} />}
      action={<>
        <Button variant="outline" size="sm" onClick={() => onOpenInternal(o)}
          aria-label={t('baitlyCatalog.manage') + ' : ' + o.title}>
          {t('baitlyCatalog.manage')}<ChevronRight size={15} className="rtl:rotate-180" />
        </Button>
        {renderRowMenu(o)}
      </>} />;
  }
}
