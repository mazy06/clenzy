import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { AGENT_IDS } from '../supervision/constants';
import { ArrowBack, ArrowForward, Pause, PlayArrow } from '../../icons';
import PublicLanguagePicker from '../../components/PublicLanguagePicker';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import './baitly-auth.css';

export interface AuthLayoutProps {
  children: React.ReactNode;
  maxFormWidth?: number | string;
  /** Optional calm panel for public help flows. Replaces the product carousel. */
  presentation?: React.ReactNode;
  presentationLabel?: string;
}
type Scene = 'portfolio' | 'guests' | 'operations' | 'business';
interface CarouselSlide {
  id: string;
  scene: Scene;
  services?: string[];
}
const SLIDES: CarouselSlide[] = [
  { id: 's0', scene: 'portfolio' },
  { id: 's11', scene: 'business' },
  { id: 's14', scene: 'business' },
  { id: 's16', scene: 'business' },
  { id: 's1', scene: 'portfolio' },
  { id: 's5', scene: 'portfolio', services: ['Airbnb', 'Booking.com', 'Expedia', 'Vrbo', 'Agoda', 'Tripadvisor'] },
  { id: 's13', scene: 'operations' },
  { id: 's2', scene: 'guests' },
  { id: 's12', scene: 'guests' },
  { id: 's6', scene: 'operations', services: ['Nuki', 'KeyNest', 'Tuya'] },
  { id: 's15', scene: 'operations' },
  { id: 's4', scene: 'portfolio', services: ['Airbnb', 'Booking.com'] },
  { id: 's8', scene: 'business', services: ['Pennylane', 'QuickBooks', 'Xero', 'Sage'] },
  { id: 's9', scene: 'business', services: ['DocuSign'] },
];
/** Every presented feature remains translated and covered by the auth tests. */
export const SLIDE_IDS: readonly string[] = SLIDES.map(({ id }) => id);
const SCENES: Scene[] = ['portfolio', 'guests', 'operations', 'business'];
const SLIDE_DURATION_MS = 10000;

/** Baitly public entry: illustrated modules beside an independent working form. */
export default function AuthLayout({ children, maxFormWidth = 440, presentation, presentationLabel }: AuthLayoutProps) {
  const { language, chooseLanguage } = useGeoAuthLanguage();
  const { t } = useTranslation();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const desktop = useMediaQuery('(min-width: 900px)');
  // Presentation state is volatile and never persists auth data or preferences.
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const current = SLIDES[slideIndex];
  const hasPresentation = presentation != null;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (hasPresentation || reducedMotion || paused || hovered || focused || hidden || !desktop) return;
    const timer = window.setTimeout(() => setSlideIndex(i => (i + 1) % SLIDES.length), SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [hasPresentation, reducedMotion, paused, hovered, focused, hidden, desktop, slideIndex]);

  const move = (direction: number) => setSlideIndex(i => (i + direction + SLIDES.length) % SLIDES.length);

  return (
    <div className="brand-accent baitly-auth" data-theme="light" data-presentation={hasPresentation ? 'quiet' : 'product'} lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="baitly-auth-topbar">
        <a href="/login" className="baitly-auth-logo" aria-label="Baitly">
          <BaitlyMarkLogo variant="full" size="var(--baitly-auth-logo-size, 40px)" tone="light" />
        </a>
        <PublicLanguagePicker value={language} onChange={chooseLanguage} label={t('navigation.language')} />
      </header>
      <aside className="baitly-auth-showcase" aria-label={presentationLabel ?? t('auth.showcase.label')}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
        {hasPresentation ? presentation : <>
        <div className="baitly-auth-intro">
          <span className="baitly-auth-kicker">{t('auth.showcase.kicker')}</span>
          <p>{t('auth.showcase.intro')}</p>
        </div>
        <div className="baitly-auth-feature" key={current.id}>
          <div className="baitly-auth-art" data-scene={current.scene} role="img" aria-label={t(`auth.showcase.images.${current.scene}`)}>
            <div className="baitly-auth-art-image" />
            <span className="baitly-auth-art-caption">{t('auth.showcase.illustration')}</span>
          </div>
          <div className="baitly-auth-feature-copy">
            <span className="baitly-auth-feature-label">{t(`auth.showcase.groups.${current.scene}`)}</span>
            <h2>{t(`auth.slides.${current.id}.tagline`)}{' '}
              {t(`auth.slides.${current.id}.highlight`, { agentCount: AGENT_IDS.length })}
              {t(`auth.slides.${current.id}.end`)}</h2>
            <p>{t(`auth.slides.${current.id}.subtitle`)}</p>
            {current.services && <div className="baitly-auth-integrations">
              {current.services.map(service => <span key={service}>{service}</span>)}
            </div>}
          </div>
        </div>
        <div className="baitly-auth-navigation">
          <div className="baitly-auth-chapters" aria-label={t('auth.showcase.modules')}>
            {SCENES.map(scene => <button type="button" key={scene} aria-pressed={current.scene === scene}
              onClick={() => setSlideIndex(SLIDES.findIndex(slide => slide.scene === scene))}>
              {t(`auth.showcase.groups.${scene}`)}
            </button>)}
          </div>
          <div className="baitly-auth-controls">
            <label className="sr-only" htmlFor="baitly-auth-feature-select">{t('auth.showcase.modules')}</label>
            <select id="baitly-auth-feature-select" value={slideIndex} onChange={event => setSlideIndex(Number(event.target.value))}>
              {SLIDES.map((slide, index) => <option key={slide.id} value={index}>
                {t(`auth.slides.${slide.id}.highlight`, { agentCount: AGENT_IDS.length })}
              </option>)}
            </select>
            <span className="baitly-auth-counter" dir="ltr">{String(slideIndex + 1).padStart(2, '0')} / {SLIDES.length}</span>
            <button type="button" onClick={() => move(-1)} aria-label={t('auth.showcase.previous')}><ArrowBack size={17} /></button>
            {!reducedMotion && desktop && <button type="button" onClick={() => setPaused(value => !value)} aria-label={t(paused ? 'auth.showcase.play' : 'auth.showcase.pause')}>
              {paused ? <PlayArrow size={16} /> : <Pause size={16} />}
            </button>}
            <button type="button" onClick={() => move(1)} aria-label={t('auth.showcase.next')}><ArrowForward size={17} /></button>
          </div>
        </div>
        <footer className="baitly-auth-showcase-footer"><span>Baitly PMS</span><span>{t('auth.showcase.footer')}</span></footer>
        </>}
      </aside>
      <main className="baitly-auth-main" id="baitly-auth-form">
        <div className="baitly-auth-form" style={{ maxWidth: maxFormWidth }}>{children}</div>
        <p className="baitly-auth-form-footer">{t('auth.showcase.formFooter')}</p>
      </main>
    </div>
  );
}
