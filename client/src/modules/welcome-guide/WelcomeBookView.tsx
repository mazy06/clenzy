import React, { useEffect, useRef, useState } from 'react';
import {
  Wifi,
  KeyRound,
  Lock,
  DoorOpen,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Copy,
  Check,
  Star,
  ChevronLeft,
  ChevronRight,
  Phone,
  CalendarDays,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Ticket,
  Plus,
  Minus,
  X,
  Image as ImageIcon,
  ConciergeBell,
} from '../../icons/glyphs';
import './baitlyBookLayouts.css';
import './baitlyBookInformation.css';
import type {
  GuideActivity,
  GuidePoi,
  GuideSection,
  PublicGuideCheckIn,
  PublicGuidePractical,
  PublicGuideProperty,
  PublicGuideStay,
} from '../../services/api/welcomeGuideApi';
import type { PublicUpsell } from '../../services/api/upsellApi';
import { BaitlyGuideNeighbourhood, hasGuidePosition } from './BaitlyGuideNeighbourhood';
import { GuideMap, type GuideMapPin } from './GuideMap';
import { GuideDirections } from './GuideDirections';
import { injectWelcomeBookCss, normalizeTheme } from './welcomeBookThemes';
import { BaitlyBookArrivalLayout, BaitlyBookHomeLayout } from './BaitlyBookHomeLayout';
import { guideIcon } from './guideIcons';

export type Lang = 'fr' | 'en' | 'ar';

/** Libellés statiques (la page guest est standalone, pas i18next). */
export type GuideLabels = Record<string, string>;

/** Photo d'indication d'accès parsée ([{key, caption}]). */
export interface AccessPhoto {
  key: string;
  caption: string;
}

/** View-model normalisé du livret = données {@link PublicGuide} parsées. */
export interface WelcomeBookModel {
  structure?: string;
  title: string;
  welcomeMessage: string | null;
  hostNames: string | null;
  logoUrl: string | null;
  property: PublicGuideProperty | null;
  practical: PublicGuidePractical | null;
  stay: PublicGuideStay | null;
  checkIn: PublicGuideCheckIn | null;
  accessPhotos: AccessPhoto[];
  sections: GuideSection[];
  pois: GuidePoi[];
  activities: GuideActivity[];
  upsells: PublicUpsell[];
  guestbookEnabled: boolean;
  activitiesEnabled: boolean;
  upsellsEnabled: boolean;
}

export interface WelcomeBookViewProps {
  model: WelcomeBookModel;
  theme: string;
  lang: Lang;
  labels: GuideLabels;
  heroImages: string[];
  interactive?: boolean;
  /** Vignettes de thèmes : ne pas créer de contexte WebGL. */
  showMap?: boolean;
  /** Pilotage de l'aperçu (admin) : la navigation interne suit l'étape du formulaire. */
  previewFocus?: 'home' | 'content' | 'experiences';
  copiedKey?: string | null;
  onCopy?: (key: string, value: string) => void;
  onActivityClick?: (a: GuideActivity) => void;
  onUpsellClick?: (u: PublicUpsell) => void;
  onCheckinClick?: () => void;
  /** Ouvre la porte (serrure connectée) — résout true si le déverrouillage a réussi. */
  onUnlock?: () => Promise<boolean>;
  accessPhotoUrl?: (key: string) => string;
  langToggle?: React.ReactNode;
  /** Bloc livre d'or interactif injecté par la page guest (rendu dans la sous-page Avis). */
  guestbookSlot?: React.ReactNode;
  serviceTrackingSlot?: React.ReactNode;
  /** Calque additionnel rendu dans `.wb` (bouton + sheet concierge IA). */
  children?: React.ReactNode;
}

type View =
  | { name: 'home' }
  | { name: 'section'; id: string }
  | { name: 'arrival' }
  | { name: 'quartier' }
  | { name: 'services' }
  | { name: 'review' };

/* ───────────────────────── helpers ───────────────────────── */

function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Valide qu'une URL fournie par l'utilisateur (lien d'activité curée, lien de
 * check-in) est bien un lien web sûr avant de l'injecter dans un `href`.
 *
 * SECURITE (F4-GUEST-MONEY-01) : cette page guest est PUBLIQUE (/guide/:token)
 * et les liens viennent de données saisies par l'hôte. Sans contrôle du schéma,
 * un `javascript:alert(...)` dans `href` s'exécute au clic (XSS). On n'accepte
 * QUE `http:`/`https:` ; tout autre schéma (javascript:, data:, vbscript:…) ou
 * une URL non parsable renvoie `undefined` → le lien n'est pas rendu.
 */
function safeHttpUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : undefined;
  } catch {
    return undefined;
  }
}

function Stars({ value = 5, size = 15 }: { value?: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} strokeWidth={1.5} style={{ color: 'var(--gold)' }} fill={i < Math.round(value) ? 'var(--gold)' : 'transparent'} />
      ))}
    </span>
  );
}

/** Bouton de copie icône seule (label en aria-label uniquement). */
function CopyChip({ label, value, copyKey, copiedKey, onCopy, interactive }: {
  label: string; value: string; copyKey: string; copiedKey?: string | null;
  onCopy?: (key: string, value: string) => void; interactive?: boolean;
}) {
  const copied = copiedKey === copyKey;
  return (
    <button
      type="button"
      className="wb-pressable wb-copy"
      onClick={() => interactive && onCopy?.(copyKey, value)}
      aria-label={label}
      style={{ ...copyChipBaseStyle, background: copied ? 'var(--terra)' : 'var(--terra-bg)', color: copied ? 'var(--on-terra)' : 'var(--terra-deep)', cursor: interactive ? 'pointer' : 'default' }}
    >
      {copied ? <Check size={17} strokeWidth={2} /> : <Copy size={17} strokeWidth={1.75} />}
    </button>
  );
}

function WarmBlock({ label, children, delay = 0, region = 'notes' }: { label: string; children: React.ReactNode; delay?: number; region?: 'checkin' | 'notes' | 'contact' }) {
  return (
    <div className="wb-card wb-rise wb-info-block" data-book-region={region} style={{ animationDelay: `${delay}s` }}>
      <h3 className="wb-info-block__label">{label}</h3>
      {children}
    </div>
  );
}

const PARA: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' };

const copyChipBaseStyle: React.CSSProperties = {
  flexShrink: 0, width: 44, height: 44, borderRadius: 10, border: '1px solid var(--terra-soft)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const detailHeaderBackButtonStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--raised)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0, cursor: 'pointer',
};

const lightboxCloseButtonStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', right: 16, width: 40, height: 40,
  borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const lightboxCounterStyle: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 22px)', left: 0, right: 0, textAlign: 'center',
  color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
};

const heroDotsRowStyle: React.CSSProperties = {
  position: 'absolute', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, pointerEvents: 'none',
};

const featuredBadgeStyle: React.CSSProperties = {
  position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,.92)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink)',
};

const cardDescStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 9, lineHeight: 1.4,
  overflowWrap: 'anywhere', whiteSpace: 'pre-line',
};

const rateStayButtonStyle: React.CSSProperties = {
  border: '1.5px solid var(--terra-soft)', background: 'transparent', borderRadius: 18, padding: '15px 16px',
  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
};

const accessPhotoBadgeStyle: React.CSSProperties = {
  position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 999, background: 'var(--terra)',
  color: '#FFF6EF', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** En-tête de sous-page solidaire du thème du livret. */
function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="wb-detail-header">
      <div className="wb-detail-header__inner">
        <button type="button" className="wb-pressable" onClick={onBack} aria-label="Retour"
          style={detailHeaderBackButtonStyle}>
          <ArrowLeft size={19} strokeWidth={1.7} />
        </button>
        <h2 className="wb-h2" style={{ fontSize: 22, margin: 0 }}>{title}</h2>
      </div>
    </div>
  );
}

function GIcon({ name, size = 20, color = 'var(--terra-deep)' }: { name: string; size?: number; color?: string }) {
  const Icon = guideIcon(name);
  return <Icon size={size} strokeWidth={1.6} style={{ color }} />;
}

/* ───────── Hero carousel + lightbox (inchangés) ───────── */

const navBtn = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute', top: '50%', [side]: 12, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: 999,
  border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});

function HeroLightbox({ images, index, setIndex, onClose, labels, imageAlt }: {
  images: string[]; index: number; setIndex: React.Dispatch<React.SetStateAction<number>>; onClose: () => void;
  labels: GuideLabels;
  imageAlt: string;
}) {
  const touchX = useRef<number | null>(null);
  const go = (dir: number) => setIndex((i) => (i + dir + images.length) % images.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);
  return (
    <div onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,12,8,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={images[index]} alt={imageAlt} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '94%', maxHeight: '86%', objectFit: 'contain', borderRadius: 12 }} />
      <button type="button" onClick={onClose} aria-label={labels.galleryClose} style={lightboxCloseButtonStyle}>
        <X size={20} strokeWidth={1.9} />
      </button>
      {images.length > 1 ? (
        <>
          <button type="button" aria-label={labels.galleryPrev} onClick={(e) => { e.stopPropagation(); go(-1); }} style={navBtn('left')}><ChevronLeft className="cn-rtl-flip" size={22} strokeWidth={1.9} /></button>
          <button type="button" aria-label={labels.galleryNext} onClick={(e) => { e.stopPropagation(); go(1); }} style={navBtn('right')}><ChevronRight className="cn-rtl-flip" size={22} strokeWidth={1.9} /></button>
          <div style={lightboxCounterStyle}>{index + 1} / {images.length}</div>
        </>
      ) : null}
    </div>
  );
}

function HeroCarousel({ images, interactive, children, labels, shade = true, imageAlt = '' }: { images: string[]; interactive: boolean; children: React.ReactNode; labels: GuideLabels; shade?: boolean; imageAlt?: string }) {
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const touchX = useRef<number | null>(null);
  const safeIdx = images.length ? idx % images.length : 0;
  useEffect(() => {
    if (!interactive || images.length <= 1 || full || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % images.length), 4500);
    return () => window.clearInterval(id);
  }, [images.length, full, interactive]);
  const go = (dir: number) => images.length && setIdx((i) => (i + dir + images.length) % images.length);
  const tappable = interactive && images.length > 0;
  return (
    <div
      className="wb-cover__photo"
      onClick={tappable ? () => setFull(true) : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFull(true); } } : undefined}
      role={tappable ? 'button' : undefined}
      aria-label={tappable ? labels.galleryOpen : undefined}
      tabIndex={tappable ? 0 : undefined}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null || images.length <= 1) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}
      style={{ cursor: tappable ? 'pointer' : 'default' }}
    >
      {images.length > 0 ? (
        images.map((src, i) => (
          <img key={i} src={src} alt={imageAlt} aria-hidden={i !== safeIdx} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: i === safeIdx ? 1 : 0, transition: 'opacity .6s ease' }} />
        ))
      ) : (
        <div className="wb-cover__missing"><ImageIcon size={32} /><span>{labels.photoMissing}</span></div>
      )}
      {shade && images.length ? <div className="wb-cover__shade" /> : null}
      {images.length > 1 ? (
        <div style={heroDotsRowStyle}>
          {images.map((_, i) => (
            <span key={i} style={{ width: i === safeIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === safeIdx ? '#FFF6EF' : 'rgba(255,246,239,.5)', transition: 'width .3s, background-color .3s' }} />
          ))}
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>
      {full ? <HeroLightbox images={images} index={safeIdx} setIndex={setIdx} onClose={() => setFull(false)} labels={labels} imageAlt={imageAlt} /> : null}
    </div>
  );
}

/** The public book and every studio thumbnail share these actual cover compositions. */
function BaitlyBookCover({ model, theme, images, interactive, labels, greeting, lang, langToggle }: {
  model: WelcomeBookModel; theme: string; images: string[]; interactive: boolean;
  labels: GuideLabels; greeting: string; lang: Lang; langToggle?: React.ReactNode;
}) {
  const themeId = normalizeTheme(theme);
  const floating = themeId === 'minuit';
  const collage = ['atelier', 'corail'].includes(themeId) && images.length > 1;
  const caption = <div className="wb-cover__caption">
    <p className="wb-cover__greeting">{greeting}</p>
    <h1 className="wb-cover__title">{model.title}</h1>
    {model.property?.city ? <p className="wb-cover__location"><MapPin size={14} />{model.property.city}</p> : null}
    {model.stay?.checkIn ? <p className="wb-cover__dates">{formatDate(model.stay.checkIn, lang)}{model.stay.checkOut ? ` · ${formatDate(model.stay.checkOut, lang)}` : ''}</p> : null}
  </div>;
  return <header className="wb-cover" data-photo={images.length > 0} data-collage={collage}>
    {model.logoUrl || langToggle ? <div className="wb-cover__toolbar">
      {model.logoUrl ? <img src={model.logoUrl} alt="" /> : <span />}{langToggle}
    </div> : null}
    <HeroCarousel images={images} interactive={interactive} labels={labels} shade={floating} imageAlt={model.property?.name || model.title}>
      {floating ? caption : null}
    </HeroCarousel>
    {!floating ? caption : null}
    {collage ? <div className="wb-cover__contact-sheet" aria-hidden="true">
      {images.slice(1, 3).map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
    </div> : null}
  </header>;
}

/* ───────────────────────── sub-pages ───────────────────────── */

/** Sous-page d'une section éditoriale : rendu selon le layout. */
function SectionPage({ section, theme, onBack }: { section: GuideSection; theme: string; onBack: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const disclosure = ['noir', 'azur', 'minuit'].includes(normalizeTheme(theme));
  const uid = React.useId();
  return <div className="wb__scroll">
    <DetailHeader title={section.title} onBack={onBack} />
    <div className="wb-editorial" data-layout={section.layout}>
      {section.layout === 'text' ? <div className="wb-editorial__prose">{section.body}</div> : null}
      {section.layout === 'steps' ? <div className="wb-editorial__chapters">
        {section.items.map((item, i) => {
          const open = !disclosure || openIdx === i;
          const heading = <><span className="wb-editorial__number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <GIcon name={item.icon} size={21} /><span className="wb-editorial__title">{item.label}</span></>;
          return <section className="wb-editorial__chapter" key={item.id} data-expanded={open}>
            {disclosure ? <h3 className="wb-editorial__heading"><button type="button" aria-expanded={open} aria-controls={`${uid}-${i}`}
              className="wb-editorial__toggle" onClick={() => setOpenIdx(open ? null : i)}>{heading}{open ? <Minus size={18} /> : <Plus size={18} />}</button></h3>
              : <h3 className="wb-editorial__heading">{heading}</h3>}
            {open ? <div id={`${uid}-${i}`} className="wb-editorial__chapter-body">
              {item.detail ? <p className="wb-editorial__detail">{item.detail}</p> : null}
              <ol className="wb-editorial__steps">{item.steps.map((step, si) => <li key={si}>
                <span className="wb-editorial__step-number" aria-hidden="true">{si + 1}</span><span>{step}</span>
              </li>)}</ol>
            </div> : null}
          </section>;
        })}
      </div> : null}
      {section.layout === 'rules' || section.layout === 'list' ? <div className="wb-editorial__items">
        {section.items.map((item, i) => <article className="wb-editorial__item" key={item.id}>
          <span className="wb-editorial__number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <GIcon name={item.icon} size={21} /><div><h3>{item.label}</h3>
            {item.detail ? <p>{item.detail}</p> : null}
            {item.steps?.length ? <ul>{item.steps.map((step, index) => <li key={index}>{step}</li>)}</ul> : null}
          </div>
        </article>)}
      </div> : null}
      {section.layout !== 'text' && section.body ? <div className="wb-editorial__prose">{section.body}</div> : null}
    </div>
  </div>;
}

const WelcomeBookView: React.FC<WelcomeBookViewProps> = ({
  model, theme, lang, labels: L, heroImages, interactive = true, showMap = true, previewFocus, copiedKey, onCopy,
  onActivityClick, onUpsellClick, onCheckinClick, onUnlock, accessPhotoUrl, langToggle, guestbookSlot, serviceTrackingSlot, children,
}) => {
  injectWelcomeBookCss();
  const [view, setView] = useState<View>({ name: 'home' });
  // Bouton « Ouvrir la porte » : anti double-clic + feedback succès/échec (retombe sur idle).
  const [unlockState, setUnlockState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { property, practical, stay, checkIn, sections, pois, activities, upsells } = model;
  const goHome = () => setView({ name: 'home' });

  const handleUnlock = async () => {
    if (!interactive || !onUnlock || unlockState === 'pending') return;
    setUnlockState('pending');
    const ok = await onUnlock();
    setUnlockState(ok ? 'done' : 'error');
    setTimeout(() => setUnlockState('idle'), 4000);
  };

  // Tags personnalisables dans le mot d'accueil, substitués au rendu (aperçu hôte + page guest) :
  // {prénom} → prénom du voyageur, {nom} → nom complet, chargés depuis la réservation via le token.
  const guestFullName = (stay?.guestName || '').trim();
  const welcomeMessage = (model.welcomeMessage?.trim() || '')
    .replace(/\{pr[ée]nom\}/gi, guestFullName.split(/\s+/)[0] || '')
    .replace(/\{nom\}/gi, guestFullName);
  const editorialSections = sections.filter((s) => s.title || s.body || s.items.length);

  // Aperçu piloté par l'éditeur : la navigation interne suit l'étape du formulaire.
  const homeScrollRef = useRef<HTMLDivElement | null>(null);
  const expRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!previewFocus) return; // mode guest interactif → navigation libre
    if (previewFocus === 'content') {
      if (editorialSections.length) setView({ name: 'section', id: editorialSections[0].id });
      else if (pois.length) setView({ name: 'quartier' });
      else setView({ name: 'home' });
      return;
    }
    // 'home' / 'experiences' → écran d'accueil, puis défilement vers la bonne zone.
    setView({ name: 'home' });
    const timer = setTimeout(() => {
      const container = homeScrollRef.current;
      if (!container) return;
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const top = previewFocus === 'experiences' && expRef.current
        ? Math.max(0, expRef.current.offsetTop - 12)
        : 0;
      container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    }, 70);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFocus, editorialSections.length, pois.length]);

  // Essentiels (accueil).
  const hasWifi = !!practical?.wifiName || !!practical?.wifiPassword;
  const checkInTime = stay?.checkInTime || null;
  const checkOutTime = stay?.checkOutTime || null;
  const doorCode = practical?.accessCode || null;
  // Code d'accès verrouillé : un code existe mais il est masqué tant qu'on est avant l'heure
  // de check-in (le backend ne l'envoie pas). On affiche un cadenas à la place.
  const codeLocked = !!practical?.accessCodeLocked;
  // Codes additionnels libres (résidence, immeuble, parking…).
  const extraCodes: Array<{ label: string; code: string }> = (() => {
    try {
      const arr = practical?.extraCodes ? JSON.parse(practical.extraCodes) : [];
      return Array.isArray(arr)
        ? arr.flatMap((x: { label?: string; code?: string }) =>
            x && (x.label || x.code) ? [{ label: x.label || '', code: x.code || '' }] : [],
          )
        : [];
    } catch {
      return [];
    }
  })();
  // Accueil personnalisé : prénom du voyageur chargé depuis la réservation (via le token).
  const guestFirstName = (stay?.guestName || '').trim().split(/\s+/)[0] || '';
  const heroGreeting = guestFirstName ? `${L.welcome}, ${guestFirstName}` : L.welcome;
  const tiles: Array<{ icon: React.ReactNode; label: string; value: string; mono?: boolean; locked?: boolean }> = [];
  if (checkInTime) tiles.push({ icon: <LogIn size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.arrival, value: checkInTime });
  if (checkOutTime) tiles.push({ icon: <LogOut size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.departure, value: checkOutTime });
  if (doorCode) tiles.push({ icon: <KeyRound size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.accessCode, value: doorCode, mono: true });
  else if (codeLocked) tiles.push({ icon: <KeyRound size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.accessCode, value: '', locked: true });
  const hasEssentials = hasWifi || tiles.length > 0;

  // Localisation.
  const addressLine = property ? [property.address, property.postalCode, property.city, property.country].filter(Boolean).join(', ') : '';
  const propLat = property?.latitude ?? null;
  const propLng = property?.longitude ?? null;
  const hasLocation = (propLat != null && propLng != null) || !!addressLine;

  // L'arrivée cadre uniquement le logement ; le quartier cadre ses propres lieux.
  const mapCenter: [number, number] | null = hasGuidePosition(propLat, propLng) ? [propLng!, propLat!] : null;
  const mapPins: GuideMapPin[] = mapCenter ? [{ id: '__home', lat: propLat!, lng: propLng!, color: 'var(--terra-deep)',
    icon: 'home', label: property?.name || model.title }] : [];

  const accessPhotos = accessPhotoUrl ? model.accessPhotos : [];
  const practicalBlocks: Array<{ label: string; value: string }> = [];
  if (practical?.arrivalInstructions) practicalBlocks.push({ label: L.arrivalInstr, value: practical.arrivalInstructions });
  if (practical?.departureInstructions) practicalBlocks.push({ label: L.departureInstr, value: practical.departureInstructions });
  if (practical?.parkingInfo) practicalBlocks.push({ label: L.parking, value: practical.parkingInfo });
  if (practical?.houseRules) practicalBlocks.push({ label: L.houseRules, value: practical.houseRules });
  if (practical?.additionalNotes) practicalBlocks.push({ label: L.notes, value: practical.additionalNotes });

  const hasArrival = !!(checkInTime || checkOutTime || doorCode || codeLocked || extraCodes.length || addressLine || accessPhotos.length || practicalBlocks.length || checkIn || practical?.emergencyContact);

  // Entrées de navigation « Explorer le livret ».
  type Nav = { key: string; icon: string; title: string; subtitle: string; go: () => void };
  const navEntries: Nav[] = [];
  if (hasArrival) navEntries.push({ key: 'arrival', icon: 'key-round', title: `${L.arrival} & ${L.departure}`, subtitle: L.directions, go: () => setView({ name: 'arrival' }) });
  editorialSections.forEach((s) => navEntries.push({ key: s.id, icon: s.icon || 'file-text', title: s.title || '—', subtitle: s.subtitle, go: () => setView({ name: 'section', id: s.id }) }));
  if (pois.length > 0) navEntries.push({ key: 'quartier', icon: 'map', title: L.neighbourhood, subtitle: L.aroundMe, go: () => setView({ name: 'quartier' }) });

  const activeSection = view.name === 'section' ? sections.find((s) => s.id === view.id) : undefined;

  /* ───────── HOME ───────── */
  const home = (
    <div className="wb__scroll" ref={homeScrollRef}>
      <BaitlyBookCover model={model} theme={theme} images={heroImages} interactive={interactive}
        labels={L} greeting={heroGreeting} lang={lang} langToggle={langToggle} />

      {/* Chaque parcours donne la priorité à une action et une composition différentes. */}
      <BaitlyBookHomeLayout theme={theme} structure={model.structure}>
        {pois.length > 0 || (model.structure === 'cityguide' && hasLocation) ? (
          <BaitlyGuideNeighbourhood key={property?.name} property={property} pois={pois} theme={theme} lang={lang} labels={L}
            interactive={interactive} compact renderMap={showMap} onExplore={() => setView({ name: 'quartier' })} />
        ) : null}
        {model.structure === 'longue' && editorialSections.length ? (
          <section className="wb-journey wb-journey--longue" data-book-region="journey">
            <h2>{L.dailyLiving}</h2>
            <ol>{editorialSections[0].items.slice(0, 3).map((item) => <li key={item.id}><GIcon name={item.icon} size={20} /><span>{item.label}</span></li>)}</ol>
            <button type="button" onClick={() => setView({ name: 'section', id: editorialSections[0].id })}>{L.explore}<ArrowRight size={16} /></button>
          </section>
        ) : null}
        {model.structure === 'conciergerie' ? (
          <section className="wb-journey wb-journey--conciergerie" data-book-region="journey">
            <ConciergeBell size={29} /><h2>{model.hostNames || L.conciergeTitle}</h2>
            <p>{L.conciergeHint}</p>
            {hasArrival ? <button type="button" onClick={() => setView({ name: 'arrival' })}><Phone size={17} />{L.contactHost}</button> : null}
          </section>
        ) : null}
        {/* Note d'accueil */}
        {welcomeMessage ? (
          <div className="wb-home__welcome" data-book-region="welcome">
            <div className="wb-host-initial" aria-hidden="true">
              {(model.hostNames || property?.name || model.title || 'B').trim().charAt(0).toUpperCase()}
            </div>
            <div>
              {model.hostNames ? <div className="wb-host-name">{model.hostNames}</div> : null}
              <div className="wb-host-note">{welcomeMessage}</div>
            </div>
          </div>
        ) : null}

        {/* Essentiels */}
        {hasEssentials ? (
          <section className="wb-card wb-home__essentials" data-book-region="essentials">
            <h2 className="wb-section-heading">{L.essentials}</h2>
            <div className="wb-essential-details">
              {hasWifi ? (
                <>
                  <div className="wb-wifi">
                    <div className="wb-wifi__identity">
                      <Wifi className="wb-wifi__icon" size={22} strokeWidth={1.5} />
                      <div style={{ minWidth: 0 }}>
                        <div className="wb-label">{practical?.wifiName ? `${L.network} · WiFi` : 'WiFi'}</div>
                        <div className="wb-wifi__name">{practical?.wifiName || practical?.wifiPassword}</div>
                        {practical?.wifiName && practical?.wifiPassword ? (
                          <div className="wb-wifi__password">{L.password} · <span>{practical.wifiPassword}</span></div>
                        ) : null}
                      </div>
                    </div>
                    {practical?.wifiPassword ? <CopyChip label={copiedKey === 'wifi' ? L.copied : L.copy} value={practical.wifiPassword} copyKey="wifi" copiedKey={copiedKey} onCopy={onCopy} interactive={interactive} /> : null}
                  </div>
                </>
              ) : null}
              {tiles.length > 0 ? (
                <dl className="wb-stay-facts">
                  {tiles.map((t) => (
                    <div key={t.label} className="wb-stay-fact" data-code={t.mono || undefined}>
                      {t.icon}
                      <dt className="wb-stay-fact__label">{t.label}</dt>
                      {t.locked ? (
                        <dd style={{ margin: 0, color: 'var(--ink-soft)' }}><Lock size={16} strokeWidth={1.9} /></dd>
                      ) : (
                        <dd className="wb-stay-fact__value" style={{ letterSpacing: t.mono ? '.08em' : 0 }}>{t.value}</dd>
                      )}
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Explorer le livret */}
        {navEntries.length > 0 ? (
          <div className="wb-rise wb-home__navigation" data-book-region="navigation" style={{ animationDelay: '.1s' }}>
            <h2 className="wb-section-heading">{L.explore}</h2>
            <div className="wb-card wb-nav-items" style={{ overflow: 'hidden' }}>
              {navEntries.map((n, index) => (
                <button key={n.key} type="button" className="wb-pressable wb-nav-entry" onClick={n.go}>
                  <span className="wb-nav-entry__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div className="wb-nav-entry__icon"><GIcon name={n.icon} size={21} /></div>
                  <div className="wb-nav-entry__text">
                    <div className="wb-nav-entry__title">{n.title}</div>
                    {n.subtitle ? <div className="wb-nav-entry__subtitle">{n.subtitle}</div> : null}
                  </div>
                  <ChevronRight size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Marketplace */}
        {model.activitiesEnabled && activities.length > 0 ? (
          <div className="wb-rise wb-home__experiences" data-book-region="experiences" style={{ animationDelay: '.15s' }} ref={expRef}>
            <div style={{ padding: '6px 4px 12px' }}>
              <div className="wb-eyebrow">{L.marketplace}</div>
              <div className="wb-h2" style={{ fontSize: 21, marginTop: 4 }}>{L.activitiesTitle}</div>
            </div>
            <div className="wb-offers">
              {activities.map((a) => {
                const card = (
                  <div className="wb-card wb-offer__card">
                    <div className="wb-offer__photo">
                      {a.imageUrl ? <img src={a.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Ticket size={38} strokeWidth={1.4} style={{ color: 'rgba(255,255,255,.92)' }} />}
                      {a.featured ? (
                        <div style={featuredBadgeStyle}>
                          <Star size={11} style={{ color: 'var(--gold)' }} fill="var(--gold)" /> {L.featured}
                        </div>
                      ) : null}
                    </div>
                    <div className="wb-offer__body">
                      <div className="wb-serif" style={{ fontSize: 18, lineHeight: 1.14, marginBottom: 8, color: 'var(--ink)' }}>{a.title}</div>
                      {a.description ? <div style={cardDescStyle}>{a.description}</div> : null}
                      <div className="wb-offer__actions">
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{a.price || ''}</div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--terra-deep)', fontWeight: 700, fontSize: 12.5 }}>{L.book} <ArrowRight size={14} strokeWidth={1.8} /></span>
                      </div>
                    </div>
                  </div>
                );
                // F4-GUEST-MONEY-01 : lien curé par l'hôte → n'autoriser que http(s),
                // sinon pas de lien (évite javascript:/data: dans href sur cette page publique).
                const bookingUrl = safeHttpUrl(a.bookingUrl);
                return (
                  <div key={a.id} className="wb-offer">
                    {bookingUrl ? (
                      <a href={interactive ? bookingUrl : undefined} target="_blank" rel="noopener noreferrer" onClick={() => interactive && onActivityClick?.(a)} style={{ textDecoration: 'none', display: 'block', height: '100%', cursor: interactive ? 'pointer' : 'default' }}>{card}</a>
                    ) : card}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Services à la carte — inline, présenté comme le marketplace */}
        {serviceTrackingSlot}
        {model.upsellsEnabled && upsells.length > 0 ? (
          <div className="wb-rise wb-home__services" data-book-region="services" style={{ animationDelay: '.18s' }}>
            <div style={{ padding: '6px 4px 12px' }}>
              <div className="wb-eyebrow">{L.marketplace}</div>
              <div className="wb-h2" style={{ fontSize: 21, marginTop: 4 }}>{L.upsellsTitle}</div>
            </div>
            <div className="wb-offers">
              {upsells.map((u) => (
                <div key={u.offerId} className="wb-offer">
                  <div className="wb-card wb-offer__card">
                    <div className="wb-offer__photo">
                      {u.imageUrl ? <img src={u.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Sparkles size={36} strokeWidth={1.4} style={{ color: 'rgba(255,255,255,.92)' }} />}
                    </div>
                    <div className="wb-offer__body">
                      <div className="wb-serif" style={{ fontSize: 18, lineHeight: 1.14, marginBottom: 8, color: 'var(--ink)' }}>{u.title}</div>
                      {u.description ? <div style={cardDescStyle}>{u.description}</div> : null}
                      {u.bundleItems.length > 0 ? (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 9, lineHeight: 1.35 }}>
                          <span style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>{L.included} :</span> {u.bundleItems.join(', ')}
                        </div>
                      ) : null}
                      <div className="wb-offer__actions">
                        <div style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{u.price.toFixed(2)} {u.currency}</div>
                        <button type="button" className="wb-btn wb-btn--soft wb-pressable" onClick={() => interactive && onUpsellClick?.(u)} style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 12, cursor: interactive ? 'pointer' : 'default' }}>{L.payCta}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Noter mon séjour */}
        {model.guestbookEnabled ? (
          <button type="button" className="wb-pressable" data-book-region="review" onClick={() => setView({ name: 'review' })}
            style={rateStayButtonStyle}>
            <Stars value={5} size={16} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{L.rateStay}</div></div>
            <ChevronRight size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
          </button>
        ) : null}

        {/* Footer */}
        <div data-book-region="footer" style={{ textAlign: 'center', padding: '14px 0 4px', color: 'var(--ink-faint)' }}>
          {property?.name ? <div className="wb-serif" style={{ fontSize: 19, color: 'var(--ink-soft)' }}>{property.name}</div> : null}
          <div style={{ fontSize: 11, marginTop: 6, letterSpacing: '.04em' }}>{L.poweredBy} · <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink-soft)' }}>baitly.</span></div>
        </div>
      </BaitlyBookHomeLayout>
    </div>
  );

  /* ───────── ARRIVAL ───────── */
  const arrival = (
    <div className="wb__scroll">
      <DetailHeader title={`${L.arrival} & ${L.departure}`} onBack={goHome} />
      <BaitlyBookArrivalLayout theme={theme}>
        {checkInTime || checkOutTime ? (
          <div className="wb-arrival__times">
            {[[L.arrival, checkInTime, <LogIn key="i" size={20} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />], [L.departure, checkOutTime, <LogOut key="o" size={20} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />]]
              .filter((x) => x[1])
              .map((x, i) => (
                <div key={i} className="wb-card wb-arrival__time">
                  {x[2] as React.ReactNode}
                  <div className="wb-serif wb-arrival__time-value">{x[1] as string}</div>
                  <div className="wb-label" style={{ marginTop: 2 }}>{x[0] as string}</div>
                </div>
              ))}
          </div>
        ) : null}

        {addressLine || mapCenter ? (
          <div className="wb-card wb-arrival__address">
            {showMap && mapCenter ? <GuideMap center={mapCenter} pins={mapPins} height={170} lang={lang} labels={L}
              mode={['noir', 'minuit'].includes(normalizeTheme(theme)) ? 'dark' : 'light'} interactive={false} /> : null}
            <div className="wb-arrival__address-body">
              <div style={{ minWidth: 0 }}>
                <div className="wb-label" style={{ marginBottom: 3 }}>{L.address}</div>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{addressLine}</div>
              </div>
              {hasLocation ? <GuideDirections target={{ lat: propLat, lng: propLng, address: addressLine }} labels={L} interactive={interactive} className="wb-btn wb-btn--soft wb-pressable" style={{ padding: '10px 14px', fontSize: 13, borderRadius: 13 }}><Navigation size={16} strokeWidth={1.7} /> {L.viewMap}</GuideDirections> : null}
            </div>
          </div>
        ) : null}

        {(doorCode || codeLocked) ? (
          <div className="wb-card wb-arrival__code">
            <div style={{ minWidth: 0 }}>
              <div className="wb-label" style={{ marginBottom: 3 }}>{L.accessCode}</div>
              {codeLocked ? (
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={17} strokeWidth={1.8} />
                  <span>{checkInTime ? `${L.accessCodeLockedFrom} ${checkInTime}` : L.accessCodeLocked}</span>
                </div>
              ) : (
                <div className="wb-arrival__code-value">{doorCode}</div>
              )}
            </div>
            {!codeLocked && doorCode ? (
              <CopyChip label={copiedKey === 'door' ? L.copied : L.copy} value={doorCode} copyKey="door" copiedKey={copiedKey} onCopy={onCopy} interactive={interactive} />
            ) : null}
          </div>
        ) : null}

        {practical?.guestUnlockAvailable && onUnlock ? (
          <button
            type="button"
            className="wb-btn wb-pressable" data-book-region="unlock"
            onClick={handleUnlock}
            disabled={unlockState === 'pending'}
            style={{
              width: '100%', justifyContent: 'center', cursor: interactive ? 'pointer' : 'default',
              opacity: unlockState === 'pending' ? 0.7 : 1,
              ...(unlockState === 'done' ? { background: 'var(--terra-deep)' } : null),
            }}
          >
            {unlockState === 'done' ? <Check size={18} strokeWidth={2} /> : <DoorOpen size={18} strokeWidth={1.8} />}
            {unlockState === 'pending' ? L.doorUnlocking
              : unlockState === 'done' ? L.doorUnlocked
              : unlockState === 'error' ? L.doorUnlockError
              : L.doorUnlock}
          </button>
        ) : null}

        {extraCodes.map((ec, i) => (
          <div key={`ec-${i}`} className="wb-card wb-arrival__code">
            <div style={{ minWidth: 0 }}>
              <div className="wb-label" style={{ marginBottom: 3 }}>{ec.label}</div>
              <div className="wb-arrival__code-value">{ec.code}</div>
            </div>
            {ec.code ? (
              <CopyChip label={copiedKey === `ec-${i}` ? L.copied : L.copy} value={ec.code} copyKey={`ec-${i}`} copiedKey={copiedKey} onCopy={onCopy} interactive={interactive} />
            ) : null}
          </div>
        ))}

        {checkIn ? (
          <WarmBlock label={L.checkinTitle} region="checkin">
            {checkIn.status === 'COMPLETED' ? (
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--terra-deep)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} strokeWidth={2} /> {L.checkinDone}</div>
            ) : (() => {
              // F4-GUEST-MONEY-01 : le lien de check-in vient de données métier →
              // n'autoriser que http(s) dans href (pas de javascript:/data:). Si le
              // lien est absent/invalide, on rend la CTA en span non cliquable.
              const checkinUrl = safeHttpUrl(checkIn.link);
              return checkinUrl ? (
                <a href={interactive ? checkinUrl : undefined} target="_blank" rel="noopener noreferrer" onClick={() => interactive && onCheckinClick?.()} className="wb-btn wb-pressable" style={{ textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}>{L.checkinCta} <ArrowUpRight size={18} strokeWidth={1.8} /></a>
              ) : (
                <span className="wb-btn" style={{ textDecoration: 'none', opacity: 0.6, cursor: 'default' }}>{L.checkinCta} <ArrowUpRight size={18} strokeWidth={1.8} /></span>
              );
            })()}
          </WarmBlock>
        ) : null}

        {accessPhotos.length > 0 && accessPhotoUrl ? (
          <div data-book-region="photos">
            <div className="wb-label" style={{ padding: '2px 4px 10px' }}>{L.directions}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {accessPhotos.map((p, i) => (
                <div key={p.key} className="wb-card" style={{ padding: 13, display: 'flex', gap: 13, alignItems: 'center', background: 'var(--raised)' }}>
                  <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                    <img src={accessPhotoUrl(p.key)} alt={p.caption || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={accessPhotoBadgeStyle}>{i + 1}</span>
                  </div>
                  <div className="wb-arrival__photo-caption">{p.caption || ''}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {practicalBlocks.map((b) => (<WarmBlock key={b.label} label={b.label}><div style={PARA}>{b.value}</div></WarmBlock>))}

        {practical?.emergencyContact ? (
          <WarmBlock label={L.useful} region="contact">
            <a href={interactive ? `tel:${practical.emergencyContact}` : undefined} className="wb-pressable" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--terra-deep)', textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}><Phone size={16} strokeWidth={1.7} /> {practical.emergencyContact}</a>
          </WarmBlock>
        ) : null}
      </BaitlyBookArrivalLayout>
    </div>
  );

  /* ───────── QUARTIER ───────── */
  const quartier = (
    <div className="wb__scroll">
      <DetailHeader title={L.neighbourhood} onBack={goHome} />
      <BaitlyGuideNeighbourhood key={property?.name} property={property} pois={pois} theme={theme} lang={lang}
        labels={L} interactive={interactive} renderMap={showMap} />
    </div>
  );

  /* ───────── REVIEW ───────── */
  const review = (
    <div className="wb__scroll">
      <DetailHeader title={L.rateStay} onBack={goHome} />
      <div style={{ padding: '18px 18px 130px' }}>
        {guestbookSlot ?? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--ink-faint)' }}>
            <Stars value={5} size={30} />
            <div className="wb-lead" style={{ marginTop: 16 }}>{L.reviewSub}</div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="wb" data-theme={normalizeTheme(theme)} data-structure={model.structure || 'complet'} dir={dir}>
      {view.name === 'home' && home}
      {view.name === 'section' && activeSection ? <SectionPage section={activeSection} theme={theme} onBack={goHome} /> : null}
      {view.name === 'section' && !activeSection ? home : null}
      {view.name === 'arrival' && arrival}
      {view.name === 'quartier' && quartier}
      {view.name === 'review' && review}
      {children}
    </div>
  );
};

export default WelcomeBookView;
