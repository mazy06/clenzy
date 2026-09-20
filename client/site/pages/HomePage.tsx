import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  GlobeIcon,
  MapPinIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import AgentActionDeck from '../components/AgentActionDeck';
import { useSiteLanguage } from '../lib/siteLanguage';
import { HOME_MESSAGES } from '../lib/messages/home';
import { moduleText } from '../lib/messages/modules';
import BaitlyAgentDemo from '../components/BaitlyAgentDemo';
import LandingPlanningMockup from '../components/LandingPlanningMockup';
import { BRANDS } from '../components/BrandLogos';
import { MODULES } from '../data/catalog';
// Visuels NEUTRES : le riad marocain contredisait la promesse saoudienne.
// A remplacer par des photos du marche de lancement des qu'elles existent.
import heroPhoto from '../assets/photos/terrace.jpg';
import interiorPhoto from '../assets/photos/bedroom.jpg';
import localPhoto from '../assets/photos/guesthouse.jpg';
import poolPhoto from '../assets/photos/pool.jpg';

function Hero() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].hero;
  return (
    <section className="baitly-hero" aria-labelledby="home-title">
      <div className="site-shell baitly-hero-grid">
        <div className="baitly-hero-copy">
          <Reveal>
            <p className="baitly-eyebrow">
              <span /> {m.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h1 id="home-title">
              {m.title1}
              <br />
              <span>{m.title2}</span>
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="baitly-lead">
              {m.lead1}
              <br className="baitly-desktop-break" /> {m.lead2}
            </p>
            <p className="baitly-hero-description">
              {m.description}
            </p>
            <div className="baitly-actions">
              <Link className="baitly-button" to="/demo">
                {m.demo} <ArrowRightIcon />
              </Link>
              <a className="baitly-play-link" href="#en-action">
                <span>
                  <PlayIcon />
                </span>{' '}
                {m.watch}
              </a>
            </div>
            <p className="baitly-reassurance">
              <CheckIcon /> {m.reassurance1} <span>·</span> {m.reassurance2}
            </p>
          </Reveal>
        </div>
        <Reveal delay={2} className="baitly-hero-visual">
          <img
            className="baitly-hero-photo"
            src={heroPhoto}
            sizes="(max-width: 767px) 100vw, 50vw"
            alt={m.photoAlt}
            width="640"
            height="424"
            // React 18 forwards the lowercase HTML attribute without a warning.
            {...{ fetchpriority: 'high' }}
          />
          <div className="baitly-photo-location">
            <MapPinIcon /> {m.photoCaption}
          </div>
          <AgentActionDeck />
          <span className="baitly-example-label">{m.exampleLabel}</span>
        </Reveal>
      </div>
      <div className="site-shell baitly-hero-bottom">
        <span>{m.audience}</span>
        <a href="#plateforme">
          {m.scroll} <ArrowDownIcon />
        </a>
      </div>
    </section>
  );
}

const FEATURED_BRANDS = BRANDS.filter(({ name }) =>
  [
    'Airbnb',
    'Booking.com',
    'Expedia',
    'Stripe',
    'WhatsApp',
    'PayZone',
  ].includes(name),
);
function ChannelsBar() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].channels;
  return (
    <section
      className="site-shell baitly-channels"
      aria-label={m.aria}
    >
      <p>
        {m.line1}
        <br />
        <strong>{m.line2}</strong>
      </p>
      <div className="baitly-brand-list">
        {FEATURED_BRANDS.map((brand) => (
          <div className="baitly-brand" key={brand.name}>
            <img
              src={brand.logoUrl}
              alt=""
              width="26"
              height="26"
              loading="lazy"
            />
            <span>{brand.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformSection() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].platform;
  const otherModules = MODULES.filter(
    ({ slug }) =>
      !['agents-ia', 'pms-channel-manager', 'booking-engine'].includes(slug),
  );
  return (
    <section
      className="site-shell baitly-section"
      id="plateforme"
      aria-labelledby="platform-title"
    >
      <Reveal className="baitly-section-heading">
        <div>
          <p className="baitly-section-label">{m.label}</p>
          <h2 id="platform-title">
            {m.title1}
            <br />
            {m.title2}
          </h2>
        </div>
        <p>
          {m.intro}
        </p>
      </Reveal>
      <div className="baitly-feature-grid">
        <Reveal className="baitly-feature baitly-feature-planning">
          <div className="baitly-feature-copy">
            <span className="baitly-feature-number">{m.planningNumber}</span>
            <h3>
              {m.planningTitle1}
              <br />
              {m.planningTitle2}
            </h3>
            <p>{m.planningCopy}</p>
            <Link
              className="baitly-text-link"
              to="/produit/pms-channel-manager"
            >
              {m.planningLink} <ArrowRightIcon />
            </Link>
          </div>
          <div
            className="baitly-planning-stage"
            aria-label={m.planningAria}
          >
            <LandingPlanningMockup />
          </div>
        </Reveal>
        <Reveal delay={1} className="baitly-feature baitly-feature-direct">
          <div className="baitly-direct-photo">
            <img
              src={interiorPhoto}
              alt={m.directPhotoAlt}
              width="640"
              height="435"
              loading="lazy"
            />
            <div className="baitly-booking-note">
              <GlobeIcon />
              <div>
                <strong>{m.directNoteTitle}</strong>
                <span>{m.directNoteBody}</span>
              </div>
              <CheckIcon />
            </div>
          </div>
          <div className="baitly-feature-copy">
            <span className="baitly-feature-number">{m.directNumber}</span>
            <h3>
              {m.directTitle1}
              <br />
              {m.directTitle2}
            </h3>
            <p>{m.directCopy}</p>
            <Link className="baitly-text-link" to="/produit/booking-engine">
              {m.directLink} <ArrowRightIcon />
            </Link>
          </div>
        </Reveal>
      </div>
      <div className="baitly-module-list">
        {otherModules.map((module) => (
          <Link to={`/produit/${module.slug}`} key={module.slug}>
            <module.icon className="baitly-module-icon" />
            <span>{moduleText(module.slug, language).name}</span>
            <ArrowRightIcon />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LocalSection() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].local;
  return (
    <section className="baitly-local-section">
      <div className="site-shell baitly-local-grid">
        <Reveal className="baitly-local-visual">
          <img
            src={localPhoto}
            alt={m.photoAlt}
            width="640"
            height="427"
            loading="lazy"
          />
          <div>
            <MapPinIcon />
            <span>
              {m.rootsLine1}
              <br />
              <strong>{m.rootsLine2}</strong>
            </span>
          </div>
        </Reveal>
        <Reveal delay={1} className="baitly-local-copy">
          <p className="baitly-section-label">{m.label}</p>
          <h2>
            {m.title1}
            <br />
            {m.title2}
          </h2>
          <p>{m.copy}</p>
          <ul>
            {m.points.map(([title, copy]) => (
              <li key={title}>
                <CheckIcon />
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link className="baitly-text-link" to="/solutions#arabie-saoudite">
            {m.link} <ArrowRightIcon />
          </Link>
          <div className="baitly-local-support">
            <ShieldCheckIcon />
            <p>
              <strong>{m.supportTitle}</strong>
              <br />
              {m.supportBody}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FaqSection() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].faq;
  return (
    <section
      className="site-shell baitly-section baitly-faq"
      aria-labelledby="faq-title"
    >
      <Reveal>
        <p className="baitly-section-label">{m.label}</p>
        <h2 id="faq-title">
          {m.title1}
          <br />
          {m.title2}
        </h2>
        <Link to="/demo" className="baitly-text-link">
          {m.link} <ArrowRightIcon />
        </Link>
      </Reveal>
      <div>
        {m.items.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <PlusIcon />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
function FinalCta() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].final;
  return (
    <section className="site-shell baitly-final-wrap">
      <div className="baitly-final-cta">
        <img src={poolPhoto} alt="" width="640" height="828" loading="lazy" />
        <div>
          <p className="baitly-section-label">{m.label}</p>
          <h2>
            {m.title1}
            <br />
            {m.title2}
          </h2>
          <p>
            {m.copy1}
            <br className="baitly-desktop-break" /> {m.copy2}
          </p>
          <Link className="baitly-button baitly-button-light" to="/demo">
            {m.cta} <ArrowRightIcon />
          </Link>
          <span className="baitly-final-note">{m.note}</span>
        </div>
      </div>
    </section>
  );
}
export default function HomePage() {
  return (
    <div className="baitly-home">
      <Hero />
      <ChannelsBar />
      <PlatformSection />
      <BaitlyAgentDemo />
      <LocalSection />
      <FaqSection />
      <FinalCta />
    </div>
  );
}
