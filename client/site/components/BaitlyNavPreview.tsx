import { SiteAgentPortrait } from './SiteProductVisuals';
import { SITE_PRODUCT_ARTWORK } from '../data/productArtwork';
import SiteMoney, { SiteMoneyText } from './SiteMoney';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  GlobeIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  PlayIcon,
  ShieldCheckIcon,
  WifiIcon,
} from 'lucide-react';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import BaitlyChannelFlow from './BaitlyChannelFlow';
import BaitlySolutionNavPreview, {
  type BaitlySolutionPreviewKind,
} from './BaitlySolutionNavPreview';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_PRODUCT_DEMO_MESSAGES } from '../lib/messages/baitlyProductDemos';
import { BAITLY_PMS_MESSAGES } from '../lib/messages/baitlyPms';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import { BAITLY_ACADEMY_MESSAGES } from '../lib/messages/baitlyAcademy';
import {
  ACADEMY_EPISODES,
  academyPosterUrl,
} from '../data/baitlyAcademyVideos';
import { formatClock } from './academy/BaitlyVideoPlayer';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';
import { MARKET_CITIES } from '../data/baitlyResources';
import {
  demoNightlyPrices,
  demoOwnerStatement,
} from '../data/baitlyProductStories';
import airbnb from '../assets/brands/airbnb.svg';
import booking from '../assets/brands/bookingdotcom.svg';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  guideLiving: riad,
  operationsProof: bedroom,
  guideBalloon: balloon,
} = SITE_PHOTOS;

export type BaitlyNavPreviewKind =
  | BaitlySolutionPreviewKind
  | 'sync'
  | 'guide'
  | 'agents'
  | 'revenue'
  | 'finance'
  | 'operations'
  | 'devices'
  | 'owners'
  | 'market'
  | 'calculator'
  | 'obligations'
  | 'academy'
  | 'editorial'
  | 'glossary';

const LABELS = {
  fr: {
    welcome: 'Bienvenue chez vous',
    services: 'À vivre ici',
    guide: 'Votre livret',
    access: 'Accès au logement',
    revenue: 'Tarifs par nuit',
    definition: 'Prix moyen par nuit',
  },
  en: {
    welcome: 'Make yourself at home',
    services: 'Experience your stay',
    guide: 'Your guest guide',
    access: 'Property access',
    revenue: 'Nightly rates',
    definition: 'Average nightly rate',
  },
  ar: {
    welcome: 'أهلاً بكم',
    services: 'تجارب الإقامة',
    guide: 'دليلك',
    access: 'دخول الوحدة',
    revenue: 'أسعار الليالي',
    definition: 'متوسط سعر الليلة',
  },
};

function Window({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bnv-window">
      <div className="bnv-window-bar">
        <BaitlyMarkLogo
          variant="mark"
          size={16}
          disableAnimation
          colorMode="inherit"
        />
        <span>{title}</span>
        <i />
        <i />
        <i />
      </div>
      {children}
    </div>
  );
}

/** Lightweight illustrations, using the same examples as the destination pages.
 * No controls or background requests: the menu link remains the only action. */
export default function BaitlyNavPreview({
  kind,
}: {
  kind: BaitlyNavPreviewKind;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
  const pms = BAITLY_PMS_MESSAGES[language];
  const resources = BAITLY_RESOURCE_MESSAGES[language];
  const agent = MOCKUP_MESSAGES[language].demo;
  const l = LABELS[language];
  const number = (n: number) =>
    new Intl.NumberFormat(
      { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' }[language],
    ).format(n);

  let scene: ReactNode;
  switch (kind) {
    case 'concierge':
    case 'host':
    case 'riad':
    case 'saudi':
    case 'morocco':
    case 'france':
    case 'multi-owner':
      scene = <BaitlySolutionNavPreview kind={kind} language={language} />;
      break;
    case 'sync':
      scene = (
        <>
          <div className="bnv-channels">
            <span>
              <img src={airbnb} alt="" />
              <small>Airbnb</small>
            </span>
            <span>
              <img src={booking} alt="" />
              <small>Booking.com</small>
            </span>
            <span>
              <GlobeIcon />
              <small>{pms.direct}</small>
            </span>
          </div>
          <BaitlyChannelFlow />
          <div className="bnv-hub">
            <BaitlyMarkLogo variant="full" size={23} colorMode="inherit" />
            <CheckIcon />
          </div>
          <span className="bnv-sync-caption">{pms.sync.status}</span>
        </>
      );
      break;
    case 'guide':
      scene = (
        <>
          <div className="bnv-guide-phone">
            <img className="bnv-guide-cover" src={riad} alt="" />
            <span>{l.welcome}</span>
            <strong>{m.property}</strong>
            <div className="bnv-guide-shortcuts">
              <KeyRoundIcon />
              <WifiIcon />
              <GlobeIcon />
            </div>
          </div>
          <div className="bnv-guide-extras">
            <span>{l.services}</span>
            <img src={balloon} alt="" />
            <strong>{l.guide}</strong>
            <span className="bnv-status">
              <CheckIcon /> FR · EN · AR
            </span>
          </div>
        </>
      );
      break;
    case 'agents':
      scene = (
        <Window title={`${agent.agentPrefix} ${agent.scenarios[0].name}`}>
          <div className="bnv-agent">
            <SiteAgentPortrait agent="rev" size={48} /><small>{agent.propertyName}</small>
            <strong>{agent.scenarios[0].title}</strong>
            <div className="bnv-rate-change">
              <s>
                <SiteMoneyText>{agent.steps[0].before}</SiteMoneyText>
              </s>
              <ArrowRightIcon />
              <b>
                <SiteMoneyText>{agent.steps[0].after}</SiteMoneyText>
              </b>
            </div>
            <span className="bnv-approval">
              <ShieldCheckIcon />
              {agent.scenarios[0].action}
              <CheckIcon className="bnv-arrive" />
            </span>
          </div>
        </Window>
      );
      break;
    case 'revenue': {
      const prices = demoNightlyPrices(1, 650);
      scene = (
        <Window title={l.revenue}>
          <div className="bnv-chart" dir="ltr">
            {prices.map((price, i) => (
              <div
                key={i}
                style={
                  {
                    '--bnv-bar': price / 1200,
                    '--bnv-delay': `${i * 80}ms`,
                  } as CSSProperties
                }
              >
                <small>
                  <SiteMoney value={price} from="MAD" symbol={false} />
                </small>
                <i />
                <span>{m.revenue.days[i]}</span>
              </div>
            ))}
          </div>
          <div className="bnv-chart-floor">
            <ShieldCheckIcon />
            {m.revenue.floor}
            <bdi>
              <SiteMoney value={650} from="MAD" />
            </bdi>
          </div>
        </Window>
      );
      break;
    }
    case 'finance':
      scene = (
        <Window title={m.finance.steps[1]}>
          <div className="bnv-receipt">
            <div className="bnv-receipt-heading">
              <img src={SITE_PRODUCT_ARTWORK.received} width={40} height={40} alt="" />
              <span>
                {m.property}
                <small dir="ltr">#BT-2409</small>
              </span>
              <bdi>
                <SiteMoney value={2550} from="MAD" />
              </bdi>
            </div>
            <div className="bnv-payment-trail">
              {m.finance.steps.map((step, i) => (
                <span key={step}>
                  <CheckIcon
                    style={{ '--bnv-delay': `${i * 180}ms` } as CSSProperties}
                  />
                  {step}
                </span>
              ))}
            </div>
            <span className="bnv-status bnv-arrive">
              <CheckIcon />
              {m.finance.done}
            </span>
          </div>
        </Window>
      );
      break;
    case 'operations':
      scene = (
        <Window title={m.operations.team}>
          <div className="bnv-mission">
            <div className="bnv-mission-photo">
              <img src={bedroom} alt="" />
              <span>11:00 → 15:00</span>
            </div>
            <div>
              <strong>{m.property}</strong>
              {m.operations.tasks.map((task, i) => (
                <span className="bnv-task" key={task}>
                  <CheckIcon
                    style={{ '--bnv-delay': `${i * 240}ms` } as CSSProperties}
                  />
                  {task}
                </span>
              ))}
            </div>
          </div>
          <span className="bnv-status bnv-mission-status">
            {m.operations.done}
            <CheckIcon />
          </span>
        </Window>
      );
      break;
    case 'devices':
      scene = (
        <>
          <div className="bnv-lock">
            <LockKeyholeIcon />
            <div>
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span />
          </div>
          <div className="bnv-pass">
            <KeyRoundIcon />
            <small>{l.access}</small>
            <strong dir="ltr">428 716</strong>
            <span className="bnv-status bnv-arrive">
              <CheckIcon />
              {m.devices.states[1]}
            </span>
            <small>{m.devices.arrival}</small>
          </div>
        </>
      );
      break;
    case 'owners': {
      const statement = demoOwnerStatement(2);
      scene = (
        <Window title={m.owners.document}>
          <div className="bnv-owner">
            <div className="bnv-owner-heading">
              <img src={SITE_PHOTOS.ownersStay} alt="" />
              <span>
                <strong>{m.property}</strong>
                <small>{m.owners.months[2]}</small>
              </span>
              <FileTextIcon />
            </div>
            <div className="bnv-money-line">
              <span>{m.owners.gross}</span>
              <bdi>
                <SiteMoney value={statement.gross} from="MAD" />
              </bdi>
            </div>
            <div className="bnv-money-line bnv-owner-net">
              <span>{m.owners.net}</span>
              <bdi>
                <SiteMoney value={statement.net} from="MAD" />
              </bdi>
            </div>
          </div>
        </Window>
      );
      break;
    }
    case 'calculator':
      scene = (
        <Window title={resources.modules.calculateur.name}>
          <div className="bnv-calculator">
            <span>
              {resources.calc.fields[3]} × {resources.calc.nights}
            </span>
            <strong>
              <bdi>
                <SiteMoney value={950} from="MAD" />
              </bdi>
              <span>×</span>
              <bdi>20</bdi>
            </strong>
            <div className="bnv-formula-rule" />
            <small>{m.owners.gross}</small>
            <bdi className="bnv-formula-result">
              <SiteMoney value={19000} from="MAD" />
            </bdi>
          </div>
        </Window>
      );
      break;
    case 'market':
      scene = (
        <Window title={resources.modules.barometre.name}>
          <div className="bnv-market">
            <GlobeIcon />
            <strong>{resources.market.growth}</strong>
            <span>{resources.market.period}</span>
            <div>
              {MARKET_CITIES.slice(0, 3).map((city, i) => (
                <span key={city.id}>
                  <small>+{number(city.growth)} %</small>
                  <i
                    style={
                      {
                        '--bnv-bar': city.growth / 20,
                        '--bnv-delay': `${i * 120}ms`,
                      } as CSSProperties
                    }
                  />
                  <small>{language === 'ar' ? city.ar : city.name}</small>
                </span>
              ))}
            </div>
          </div>
        </Window>
      );
      break;
    case 'obligations':
      scene = (
        <Window title={resources.modules.obligations.name}>
          <div className="bnv-obligations">
            <span className="bnv-country">{resources.guide.countries[0]}</span>
            {resources.guide.previewSteps.map((step, i) => (
              <span className="bnv-task" key={step}>
                <CheckIcon
                  style={{ '--bnv-delay': `${i * 240}ms` } as CSSProperties}
                />
                {step}
              </span>
            ))}
          </div>
        </Window>
      );
      break;
    case 'academy': {
      // La vitrine montre la formation la plus récente, avec sa vraie image et sa durée.
      const academy = BAITLY_ACADEMY_MESSAGES[language];
      const latest = ACADEMY_EPISODES[ACADEMY_EPISODES.length - 1];
      scene = (
        <div className="bnv-academy">
          <div className="bnv-lesson-art">
            <img src={academyPosterUrl(latest, '16x9')} alt="" />
            <span>
              <PlayIcon />
            </span>
          </div>
          <small>
            {academy.ui.latest} · {formatClock(Math.round(latest.duration))}
          </small>
          <strong>{academy.episodes[latest.slug].title}</strong>
          <div className="bnv-lesson-progress">
            <i />
          </div>
        </div>
      );
      break;
    }
    case 'editorial':
      scene = (
        <div className="bnv-editorial">
          <img src={SITE_PHOTOS.articleDirect} alt="" />
          <span>{resources.blog.articles[0].category}</span>
          <strong>{resources.blog.articles[0].title}</strong>
          <small>
            {resources.blog.read}
            <ArrowRightIcon />
          </small>
        </div>
      );
      break;
    case 'glossary':
      scene = (
        <div className="bnv-glossary">
          <span>
            Aa <small>A → Z</small>
          </span>
          <div>
            <strong>ADR</strong>
            <span>{l.definition}</span>
            <small>Average Daily Rate</small>
          </div>
          <span className="bnv-glossary-index">
            ADR <i /> OTA <i /> PMS <i /> RevPAR
          </span>
        </div>
      );
      break;
  }
  return (
    <div
      className={`bnv-preview bnv-scene-${kind}`}
      data-preview={kind}
      aria-hidden="true"
    >
      {scene}
    </div>
  );
}
