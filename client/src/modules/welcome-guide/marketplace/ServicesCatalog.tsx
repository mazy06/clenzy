import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Skeleton, Pagination, Box } from '@mui/material';
import {
  LayoutGrid, List, Star, Plus, Check, Clock, Users, Globe, Calendar,
  ShieldCheck, ArrowLeft, BookOpen, Boxes, MoreHorizontal,
} from 'lucide-react';
import { ServiceArt } from '../serviceArt';
import { type UpsellOffer } from '../../../services/api/upsellApi';
import {
  MARKETPLACE_EXPERIENCES, PARTNER_COLOR, PARTNERS, countByPartner,
  type MarketplaceExperience, type PartnerName,
} from './marketplaceData';
import './marketplace.css';

type View = 'cards' | 'list';
type Filter = 'Tous' | 'Internes' | PartnerName;
/** Item unifié : service interne (géré) OU expérience partenaire (à ajouter). */
type Item = { kind: 'internal'; o: UpsellOffer } | { kind: 'partner'; e: MarketplaceExperience };

interface Props {
  /** Chargement de la liste (skeletons). */
  loading?: boolean;
  /** Services internes (déjà filtrés recherche/canal/catégorie par le parent). */
  offers: UpsellOffer[];
  /** Recherche libre (PageHeader) — filtre aussi les expériences partenaires. */
  search?: string;
  /** Bandeau KPIs rendu par le parent — affiché en vue liste, masqué en détail. */
  kpis?: ReactNode;
  /** Titres des services déjà au catalogue → amorce l'état « Ajouté » des partenaires. */
  addedTitles?: string[];
  /** Libellé i18n d'un type de service interne. */
  typeLabel: (type: string) => string;
  /** Ajoute une expérience partenaire au catalogue (crée un service interne). Optimiste côté parent. */
  onAdd: (exp: MarketplaceExperience) => Promise<void>;
  /** Ouvre le détail d'un service interne (géré par le parent). */
  onOpenInternal: (o: UpsellOffer) => void;
  /** Ouvre le menu d'actions « … » d'un service interne (ancré sur l'élément). */
  onMenuInternal: (el: HTMLElement, o: UpsellOffer) => void;
}

const fmtEur = (n: number) => `${n} €`;
const fmtPrice = (n: number, cur?: string) => (!cur || cur === 'EUR' ? `${n} €` : `${n} ${cur}`);
const tint = (hex: string, pct: number) => `color-mix(in srgb, ${hex} ${pct}%, transparent)`;

/**
 * Catalogue de services unifié : services internes + expériences partenaires dans une
 * seule grille/liste, filtre par source (Tous / Internes / partenaires), toggle Cartes/Liste,
 * pagination, et détail partenaire intégré. (Le détail des services internes vit dans UpsellsAdmin.)
 */
export default function ServicesCatalog({
  loading = false, offers, search = '', kpis, addedTitles = [], typeLabel,
  onAdd, onOpenInternal, onMenuInternal,
}: Props) {
  const [view, setView] = useState<View>('cards');
  const [filter, setFilter] = useState<Filter>('Tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState({ livret: true, booking: true });
  const [page, setPage] = useState(1);

  const experiences = MARKETPLACE_EXPERIENCES;
  const counts = useMemo(() => countByPartner(experiences), [experiences]);

  // Items unifiés (internes d'abord, puis partenaires), filtrés par source + recherche.
  const allItems: Item[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const internal: Item[] = offers.map((o) => ({ kind: 'internal', o }));
    const partner: Item[] = experiences
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q))
      .map((e) => ({ kind: 'partner', e }));
    return [...internal, ...partner];
  }, [offers, experiences, search]);

  const visible = useMemo(() => {
    if (filter === 'Tous') return allItems;
    if (filter === 'Internes') return allItems.filter((i) => i.kind === 'internal');
    return allItems.filter((i) => i.kind === 'partner' && i.e.partner === filter);
  }, [allItems, filter]);

  const selected = experiences.find((e) => e.id === selectedId) ?? null;

  // « Ajouté » = ajouté optimistiquement OU déjà présent au catalogue (match par titre).
  const addedTitleSet = useMemo(() => new Set(addedTitles.map((t) => t.trim().toLowerCase())), [addedTitles]);
  const isAdded = (e: MarketplaceExperience) => !!added[e.id] || addedTitleSet.has(e.title.trim().toLowerCase());

  // Pagination client-side (pattern MembersList) — page-size selon la vue.
  const pageSize = view === 'cards' ? 8 : 10;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = visible.slice((curPage - 1) * pageSize, curPage * pageSize);
  useEffect(() => { setPage(1); }, [filter, view, search]);

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
      <button
        type="button"
        className={'mp-add' + (done ? ' mp-add--done' : '')}
        disabled={done || !!busy[e.id]}
        aria-label={done ? `${e.title} ajouté` : `Ajouter ${e.title}`}
        onClick={(ev) => { ev.stopPropagation(); handleAdd(e); }}
      >
        {done ? <Check size={15} strokeWidth={2.4} /> : <Plus size={15} strokeWidth={2.4} />}
        {done ? 'Ajouté' : 'Ajouter'}
      </button>
    );
  };

  // Bouton menu « … » d'un service interne.
  const menuBtn = (o: UpsellOffer) => (
    <button
      type="button" className="mp-imenu" aria-label="Actions"
      onClick={(ev) => { ev.stopPropagation(); onMenuInternal(ev.currentTarget, o); }}
    >
      <MoreHorizontal size={18} strokeWidth={2} />
    </button>
  );

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
      <section className="mp" style={{ ['--mp-action' as string]: 'var(--accent)', ['--mp-action-soft' as string]: 'var(--accent-soft)' }}>
        <button type="button" className="mp-back" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={16} strokeWidth={2} /> Retour au catalogue
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

            <h3 className="mp-detail__h3">Ce qui est inclus</h3>
            <div className="mp-detail__incl">
              {selected.includes.map((it) => (
                <span className="mp-incl" key={it}><span className="mp-incl__chk"><Check size={13} strokeWidth={2.6} /></span>{it}</span>
              ))}
            </div>

            <h3 className="mp-detail__h3">Bon à savoir</h3>
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
              <div className="mp-detail__commrow"><span>Votre commission ({selected.commission}%)</span><b className="mp-action-text">{commissionTxt}</b></div>
              <p className="mp-detail__commnote">Perçue par réservation, sans frais de gestion.</p>
            </div>

            <p className="mp-detail__diffuse">DIFFUSER SUR</p>
            <div className="mp-detail__chans">
              {([['livret', 'Livret', BookOpen], ['booking', 'Booking', Boxes]] as const).map(([key, label, ChIcon]) => {
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
              {done ? 'Ajouté à vos services' : 'Ajouter à mes services'}
            </button>
            <button type="button" className="mp-outline">Voir la fiche {selected.partner}</button>
            <p className="mp-detail__mention"><ShieldCheck size={14} strokeWidth={2} /> Réservation &amp; paiement gérés par le partenaire</p>
          </aside>
        </div>
      </section>
    );
  }

  // ── Vue catalogue (grille / liste unifiée + pagination) ─────────────────────
  return (
    <section className="mp" style={{ ['--mp-action' as string]: 'var(--accent)', ['--mp-action-soft' as string]: 'var(--accent-soft)' }}>
      {kpis}
      <div className="mp__bar">
        <div className="mp__pills">
          <button type="button" className={'mp-pill' + (filter === 'Tous' ? ' mp-pill--on' : '')} onClick={() => setFilter('Tous')}>
            Tous <span className="mp-pill__n">{allItems.length}</span>
          </button>
          <button type="button" className={'mp-pill' + (filter === 'Internes' ? ' mp-pill--on' : '')} onClick={() => setFilter('Internes')}>
            <span className="mp-dot mp-dot--int" />Internes <span className="mp-pill__n">{offers.length}</span>
          </button>
          {PARTNERS.map((p) => (
            <button type="button" key={p} className={'mp-pill' + (filter === p ? ' mp-pill--on' : '')} onClick={() => setFilter(p)}>
              <span className="mp-dot" style={{ background: PARTNER_COLOR[p] }} />{p} <span className="mp-pill__n">{counts[p]}</span>
            </button>
          ))}
        </div>
        <div className="mp__toggle" role="group" aria-label="Affichage">
          <button type="button" className={view === 'cards' ? 'on' : ''} aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={15} strokeWidth={2} /> Cartes</button>
          <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} strokeWidth={2} /> Liste</button>
        </div>
      </div>

      {loading ? (
        view === 'cards' ? (
          <div className="mp-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="mp-card" key={i}>
                <Skeleton variant="rectangular" height={138} sx={{ bgcolor: 'var(--hover)' }} />
                <div className="mp-card__body">
                  <Skeleton width="80%" height={18} /><Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={24} sx={{ mt: 1 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tbl mp-tbl">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={60} sx={{ bgcolor: 'var(--hover)' }} />)}</div>
        )
      ) : visible.length === 0 ? (
        <p className="mp-empty">Aucun service pour ce filtre.</p>
      ) : view === 'cards' ? (
        <div className="mp-grid">
          {pageItems.map((it) => (
            it.kind === 'partner' ? renderPartnerCard(it.e) : renderInternalCard(it.o)
          ))}
        </div>
      ) : (
        <div className="tbl mp-tbl">
          <div className="tbl__h">
            <span>Service</span><span>Source</span><span>Note</span><span>Prix</span><span>Commission</span><span />
          </div>
          {pageItems.map((it) => (
            it.kind === 'partner' ? renderPartnerRow(it.e) : renderInternalRow(it.o)
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={curPage}
            onChange={(_e, v) => setPage(v)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </section>
  );

  // ── Rendus d'item (déclarés après le return : hoisted) ──────────────────────
  function renderPartnerCard(e: MarketplaceExperience) {
    const Icon = e.icon;
    const color = PARTNER_COLOR[e.partner];
    return (
      <article
        key={e.id} className="mp-card" role="button" tabIndex={0} aria-label={e.title}
        onClick={() => setSelectedId(e.id)}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelectedId(e.id); } }}
      >
        <div className="mp-card__vis">
          {e.imageUrl ? <img src={e.imageUrl} alt="" /> : <Icon size={40} strokeWidth={1.5} style={{ color, opacity: 0.4 }} />}
          <span className="mp-pbadge mp-pbadge--over"><span className="mp-dot" style={{ background: color }} />{e.partner}</span>
          <span className="mp-rate"><Star size={12} className="mp-star" /> {e.rating}</span>
        </div>
        <div className="mp-card__body">
          <p className="mp-card__title">{e.title}</p>
          <p className="mp-card__desc">{e.desc}</p>
          <div className="mp-card__foot">
            <div className="mp-price">
              <span className="mp-price__v">{fmtEur(e.price)}</span> <span className="mp-faint">/ pers.</span>
              <span className="mp-comm">{e.commission}% de commission</span>
            </div>
            {addBtn(e)}
          </div>
        </div>
      </article>
    );
  }

  function renderInternalCard(o: UpsellOffer) {
    return (
      <article
        key={`int-${o.id}`} className="mp-card mp-card--int" role="button" tabIndex={0} aria-label={o.title}
        onClick={() => onOpenInternal(o)}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpenInternal(o); } }}
      >
        <div className="mp-card__vis mp-card__vis--int">
          <span className="mp-art"><ServiceArt type={o.type} /></span>
          <span className="mp-srcint mp-srcint--over">Interne</span>
          <span className={'mp-stat mp-stat--over ' + (o.active ? 'on' : 'off')}><span className="mp-stat__led" />{o.active ? 'Actif' : 'Inactif'}</span>
        </div>
        <div className="mp-card__body">
          <p className="mp-card__title">{o.title}</p>
          <p className="mp-card__desc">{typeLabel(o.type)}</p>
          <div className="mp-card__foot">
            <div className="mp-price"><span className="mp-price__v">{fmtPrice(o.price, o.currency)}</span></div>
            {menuBtn(o)}
          </div>
        </div>
      </article>
    );
  }

  function renderPartnerRow(e: MarketplaceExperience) {
    const Icon = e.icon;
    const color = PARTNER_COLOR[e.partner];
    return (
      <div
        key={e.id} className="row mp-row" role="button" tabIndex={0} aria-label={e.title}
        onClick={() => setSelectedId(e.id)}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelectedId(e.id); } }}
      >
        <span className="mp-row__exp">
          <span className="mp-row__vig" style={{ background: tint(color, 14) }}><Icon size={20} strokeWidth={2} style={{ color }} /></span>
          <span className="mp-row__txt"><b>{e.title}</b><small>{e.desc}</small></span>
        </span>
        <span className="mp-row__partner"><span className="mp-dot" style={{ background: color }} />{e.partner}</span>
        <span className="mp-row__note"><Star size={14} className="mp-star" /> {e.rating}</span>
        <span className="mp-row__price">{fmtEur(e.price)}</span>
        <span className="mp-comm">{e.commission}% de commission</span>
        {addBtn(e)}
      </div>
    );
  }

  function renderInternalRow(o: UpsellOffer) {
    const chans = [o.diffuseOnLivret && 'Livret', o.diffuseOnBooking && 'Booking'].filter(Boolean).join(' · ') || '—';
    return (
      <div
        key={`int-${o.id}`} className="row mp-row mp-row--int" role="button" tabIndex={0} aria-label={o.title}
        onClick={() => onOpenInternal(o)}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpenInternal(o); } }}
      >
        <span className="mp-row__exp">
          <span className="mp-row__vig mp-row__vig--int"><ServiceArt type={o.type} /></span>
          <span className="mp-row__txt"><b>{o.title}</b><small>{typeLabel(o.type)}</small></span>
        </span>
        <span className="mp-row__srcint">Interne</span>
        <span className={'mp-stat ' + (o.active ? 'on' : 'off')}><span className="mp-stat__led" />{o.active ? 'Actif' : 'Inactif'}</span>
        <span className="mp-row__price">{fmtPrice(o.price, o.currency)}</span>
        <span className="mp-row__chans">{chans}</span>
        {menuBtn(o)}
      </div>
    );
  }
}
