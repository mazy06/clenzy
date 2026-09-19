import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  GlobeIcon,
  MapPinIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import BaitlyAgentDemo from '../components/BaitlyAgentDemo';
import LandingPlanningMockup from '../components/LandingPlanningMockup';
import { BRANDS } from '../components/BrandLogos';
import { MODULES } from '../data/catalog';
import riadPhoto from '../assets/photos/baitly-riad.webp';
import riadSmall from '../assets/photos/baitly-riad-small.webp';
import interiorPhoto from '../assets/photos/riad.jpg';
import poolPhoto from '../assets/photos/pool.jpg';

function Hero() {
  return (
    <section className="baitly-hero" aria-labelledby="home-title">
      <div className="site-shell baitly-hero-grid">
        <div className="baitly-hero-copy">
          <Reveal>
            <p className="baitly-eyebrow">
              <span /> L’hospitalité, augmentée.
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h1 id="home-title">
              Vos locations.
              <br />
              <span>L’esprit libre.</span>
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="baitly-lead">
              Vous créez des séjours mémorables.
              <br className="baitly-desktop-break" /> Vos agents IA s’occupent
              des coulisses.
            </p>
            <p className="baitly-hero-description">
              Réservations, tarifs, voyageurs et équipes : tout votre quotidien
              réuni dans un seul PMS. Pensé pour le Maroc et la France.
            </p>
            <div className="baitly-actions">
              <Link className="baitly-button" to="/demo">
                Réserver une démo <ArrowRightIcon />
              </Link>
              <a className="baitly-play-link" href="#en-action">
                <span>
                  <PlayIcon />
                </span>{' '}
                Voir Baitly en action
              </a>
            </div>
            <p className="baitly-reassurance">
              <CheckIcon /> Sans engagement <span>·</span> Démo personnalisée de
              30 min
            </p>
          </Reveal>
        </div>
        <Reveal delay={2} className="baitly-hero-visual">
          <img
            className="baitly-hero-photo"
            src={riadPhoto}
            srcSet={`${riadSmall} 700w, ${riadPhoto} 1400w`}
            sizes="(max-width: 767px) 100vw, 50vw"
            alt="Patio de riad, arches en tadelakt et bassin à la lumière du matin"
            width="1400"
            height="933"
            // React 18 forwards the lowercase HTML attribute without a warning.
            {...{ fetchpriority: 'high' }}
          />
          <div className="baitly-photo-location">
            <MapPinIcon /> L’esprit des lieux. La sérénité en plus.
          </div>
          <div className="baitly-hero-note">
            <span className="baitly-note-icon">
              <SparklesIcon />
            </span>
            <div>
              <span className="baitly-note-label">
                Votre équipe d’agents IA
              </span>
              <strong>Le prochain séjour se prépare.</strong>
              <p>Message d’accueil prêt. Équipe informée.</p>
            </div>
            <CircleCheckIcon className="baitly-note-check" />
          </div>
          <span className="baitly-example-label">
            Illustration d’un séjour avec Baitly
          </span>
        </Reveal>
      </div>
      <div className="site-shell baitly-hero-bottom">
        <span>Pour les hôtes, les riads et les conciergeries.</span>
        <a href="#plateforme">
          Prenez le temps d’accueillir <ArrowDownIcon />
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
  return (
    <section
      className="site-shell baitly-channels"
      aria-label="Intégrations disponibles"
    >
      <p>
        Vos outils préférés.
        <br />
        <strong>Enfin réunis.</strong>
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
          <p className="baitly-section-label">
            Un seul espace, tout votre métier
          </p>
          <h2 id="platform-title">
            Moins d’onglets.
            <br />
            Plus de présence.
          </h2>
        </div>
        <p>
          Du premier clic au prochain check-in, Baitly relie chaque détail du
          séjour. Et vous redonne une vue d’ensemble.
        </p>
      </Reveal>
      <div className="baitly-feature-grid">
        <Reveal className="baitly-feature baitly-feature-planning">
          <div className="baitly-feature-copy">
            <span className="baitly-feature-number">01 / PILOTER</span>
            <h3>
              Votre activité,
              <br />
              en un regard.
            </h3>
            <p>
              Un planning partagé. Tous vos logements, tous vos canaux, les
              bonnes informations au bon endroit.
            </p>
            <Link
              className="baitly-text-link"
              to="/produit/pms-channel-manager"
            >
              Découvrir le PMS <ArrowRightIcon />
            </Link>
          </div>
          <div
            className="baitly-planning-stage"
            aria-label="Planning PMS animé : réservations, canaux et disponibilités"
          >
            <LandingPlanningMockup />
          </div>
        </Reveal>
        <Reveal delay={1} className="baitly-feature baitly-feature-direct">
          <div className="baitly-direct-photo">
            <img
              src={interiorPhoto}
              alt="Salon lumineux ouvert sur une terrasse, prêt à accueillir des voyageurs"
              width="640"
              height="435"
              loading="lazy"
            />
            <div className="baitly-booking-note">
              <GlobeIcon />
              <div>
                <strong>Votre adresse. Votre site.</strong>
                <span>La réservation, en direct.</span>
              </div>
              <CheckIcon />
            </div>
          </div>
          <div className="baitly-feature-copy">
            <span className="baitly-feature-number">02 / DÉVELOPPER</span>
            <h3>
              Le prochain séjour
              <br />
              commence chez vous.
            </h3>
            <p>
              Un site à votre image et un moteur de réservation intégré pour
              créer une relation directe avec vos voyageurs.
            </p>
            <Link className="baitly-text-link" to="/produit/booking-engine">
              Explorer la réservation directe <ArrowRightIcon />
            </Link>
          </div>
        </Reveal>
      </div>
      <div className="baitly-module-list">
        {otherModules.map((module) => (
          <Link to={`/produit/${module.slug}`} key={module.slug}>
            <module.icon className="baitly-module-icon" />
            <span>{module.name}</span>
            <ArrowRightIcon />
          </Link>
        ))}
      </div>
    </section>
  );
}

const LOCAL_POINTS = [
  [
    'Des arrivées bien préparées',
    'Fiches voyageurs et fiche de police au format DGSN.',
  ],
  ['Des paiements ancrés dans le réel', 'Dirhams, CMI, PayZone et YouCan Pay.'],
  [
    'Une gestion qui parle votre langue',
    'Interface en français et en arabe, taxe de séjour et facturation.',
  ],
];
function LocalSection() {
  return (
    <section className="baitly-local-section">
      <div className="site-shell baitly-local-grid">
        <Reveal className="baitly-local-visual">
          <img
            src={riadSmall}
            alt="Détail des arches et de la végétation d’un riad marocain"
            width="700"
            height="467"
            loading="lazy"
          />
          <div>
            <MapPinIcon />
            <span>
              Des racines locales.
              <br />
              <strong>Une vision sans frontières.</strong>
            </span>
          </div>
        </Reveal>
        <Reveal delay={1} className="baitly-local-copy">
          <p className="baitly-section-label">Maroc d’abord. France aussi.</p>
          <h2>
            À l’aise avec votre métier.
            <br />
            Et votre réalité.
          </h2>
          <p>
            Un riad à Marrakech ne se gère pas comme un appartement à Paris.
            Votre outil doit connaître la différence.
          </p>
          <ul>
            {LOCAL_POINTS.map(([title, copy]) => (
              <li key={title}>
                <CheckIcon />
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link className="baitly-text-link" to="/solutions#maroc">
            Découvrir Baitly au Maroc <ArrowRightIcon />
          </Link>
          <div className="baitly-local-support">
            <ShieldCheckIcon />
            <p>
              <strong>Vous lancez votre digitalisation ?</strong>
              <br />
              Parlons migration, accompagnement et programme Go Siyaha lors de
              votre démo.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FAQS = [
  [
    'Est-ce adapté à mon nombre de logements ?',
    'Baitly s’adresse aux hôtes indépendants, aux riads et aux conciergeries. La démo permet de parcourir les modules utiles à votre organisation, que vous gériez un logement ou un portefeuille.',
  ],
  [
    'Les agents IA prennent-ils les décisions à ma place ?',
    'Vous définissez leur autonomie. Les actions qui demandent votre accord vous sont présentées avec leur contexte : vous pouvez approuver, ajuster ou refuser. Les décisions sont journalisées.',
  ],
  [
    'Puis-je garder mes annonces Airbnb et Booking.com ?',
    'Oui. Baitly réunit vos réservations et synchronise les disponibilités de vos canaux connectés. Vous conservez vos annonces et vos comptes existants.',
  ],
  [
    'Comment se passe le changement de logiciel ?',
    'Nous faisons le point sur vos logements, vos canaux et vos données pour préparer la migration. Le périmètre et les étapes sont définis avec vous avant la bascule.',
  ],
];
function FaqSection() {
  return (
    <section
      className="site-shell baitly-section baitly-faq"
      aria-labelledby="faq-title"
    >
      <Reveal>
        <p className="baitly-section-label">On en parle ?</p>
        <h2 id="faq-title">
          Les bonnes questions,
          <br />
          avant de se lancer.
        </h2>
        <Link to="/demo" className="baitly-text-link">
          Échanger avec notre équipe <ArrowRightIcon />
        </Link>
      </Reveal>
      <div>
        {FAQS.map(([question, answer]) => (
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
  return (
    <section className="site-shell baitly-final-wrap">
      <div className="baitly-final-cta">
        <img src={poolPhoto} alt="" width="640" height="828" loading="lazy" />
        <div>
          <p className="baitly-section-label">
            Votre prochain chapitre commence ici
          </p>
          <h2>
            Laissez de la place
            <br />à ce qui compte.
          </h2>
          <p>
            30 minutes pour découvrir ce que Baitly
            <br className="baitly-desktop-break" /> peut changer dans votre
            quotidien.
          </p>
          <Link className="baitly-button baitly-button-light" to="/demo">
            Rencontrons-nous <ArrowRightIcon />
          </Link>
          <span className="baitly-final-note">
            En français, en darija ou en anglais. Sans engagement.
          </span>
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
