import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  SparklesIcon,
  TrendingUpIcon,
  MessageSquareIcon,
  ClipboardCheckIcon,
  RefreshCwIcon,
  WalletIcon,
  ShieldCheckIcon,
  HeartHandshakeIcon,
  StarIcon,
  HouseIcon,
  SproutIcon,
} from 'lucide-react';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import Reveal from '../components/Reveal';
import BaitlyProductDemo from '../components/BaitlyProductDemos';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import { BAITLY_PRODUCT_MESSAGES } from '../lib/messages/baitlyProducts';
import { AGENTS_MESSAGES } from '../lib/messages/agents';
import { moduleText } from '../lib/messages/modules';
import {
  PRODUCT_STORY_SLUGS,
  type ProductStoryKind,
} from '../data/baitlyProductStories';
import { MODULES } from '../data/catalog';
import airbnb from '../assets/brands/airbnb.svg';
import booking from '../assets/brands/bookingdotcom.svg';
import stripe from '../assets/brands/stripe.svg';
import payzone from '../assets/brands/payzone.svg';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';

const PHOTO_KEYS = {
  agents: 'agentsWork',
  revenue: 'revenueAnalysis',
  finance: 'financeDocuments',
  operations: 'operationsBed',
  devices: 'devicesLock',
  owners: 'ownersContract',
} as const;
const STORY_PHOTOS = {
  agents: { intro: 'agentsReception', workflow: 'agentsCollaboration' },
  revenue: { intro: 'revenueProperty', workflow: 'revenueReview' },
  finance: { intro: 'financePayment', workflow: 'financeReconciliation' },
  operations: {
    intro: 'operationsPreparation',
    workflow: 'operationsEquipment',
  },
  devices: { intro: 'devicesEquipment', workflow: 'devicesEntry' },
  owners: { intro: 'ownersKeys', workflow: 'ownersMeeting' },
} as const satisfies Record<
  ProductStoryKind,
  { intro: keyof typeof SITE_PHOTOS; workflow: keyof typeof SITE_PHOTOS }
>;
const APP_PREVIEWS = {
  operations: lazy(() => import('../components/AnimatedOpsMockup')),
  devices: lazy(() => import('../components/AnimatedIotMockup')),
  owners: lazy(() => import('../components/AnimatedOwnerMockup')),
};
const AGENT_ICONS = [
  TrendingUpIcon,
  MessageSquareIcon,
  ClipboardCheckIcon,
  RefreshCwIcon,
  WalletIcon,
  ShieldCheckIcon,
  HeartHandshakeIcon,
  StarIcon,
  HouseIcon,
  SproutIcon,
];

function AgentDirectory({ language }: { language: SiteLanguage }) {
  const m = AGENTS_MESSAGES[language];
  const [selected, setSelected] = useState(0);
  const agent = m.agents[selected];
  const Icon = AGENT_ICONS[selected];
  return (
    <section
      className="bps-directory site-shell"
      aria-labelledby="bps-agents-title"
    >
      <Reveal className="bps-section-heading">
        <p className="bps-eyebrow">
          <SparklesIcon aria-hidden="true" />
          Baitly AI
        </p>
        <h2 id="bps-agents-title">{m.agentsTitle}</h2>
      </Reveal>
      <div className="bps-directory-layout">
        <div className="bps-agent-list" role="group" aria-label={m.agentsTitle}>
          {m.agents.map((item, index) => {
            const AgentIcon = AGENT_ICONS[index];
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={index === selected}
                aria-controls="bps-agent-detail"
                onClick={() => setSelected(index)}
              >
                <AgentIcon aria-hidden="true" />
                <span>{item.name}</span>
                <ArrowRightIcon aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <div
          className="bps-agent-detail"
          id="bps-agent-detail"
          role="region"
          aria-label={agent.name}
        >
          <div className="bps-agent-detail-top">
            <Icon aria-hidden="true" />
            <span>{m.agentBadge}</span>
          </div>
          <div key={agent.id} className="bps-enter">
            <h3>{agent.name}</h3>
            <dl>
              <div>
                <dt>
                  <EyeIcon aria-hidden="true" />
                  {m.watchesLabel}
                </dt>
                <dd>{agent.watches}</dd>
              </div>
              <div>
                <dt>
                  <SparklesIcon aria-hidden="true" />
                  {m.proposesLabel}
                </dt>
                <dd>{agent.proposes}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      <div className="bps-agent-plan">
        <ShieldCheckIcon aria-hidden="true" />
        <div>
          <strong>{m.pricingTitle}</strong>
          <p>{m.pricingCopy}</p>
        </div>
        <Link to={`/tarifs?lang=${language}#offres`}>
          {m.pricingCta}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function AppPreview({
  kind,
  language,
}: {
  kind: keyof typeof APP_PREVIEWS;
  language: SiteLanguage;
}) {
  const [open, setOpen] = useState(false);
  const m = BAITLY_PRODUCT_MESSAGES[language];
  const Preview = APP_PREVIEWS[kind];
  return (
    <details
      className="bps-app-preview"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <EyeIcon aria-hidden="true" />
          {m.appPreview}
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </summary>
      {open && (
        <div className="bps-app-content">
          <p>{m.appLanguage}</p>
          <Suspense
            fallback={
              <div className="bps-preview-skeleton" aria-label={m.appPreview} />
            }
          >
            <Preview />
          </Suspense>
        </div>
      )}
    </details>
  );
}

function Ecosystem({
  kind,
  language,
}: {
  kind: ProductStoryKind;
  language: SiteLanguage;
}) {
  if (!['revenue', 'finance', 'devices', 'agents'].includes(kind)) return null;
  const brands =
    kind === 'finance'
      ? [
          { name: 'Payzone', src: payzone },
          { name: 'Stripe', src: stripe },
          { name: 'PayTabs' },
        ]
      : kind === 'devices'
        ? [{ name: 'Nuki' }, { name: 'KeyNest' }, { name: 'Minut' }]
        : [
            { name: 'Airbnb', src: airbnb },
            { name: 'Booking.com', src: booking },
          ];
  return (
    <div className="bps-ecosystem site-shell">
      <span>{BAITLY_PRODUCT_MESSAGES[language].ecosystem}</span>
      <ul>
        {brands.map((brand) => (
          <li key={brand.name}>
            {'src' in brand && brand.src ? (
              <img
                src={brand.src}
                alt={brand.name}
                width="100"
                height="28"
                loading="lazy"
              />
            ) : (
              <bdi>{brand.name}</bdi>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BaitlyProductPage({
  kind,
}: {
  kind: ProductStoryKind;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_PRODUCT_MESSAGES[language];
  const story = m.pages[kind];
  const photos = STORY_PHOTOS[kind];
  const slug = PRODUCT_STORY_SLUGS[kind];
  const text = moduleText(slug, language);
  const module = MODULES.find((item) => item.slug === slug)!;
  const Icon = module.icon;
  const features =
    kind === 'agents'
      ? AGENTS_MESSAGES[language].tabs.map((tab) => ({
          title: tab.label,
          copy: tab.copy,
        }))
      : text.features;
  const faq = kind === 'agents' ? AGENTS_MESSAGES[language].faq : text.faq;

  return (
    <div className={`bps-page bps-${kind}`}>
      <section className="bps-hero">
        <div className="site-shell bps-hero-layout">
          <div className="bps-hero-copy">
            <p className="bps-eyebrow">
              <Icon aria-hidden="true" />
              {text.name}
            </p>
            <h1>
              {story.title[0]}
              <span>{story.title[1]}</span>
            </h1>
            <p className="bps-intro">{story.intro}</p>
            <div className="bps-actions">
              <SiteAcquisitionLink
                className="bps-button"
                to={`/demo?lang=${language}`}
              >
                {m.cta}
                <ArrowRightIcon aria-hidden="true" />
              </SiteAcquisitionLink>
              <a className="bps-text-link" href="#fonctionnalites">
                {m.explore}
                <ArrowDownIcon aria-hidden="true" />
              </a>
            </div>
            <div className="bps-hero-photo">
              <img
                src={SITE_PHOTOS[photos.intro]}
                alt={sitePhotoAlt(photos.intro, language)}
                width="1000"
                height="360"
                decoding="async"
              />
            </div>
          </div>
          <div className="bps-hero-visual">
            <div className="bps-demo-label">
              <span>
                <span className="bps-demo-dot" />
                {m.demo}
              </span>
              <span>
                {m.tryIt}
                <ArrowDownIcon aria-hidden="true" />
              </span>
            </div>
            <BaitlyProductDemo kind={kind} language={language} />
            <p className="bps-illustration-note">{m.example}</p>
          </div>
          <ul className="bps-promises">
            {story.promises.map((promise) => (
              <li key={promise}>
                <CheckIcon aria-hidden="true" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Ecosystem kind={kind} language={language} />

      {kind === 'agents' && <AgentDirectory language={language} />}

      <section
        className="bps-features site-shell"
        id="fonctionnalites"
        aria-labelledby="bps-features-title"
      >
        <Reveal className="bps-section-heading">
          <h2 id="bps-features-title">{story.featuresTitle}</h2>
          <p>{story.featuresIntro}</p>
        </Reveal>
        <div className="bps-feature-layout">
          <Reveal className="bps-editorial-photo">
            <img
              src={SITE_PHOTOS[PHOTO_KEYS[kind]]}
              alt={sitePhotoAlt(PHOTO_KEYS[kind], language)}
              width="760"
              height="720"
              loading="lazy"
            />
            <div className="bps-photo-caption">
              <Icon aria-hidden="true" />
              <p>{story.imageCaption}</p>
            </div>
          </Reveal>
          <div className="bps-feature-list">
            {features.map((feature, index) => (
              <details
                key={feature.title}
                open={index === 0 ? true : undefined}
              >
                <summary>
                  <span className="bps-feature-number">0{index + 1}</span>
                  <h3>{feature.title}</h3>
                  <ChevronDownIcon aria-hidden="true" />
                </summary>
                <p>{feature.copy}</p>
              </details>
            ))}
          </div>
        </div>
        {(kind === 'operations' || kind === 'devices' || kind === 'owners') && (
          <AppPreview kind={kind} language={language} />
        )}
      </section>

      <section className="bps-workflow" aria-labelledby="bps-workflow-title">
        <div className="site-shell bps-workflow-layout">
          <div className="bps-workflow-copy">
            <Reveal className="bps-workflow-heading">
              <h2 id="bps-workflow-title">{story.workflowTitle}</h2>
            </Reveal>
            <ol className="bps-steps">
              {story.steps.map((step, index) => (
                <Reveal
                  as="li"
                  key={step.title}
                  delay={(index + 1) as 1 | 2 | 3}
                >
                  <span className="bps-step-number" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
          <Reveal className="bps-workflow-photo">
            <img
              src={SITE_PHOTOS[photos.workflow]}
              alt={sitePhotoAlt(photos.workflow, language)}
              width="1000"
              height="1000"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>
      </section>

      <section className="bps-faq site-shell" aria-labelledby="bps-faq-title">
        <Reveal>
          <p className="bps-eyebrow">Baitly · {text.name}</p>
          <h2 id="bps-faq-title">{m.faq}</h2>
        </Reveal>
        <div>
          {faq.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ChevronDownIcon aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bps-final site-shell">
        <div className="bps-final-panel">
          <div>
            <p className="bps-eyebrow">Baitly</p>
            <h2>{story.finalTitle}</h2>
            <p>{m.finalCopy}</p>
          </div>
          <div className="bps-final-actions">
            <SiteAcquisitionLink
              className="bps-button"
              to={`/demo?lang=${language}`}
            >
              {m.cta}
              <ArrowRightIcon aria-hidden="true" />
            </SiteAcquisitionLink>
            <Link to={`/tarifs?lang=${language}`} className="bps-text-link">
              {m.pricing}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
            <Link
              to={`/migration?lang=${language}`}
              className="bps-subtle-link"
            >
              {m.migration}
            </Link>
          </div>
        </div>
      </section>

      <nav className="bps-more site-shell" aria-label={m.otherModules}>
        <p>{m.otherModules}</p>
        <div>
          {(Object.entries(PRODUCT_STORY_SLUGS) as [ProductStoryKind, string][])
            .filter(([key]) => key !== kind)
            .map(([key, path]) => (
              <Link key={key} to={`/produit/${path}?lang=${language}`}>
                {moduleText(path, language).name}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            ))}
        </div>
      </nav>
    </div>
  );
}
