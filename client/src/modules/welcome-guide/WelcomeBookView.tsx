import React, { useEffect, useRef, useState } from 'react';
import {
  Wifi,
  KeyRound,
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
  Footprints,
  Ticket,
  Plus,
  Minus,
  X,
} from 'lucide-react';
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
import { POI_CATEGORIES, poiCategory, poiLabel } from './poiCatalog';
import { GuideMap, type GuideMapPin } from './GuideMap';
import { injectWelcomeBookCss, normalizeTheme } from './welcomeBookThemes';
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
  /** Pilotage de l'aperçu (admin) : la navigation interne suit l'étape du formulaire. */
  previewFocus?: 'home' | 'content' | 'experiences';
  copiedKey?: string | null;
  onCopy?: (key: string, value: string) => void;
  onActivityClick?: (a: GuideActivity) => void;
  onUpsellClick?: (u: PublicUpsell) => void;
  onCheckinClick?: () => void;
  accessPhotoUrl?: (key: string) => string;
  langToggle?: React.ReactNode;
  /** Bloc livre d'or interactif injecté par la page guest (rendu dans la sous-page Avis). */
  guestbookSlot?: React.ReactNode;
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

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
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
      className="wb-pressable"
      onClick={() => interactive && onCopy?.(copyKey, value)}
      aria-label={label}
      style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: '1px solid var(--terra-soft)', background: copied ? 'var(--terra)' : 'var(--terra-bg)', color: copied ? '#FFF6EF' : 'var(--terra-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: interactive ? 'pointer' : 'default' }}
    >
      {copied ? <Check size={17} strokeWidth={2} /> : <Copy size={17} strokeWidth={1.75} />}
    </button>
  );
}

function WarmBlock({ label, children, delay = 0 }: { label: string; children: React.ReactNode; delay?: number }) {
  return (
    <div className="wb-card wb-rise" style={{ padding: 16, animationDelay: `${delay}s` }}>
      <div className="wb-label" style={{ color: 'var(--terra-deep)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

const PARA: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)', whiteSpace: 'pre-line' };

/** En-tête de sous-page : back-arrow rond + titre serif (sticky translucide). */
function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in srgb, var(--bg) 86%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '54px 18px 12px' }}>
        <button type="button" className="wb-pressable" onClick={onBack} aria-label="Retour"
          style={{ width: 40, height: 40, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0, cursor: 'pointer' }}>
          <ArrowLeft size={19} strokeWidth={1.7} />
        </button>
        <div className="wb-h2" style={{ fontSize: 22 }}>{title}</div>
      </div>
    </div>
  );
}

function GIcon({ name, size = 20, color = 'var(--terra-deep)' }: { name: string; size?: number; color?: string }) {
  const Icon = guideIcon(name);
  return <Icon size={size} strokeWidth={1.6} style={{ color }} />;
}

/* ───────── Hero carousel + lightbox (inchangés) ───────── */

function HeroLightbox({ images, index, setIndex, onClose }: {
  images: string[]; index: number; setIndex: React.Dispatch<React.SetStateAction<number>>; onClose: () => void;
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
  const navBtn = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', [side]: 12, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: 999,
    border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <div onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,12,8,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '94%', maxHeight: '86%', objectFit: 'contain', borderRadius: 12 }} />
      <button type="button" onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={20} strokeWidth={1.9} />
      </button>
      {images.length > 1 ? (
        <>
          <button type="button" aria-label="Précédent" onClick={(e) => { e.stopPropagation(); go(-1); }} style={navBtn('left')}><ChevronLeft size={22} strokeWidth={1.9} /></button>
          <button type="button" aria-label="Suivant" onClick={(e) => { e.stopPropagation(); go(1); }} style={navBtn('right')}><ChevronRight size={22} strokeWidth={1.9} /></button>
          <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 22px)', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{index + 1} / {images.length}</div>
        </>
      ) : null}
    </div>
  );
}

function HeroCarousel({ images, interactive, children }: { images: string[]; interactive: boolean; children: React.ReactNode }) {
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const touchX = useRef<number | null>(null);
  const safeIdx = images.length ? idx % images.length : 0;
  useEffect(() => {
    if (images.length <= 1 || full) return undefined;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % images.length), 4500);
    return () => window.clearInterval(id);
  }, [images.length, full]);
  const go = (dir: number) => images.length && setIdx((i) => (i + dir + images.length) % images.length);
  const tappable = interactive && images.length > 0;
  return (
    <div
      onClick={tappable ? () => setFull(true) : undefined}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null || images.length <= 1) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}
      style={{ position: 'relative', height: 380, overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, cursor: tappable ? 'pointer' : 'default', background: 'var(--terra-deep)' }}
    >
      {images.length > 0 ? (
        images.map((src, i) => (
          <img key={i} src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: i === safeIdx ? 1 : 0, transition: 'opacity .6s ease' }} />
        ))
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, var(--terra) 0%, var(--terra-deep) 100%)' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(40,30,20,.30) 0%, rgba(40,30,20,0) 34%, rgba(35,24,14,.78) 100%)' }} />
      {images.length > 1 ? (
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
          {images.map((_, i) => (
            <span key={i} style={{ width: i === safeIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === safeIdx ? '#FFF6EF' : 'rgba(255,246,239,.5)', transition: 'width .3s, background-color .3s' }} />
          ))}
        </div>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>
      {full ? <HeroLightbox images={images} index={safeIdx} setIndex={setIdx} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

/* ───────────────────────── sub-pages ───────────────────────── */

/** Sous-page d'une section éditoriale : rendu selon le layout. */
function SectionPage({ section, onBack }: { section: GuideSection; onBack: () => void }) {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="wb__scroll">
      <DetailHeader title={section.title} onBack={onBack} />
      <div style={{ padding: '16px 18px 130px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {section.layout === 'text' ? (
          <div className="wb-card" style={{ padding: 16 }}>
            <div style={PARA}>{section.body}</div>
          </div>
        ) : null}

        {section.layout === 'steps' ? (
          <div className="wb-card" style={{ overflow: 'hidden' }}>
            {section.items.map((item, i) => {
              const open = openIdx === i;
              return (
                <div key={item.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <button type="button" className="wb-pressable" onClick={() => setOpenIdx(open ? -1 : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 12, background: 'var(--terra-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GIcon name={item.icon} size={18} />
                    </div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                    {open ? <Minus size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} /> : <Plus size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />}
                  </button>
                  {open && item.steps.length > 0 ? (
                    <ol style={{ margin: 0, padding: '0 16px 16px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {item.steps.map((step, si) => (
                        <li key={si} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: 'var(--terra)', color: '#FFF6EF', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{si + 1}</span>
                          <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {section.layout === 'rules' ? (
          <div className="wb-card" style={{ overflow: 'hidden' }}>
            {section.items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <GIcon name={item.icon} size={19} color="var(--terra)" />
                <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {section.layout === 'list' ? (
          <div className="wb-card" style={{ overflow: 'hidden' }}>
            {section.items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 13, background: 'var(--terra-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GIcon name={item.icon} size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{item.label}</div>
                  {item.detail ? <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 1 }}>{item.detail}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* fallback : body sous une liste structurée si présent */}
        {section.layout !== 'text' && section.body ? (
          <div className="wb-card" style={{ padding: 16 }}><div style={PARA}>{section.body}</div></div>
        ) : null}
      </div>
    </div>
  );
}

const WelcomeBookView: React.FC<WelcomeBookViewProps> = ({
  model, theme, lang, labels: L, heroImages, interactive = true, previewFocus, copiedKey, onCopy,
  onActivityClick, onUpsellClick, onCheckinClick, accessPhotoUrl, langToggle, guestbookSlot, children,
}) => {
  injectWelcomeBookCss();
  const [view, setView] = useState<View>({ name: 'home' });
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { property, practical, stay, checkIn, sections, pois, activities, upsells } = model;
  const goHome = () => setView({ name: 'home' });

  const welcomeMessage = model.welcomeMessage?.trim() || '';
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
  // Accueil personnalisé : prénom du voyageur chargé depuis la réservation (via le token).
  const guestFirstName = (stay?.guestName || '').trim().split(/\s+/)[0] || '';
  const heroGreeting = guestFirstName ? `${L.welcome}, ${guestFirstName}` : L.welcome;
  const tiles: Array<{ icon: React.ReactNode; label: string; value: string; mono?: boolean }> = [];
  if (checkInTime) tiles.push({ icon: <LogIn size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.arrival, value: checkInTime });
  if (checkOutTime) tiles.push({ icon: <LogOut size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.departure, value: checkOutTime });
  if (doorCode) tiles.push({ icon: <KeyRound size={17} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />, label: L.accessCode, value: doorCode, mono: true });
  const hasEssentials = hasWifi || tiles.length > 0;

  // Localisation.
  const addressLine = property ? [property.address, property.postalCode, property.city, property.country].filter(Boolean).join(', ') : '';
  const propLat = property?.latitude ?? null;
  const propLng = property?.longitude ?? null;
  const mapsUrl = propLat != null && propLng != null
    ? `https://www.google.com/maps/search/?api=1&query=${propLat},${propLng}`
    : addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : null;

  // Autour de moi.
  const poiPins: GuideMapPin[] = pois.filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ lat: p.lat as number, lng: p.lng as number, color: poiCategory(p.category).color, label: p.name || poiLabel(p.category, lang) }));
  const mapCenter: [number, number] | null = propLat != null && propLng != null ? [propLng, propLat] : poiPins[0] ? [poiPins[0].lng, poiPins[0].lat] : null;
  const mapPins: GuideMapPin[] = propLat != null && propLng != null
    ? [{ lat: propLat, lng: propLng, color: '#BC5B36', label: property?.name || model.title }, ...poiPins] : poiPins;
  const poiGroups = POI_CATEGORIES.map((c) => ({ cat: c, items: pois.filter((p) => p.category === c.id) })).filter((g) => g.items.length > 0);

  const accessPhotos = accessPhotoUrl ? model.accessPhotos : [];
  const practicalBlocks: Array<{ label: string; value: string }> = [];
  if (practical?.arrivalInstructions) practicalBlocks.push({ label: L.arrivalInstr, value: practical.arrivalInstructions });
  if (practical?.departureInstructions) practicalBlocks.push({ label: L.departureInstr, value: practical.departureInstructions });
  if (practical?.parkingInfo) practicalBlocks.push({ label: L.parking, value: practical.parkingInfo });
  if (practical?.houseRules) practicalBlocks.push({ label: L.houseRules, value: practical.houseRules });
  if (practical?.additionalNotes) practicalBlocks.push({ label: L.notes, value: practical.additionalNotes });

  const hasArrival = !!(checkInTime || checkOutTime || doorCode || addressLine || accessPhotos.length || practicalBlocks.length || checkIn || practical?.emergencyContact);

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
      <HeroCarousel images={heroImages} interactive={interactive}>
        {model.logoUrl ? <img src={model.logoUrl} alt="" style={{ position: 'absolute', top: 22, left: 22, maxHeight: 40, maxWidth: 150, objectFit: 'contain' }} /> : null}
        {langToggle ? <div style={{ position: 'absolute', top: 22, right: 16, pointerEvents: 'auto' }}>{langToggle}</div> : null}
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22 }}>
          <div className="wb-eyebrow wb-rise" style={{ color: '#F4D8C4', marginBottom: 8 }}>{heroGreeting}</div>
          <div className="wb-h1 wb-rise" style={{ color: '#FFF8F0', fontSize: 36, animationDelay: '.05s' }}>{model.title}</div>
          <div className="wb-rise" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10, color: '#F3E7D8', fontSize: 13.5, fontWeight: 600, animationDelay: '.1s' }}>
            {property?.city || property?.name ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={15} strokeWidth={1.6} style={{ color: '#F4D8C4' }} />{property.city || property.name}</span>
            ) : null}
            {stay?.checkIn || stay?.checkOut ? (
              <>
                {(property?.city || property?.name) ? <span style={{ opacity: 0.5 }}>·</span> : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CalendarDays size={15} strokeWidth={1.6} style={{ color: '#F4D8C4' }} />{formatDate(stay.checkIn, lang)}{stay.checkOut ? ` — ${formatDate(stay.checkOut, lang)}` : ''}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </HeroCarousel>

      <div style={{ padding: '20px 18px 132px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Note d'accueil */}
        {welcomeMessage ? (
          <div className="wb-card wb-rise" style={{ padding: 16, display: 'flex', gap: 13, alignItems: 'flex-start', background: 'var(--raised)' }}>
            <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, background: 'var(--terra-bg)', color: 'var(--terra-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, border: '1px solid var(--terra-soft)' }}>
              {(model.hostNames || property?.name || model.title || 'B').trim().charAt(0).toUpperCase()}
            </div>
            <div>
              {model.hostNames ? <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{model.hostNames}</div> : null}
              <div className="wb-serif" style={{ fontStyle: 'italic', fontSize: 16.5, lineHeight: 1.42, color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}>{welcomeMessage}</div>
            </div>
          </div>
        ) : null}

        {/* Essentiels */}
        {hasEssentials ? (
          <div className="wb-card wb-rise" style={{ overflow: 'hidden', animationDelay: '.05s' }}>
            <div style={{ padding: '13px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />
              <span className="wb-label" style={{ color: 'var(--terra-deep)' }}>{L.essentials}</span>
            </div>
            <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {hasWifi ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                      <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 12, background: 'var(--terra-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--terra-deep)' }}><Wifi size={19} strokeWidth={1.6} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="wb-label">{practical?.wifiName ? `${L.network} · WiFi` : 'WiFi'}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, wordBreak: 'break-all' }}>{practical?.wifiName || practical?.wifiPassword}</div>
                        {practical?.wifiName && practical?.wifiPassword ? (
                          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 1 }}>{L.password} · <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{practical.wifiPassword}</span></div>
                        ) : null}
                      </div>
                    </div>
                    {practical?.wifiPassword ? <CopyChip label={copiedKey === 'wifi' ? L.copied : L.copy} value={practical.wifiPassword} copyKey="wifi" copiedKey={copiedKey} onCopy={onCopy} interactive={interactive} /> : null}
                  </div>
                  {tiles.length > 0 ? <div style={{ height: 1, background: 'var(--line)' }} /> : null}
                </>
              ) : null}
              {tiles.length > 0 ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  {tiles.map((t, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      {t.icon}
                      <div style={{ fontWeight: 800, fontSize: 15, marginTop: 5, letterSpacing: t.mono ? '.08em' : 0, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
                      <div className="wb-label" style={{ fontSize: 9.5, marginTop: 2 }}>{t.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Explorer le livret */}
        {navEntries.length > 0 ? (
          <div className="wb-rise" style={{ animationDelay: '.1s' }}>
            <div className="wb-label" style={{ padding: '4px 4px 10px' }}>{L.explore}</div>
            <div className="wb-card" style={{ overflow: 'hidden' }}>
              {navEntries.map((n, i) => (
                <button key={n.key} type="button" className="wb-pressable" onClick={n.go}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', borderTop: i ? '1px solid var(--line)' : 'none', textAlign: 'left' }}>
                  <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 13, background: 'var(--terra-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GIcon name={n.icon} size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)' }}>{n.title}</div>
                    {n.subtitle ? <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 1 }}>{n.subtitle}</div> : null}
                  </div>
                  <ChevronRight size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Marketplace */}
        {model.activitiesEnabled && activities.length > 0 ? (
          <div className="wb-rise" style={{ animationDelay: '.15s' }} ref={expRef}>
            <div style={{ padding: '6px 4px 12px' }}>
              <div className="wb-eyebrow">{L.marketplace}</div>
              <div className="wb-h2" style={{ fontSize: 21, marginTop: 4 }}>{L.activitiesTitle}</div>
            </div>
            <div style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '2px 4px 6px', margin: '0 -4px' }}>
              {activities.map((a) => {
                const card = (
                  <div className="wb-card" style={{ overflow: 'hidden', background: 'var(--raised)', height: '100%' }}>
                    <div style={{ height: 116, position: 'relative', background: 'linear-gradient(150deg, var(--terra) 0%, var(--terra-deep) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {a.imageUrl ? <img src={a.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Ticket size={38} strokeWidth={1.4} style={{ color: 'rgba(255,255,255,.92)' }} />}
                      {a.featured ? (
                        <div style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,.92)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink)' }}>
                          <Star size={11} style={{ color: 'var(--gold)' }} fill="var(--gold)" /> {L.featured}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ padding: '11px 13px 13px' }}>
                      <div className="wb-serif" style={{ fontSize: 18, lineHeight: 1.14, marginBottom: 8, color: 'var(--ink)' }}>{a.title}</div>
                      {a.description ? <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 9, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</div> : null}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{a.price || ''}</div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--terra-deep)', fontWeight: 700, fontSize: 12.5 }}>{L.book} <ArrowRight size={14} strokeWidth={1.8} /></span>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div key={a.id} className="wb-pressable" style={{ flexShrink: 0, width: 210 }}>
                    {a.bookingUrl ? (
                      <a href={interactive ? a.bookingUrl : undefined} target="_blank" rel="noopener noreferrer" onClick={() => interactive && onActivityClick?.(a)} style={{ textDecoration: 'none', display: 'block', height: '100%', cursor: interactive ? 'pointer' : 'default' }}>{card}</a>
                    ) : card}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Services à la carte — inline, présenté comme le marketplace */}
        {model.upsellsEnabled && upsells.length > 0 ? (
          <div className="wb-rise" style={{ animationDelay: '.18s' }}>
            <div style={{ padding: '6px 4px 12px' }}>
              <div className="wb-eyebrow">{L.marketplace}</div>
              <div className="wb-h2" style={{ fontSize: 21, marginTop: 4 }}>{L.upsellsTitle}</div>
            </div>
            <div style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '2px 4px 6px', margin: '0 -4px' }}>
              {upsells.map((u) => (
                <div key={u.offerId} className="wb-pressable" style={{ flexShrink: 0, width: 210 }}>
                  <div className="wb-card" style={{ overflow: 'hidden', background: 'var(--raised)', height: '100%' }}>
                    <div style={{ height: 116, position: 'relative', background: 'linear-gradient(150deg, var(--terra) 0%, var(--terra-deep) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {u.imageUrl ? <img src={u.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Sparkles size={36} strokeWidth={1.4} style={{ color: 'rgba(255,255,255,.92)' }} />}
                    </div>
                    <div style={{ padding: '11px 13px 13px' }}>
                      <div className="wb-serif" style={{ fontSize: 18, lineHeight: 1.14, marginBottom: 8, color: 'var(--ink)' }}>{u.title}</div>
                      {u.description ? <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 9, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{u.description}</div> : null}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <button type="button" className="wb-pressable" onClick={() => setView({ name: 'review' })}
            style={{ border: '1.5px solid var(--terra-soft)', background: 'transparent', borderRadius: 18, padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <Stars value={5} size={16} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{L.rateStay}</div></div>
            <ChevronRight size={18} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
          </button>
        ) : null}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '14px 0 4px', color: 'var(--ink-faint)' }}>
          {property?.name ? <div className="wb-serif" style={{ fontSize: 19, color: 'var(--ink-soft)' }}>{property.name}</div> : null}
          <div style={{ fontSize: 11, marginTop: 6, letterSpacing: '.04em' }}>{L.poweredBy} · <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink-soft)' }}>baitly.</span></div>
        </div>
      </div>
    </div>
  );

  /* ───────── ARRIVAL ───────── */
  const arrival = (
    <div className="wb__scroll">
      <DetailHeader title={`${L.arrival} & ${L.departure}`} onBack={goHome} />
      <div style={{ padding: '16px 18px 130px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {checkInTime || checkOutTime ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {[[L.arrival, checkInTime, <LogIn key="i" size={20} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />], [L.departure, checkOutTime, <LogOut key="o" size={20} strokeWidth={1.6} style={{ color: 'var(--terra)' }} />]]
              .filter((x) => x[1])
              .map((x, i) => (
                <div key={i} className="wb-card" style={{ flex: 1, padding: '16px 14px', background: 'var(--raised)' }}>
                  {x[2] as React.ReactNode}
                  <div className="wb-serif" style={{ fontSize: 30, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{x[1] as string}</div>
                  <div className="wb-label" style={{ marginTop: 2 }}>{x[0] as string}</div>
                </div>
              ))}
          </div>
        ) : null}

        {addressLine || mapCenter ? (
          <div className="wb-card" style={{ overflow: 'hidden' }}>
            {mapCenter ? <GuideMap center={mapCenter} pins={mapPins} height={130} /> : null}
            <div style={{ padding: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="wb-label" style={{ marginBottom: 3 }}>{L.address}</div>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{addressLine}</div>
              </div>
              {mapsUrl ? <a href={interactive ? mapsUrl : undefined} target="_blank" rel="noopener noreferrer" className="wb-btn wb-btn--soft wb-pressable" style={{ flexShrink: 0, padding: '10px 14px', fontSize: 13, borderRadius: 13, textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}><Navigation size={16} strokeWidth={1.7} /> {L.viewMap}</a> : null}
            </div>
          </div>
        ) : null}

        {doorCode ? (
          <div className="wb-card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="wb-label" style={{ marginBottom: 3 }}>{L.accessCode}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.12em', fontVariantNumeric: 'tabular-nums' }}>{doorCode}</div>
            </div>
            <CopyChip label={copiedKey === 'door' ? L.copied : L.copy} value={doorCode} copyKey="door" copiedKey={copiedKey} onCopy={onCopy} interactive={interactive} />
          </div>
        ) : null}

        {checkIn ? (
          <WarmBlock label={L.checkinTitle}>
            {checkIn.status === 'COMPLETED' ? (
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--terra-deep)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} strokeWidth={2} /> {L.checkinDone}</div>
            ) : (
              <a href={interactive ? checkIn.link : undefined} target="_blank" rel="noopener noreferrer" onClick={() => interactive && onCheckinClick?.()} className="wb-btn wb-pressable" style={{ textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}>{L.checkinCta} <ArrowUpRight size={18} strokeWidth={1.8} /></a>
            )}
          </WarmBlock>
        ) : null}

        {accessPhotos.length > 0 && accessPhotoUrl ? (
          <div>
            <div className="wb-label" style={{ padding: '2px 4px 10px' }}>{L.directions}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {accessPhotos.map((p, i) => (
                <div key={p.key} className="wb-card" style={{ padding: 13, display: 'flex', gap: 13, alignItems: 'center', background: 'var(--raised)' }}>
                  <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                    <img src={accessPhotoUrl(p.key)} alt={p.caption || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 999, background: 'var(--terra)', color: '#FFF6EF', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{p.caption || ''}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {practicalBlocks.map((b, i) => (<WarmBlock key={i} label={b.label}><div style={PARA}>{b.value}</div></WarmBlock>))}

        {practical?.emergencyContact ? (
          <WarmBlock label={L.useful}>
            <a href={interactive ? `tel:${practical.emergencyContact}` : undefined} className="wb-pressable" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--terra-deep)', textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}><Phone size={16} strokeWidth={1.7} /> {practical.emergencyContact}</a>
          </WarmBlock>
        ) : null}
      </div>
    </div>
  );

  /* ───────── QUARTIER ───────── */
  const quartier = (
    <div className="wb__scroll">
      <DetailHeader title={L.neighbourhood} onBack={goHome} />
      <div style={{ padding: '16px 18px 130px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mapCenter ? <div className="wb-card" style={{ overflow: 'hidden' }}><GuideMap center={mapCenter} pins={mapPins} /></div> : null}
        {poiGroups.map(({ cat, items }) => (
          <div key={cat.id}>
            <div className="wb-label" style={{ padding: '2px 4px 10px' }}>{poiLabel(cat.id, lang)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {items.map((p) => {
                const CatIcon = cat.Icon;
                const dist = propLat != null && propLng != null && p.lat != null && p.lng != null ? distanceKm(propLat, propLng, p.lat, p.lng) : null;
                const gmaps = p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}` : null;
                return (
                  <div key={p.id} className="wb-card" style={{ padding: 15, display: 'flex', gap: 13, background: 'var(--raised)' }}>
                    <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, background: 'var(--terra-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CatIcon size={21} strokeWidth={1.7} style={{ color: cat.color }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span className="wb-serif" style={{ fontSize: 19, color: 'var(--ink)' }}>{p.name || poiLabel(cat.id, lang)}</span>
                        {p.featured ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: 'var(--terra-deep)', background: 'var(--terra-bg)', padding: '2px 7px', borderRadius: 999 }}><Star size={10} style={{ color: 'var(--terra-deep)' }} fill="var(--terra-deep)" />{L.featured}</span> : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0 7px', fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600, flexWrap: 'wrap' }}>
                        {p.type ? <span>{p.type}</span> : null}
                        {p.type && dist != null ? <span style={{ opacity: 0.5 }}>·</span> : null}
                        {dist != null ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontVariantNumeric: 'tabular-nums' }}><Footprints size={13} strokeWidth={1.7} />{fmtDistance(dist)}</span> : null}
                      </div>
                      {p.note ? <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{p.note}</div> : null}
                      {gmaps ? <a href={interactive ? gmaps : undefined} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7, color: 'var(--terra-deep)', fontWeight: 700, fontSize: 12.5, textDecoration: 'none', cursor: interactive ? 'pointer' : 'default' }}><MapPin size={13} strokeWidth={1.7} />{L.viewMap}</a> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
    <div className="wb" data-theme={normalizeTheme(theme)} dir={dir}>
      {view.name === 'home' && home}
      {view.name === 'section' && activeSection ? <SectionPage section={activeSection} onBack={goHome} /> : null}
      {view.name === 'section' && !activeSection ? home : null}
      {view.name === 'arrival' && arrival}
      {view.name === 'quartier' && quartier}
      {view.name === 'review' && review}
      {children}
    </div>
  );
};

export default WelcomeBookView;
