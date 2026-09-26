import SiteMoney, { SiteMoneyText } from '../components/SiteMoney';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  SparklesIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AnimatedPlanningMockup from '../components/AnimatedPlanningMockup';
import BaitlyChannelFlow from '../components/BaitlyChannelFlow';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import Reveal from '../components/Reveal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_PMS_MESSAGES } from '../lib/messages/baitlyPms';
import { moduleText } from '../lib/messages/modules';
import airbnb from '../assets/brands/airbnb.svg';
import booking from '../assets/brands/bookingdotcom.svg';
import '../baitly-pms.css';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';

const {
  pmsRiad: riad,
  pmsArrival: bedroom,
  pmsCleaning: cleaning,
} = SITE_PHOTOS;

export default function BaitlyPmsPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_PMS_MESSAGES[language];
  const text = moduleText('pms-channel-manager', language);
  return (
    <div className="bpm-page">
      <section className="bpm-hero">
        <div className="site-shell bpm-hero-layout">
          <div className="bpm-hero-copy">
            <p className="bpm-eyebrow">
              <CalendarDaysIcon />
              {m.eyebrow}
            </p>
            <h1>
              {m.title[0]}
              <br />
              <span>{m.title[1]}</span>
            </h1>
            <p className="bpm-intro">{m.intro}</p>
            <div className="bpm-actions">
              <SiteAcquisitionLink to="/demo" className="baitly-button">
                {m.cta}
                <ArrowRightIcon />
              </SiteAcquisitionLink>
              <a href="#planning-demo" className="bpm-text-link">
                {m.explore}
                <ArrowDownIcon />
              </a>
            </div>
            <ul className="bpm-promises">
              {m.promises.map((p) => (
                <li key={p}>
                  <CheckIcon />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="bpm-hero-art">
            <img
              src={riad}
              alt={sitePhotoAlt('pmsRiad', language)}
              className="bpm-hero-photo"
              fetchPriority="high"
            />
            <div className="bpm-hero-location">
              <span>{m.hero.location}</span>
              <strong>{m.hero.property}</strong>
            </div>
            <div className="bpm-booking-ticket">
              <div className="bpm-ticket-top">
                <span>{m.hero.eyebrow}</span>
                <img src={airbnb} alt="Airbnb" width="25" height="25" />
              </div>
              <div className="bpm-ticket-guest">
                <span className="bpm-guest-initials" aria-hidden="true">
                  {m.hero.guest
                    .split(' ')
                    .map((name) => name[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <strong>{m.hero.guest}</strong>
                  <span>{m.hero.nights}</span>
                </div>
                <span className="bpm-status">{m.hero.status}</span>
              </div>
              <div className="bpm-ticket-date">
                <CalendarDaysIcon />
                <strong>{m.hero.dates}</strong>
                <span>
                  <bdi>
                    <SiteMoney
                      value={4800}
                      from={language === 'ar' ? 'SAR' : 'MAD'}
                    />
                  </bdi>
                </span>
              </div>
              <div className="bpm-ticket-calendar" aria-hidden="true">
                <span>28</span>
                <span>29</span>
                <span>30</span>
                <span>01</span>
                <span>02</span>
                <div>
                  <CheckIcon />
                  {m.hero.guest}
                </div>
              </div>
              <div className="bpm-ticket-sync">
                <RefreshCwIcon />
                <span>{m.hero.sync}</span>
              </div>
            </div>
            <small className="bpm-art-caption">{m.hero.caption}</small>
          </div>
        </div>
        <div className="site-shell bpm-channel-strip">
          <p>{m.channelIntro}</p>
          <div>
            <span>
              <img src={airbnb} alt="" />
              Airbnb
            </span>
            <span>
              <img src={booking} alt="" />
              Booking.com
            </span>
            <span>
              <GlobeIcon />
              {m.direct}
            </span>
          </div>
        </div>
      </section>

      <section className="site-shell bpm-planning-section" id="planning-demo">
        <Reveal className="bpm-section-heading">
          <div>
            <p className="bpm-eyebrow">{m.planning.eyebrow}</p>
            <h2>{m.planning.title}</h2>
          </div>
          <p>{m.planning.intro}</p>
        </Reveal>
        <AnimatedPlanningMockup />
        <div className="bpm-planning-keys">
          <div>
            <span className="bpm-status-swatches" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <p>{m.planning.legends[0]}</p>
          </div>
          <div>
            <span className="bpm-key-channels">
              <img src={airbnb} alt="Airbnb" />
              <img src={booking} alt="Booking.com" />
            </span>
            <p>{m.planning.legends[1]}</p>
          </div>
          <div>
            <span className="bpm-key-badges" aria-hidden="true">
              <CheckIcon />
              <span>+3</span>
            </span>
            <p>{m.planning.legends[2]}</p>
          </div>
        </div>
        <p className="bpm-demo-note">{m.planning.note}</p>
      </section>

      <section className="bpm-sync-section">
        <div className="site-shell bpm-sync-layout">
          <Reveal className="bpm-sync-visual">
            <div className="bpm-sync-channels">
              <span>
                <img src={airbnb} alt="" />
                Airbnb
              </span>
              <span>
                <img src={booking} alt="" />
                Booking.com
              </span>
              <span>
                <GlobeIcon />
                {m.direct}
              </span>
            </div>
            <BaitlyChannelFlow />
            <div className="bpm-sync-hub">
              <span className="bpm-hub-symbol">
                <CalendarDaysIcon />
              </span>
              <strong>baitly</strong>
              <span>{m.sync.hub}</span>
            </div>
            <div className="bpm-sync-ledger">
              <div>
                <CalendarDaysIcon />
                <strong>{m.sync.date}</strong>
                <span>
                  <CheckIcon />
                  {m.sync.status}
                </span>
              </div>
              {m.sync.fields.map((field, i) => (
                <div key={field}>
                  <span>{field}</span>
                  <strong>
                    <SiteMoneyText>{m.sync.values[i]}</SiteMoneyText>
                  </strong>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="bpm-sync-copy">
            <p className="bpm-eyebrow">{m.sync.eyebrow}</p>
            <h2>{m.sync.title}</h2>
            <p>{m.sync.intro}</p>
            <ol>
              {m.sync.labels.map((label, i) => (
                <li key={label}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{label}</h3>
                    <p>{m.sync.details[i]}</p>
                  </div>
                </li>
              ))}
            </ol>
            <small>{m.sync.footnote}</small>
          </div>
        </div>
      </section>

      <section className="site-shell bpm-stay-section">
        <Reveal className="bpm-section-heading">
          <div>
            <p className="bpm-eyebrow">{m.stay.eyebrow}</p>
            <h2>{m.stay.title}</h2>
          </div>
          <p>{m.stay.intro}</p>
        </Reveal>
        <div className="bpm-stay-grid">
          <article className="bpm-arrival-card">
            <div className="bpm-arrival-visual">
              <img
                src={bedroom}
                alt={sitePhotoAlt('pmsArrival', language)}
                loading="lazy"
              />
              <div>
                <span className="bpm-guest-initials" aria-hidden="true">
                  {m.stay.guest
                    .split(' ')
                    .map((name) => name[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <strong>{m.stay.guest}</strong>
                <span>{m.stay.checkin}</span>
                <span className="bpm-paid">
                  <CheckIcon />
                  {m.stay.paid}
                </span>
              </div>
            </div>
            <div className="bpm-story-copy">
              <h3>{m.stay.arrival}</h3>
              <p>{m.stay.arrivalCopy}</p>
              <Link to="/produit/paiements-finances" className="bpm-text-link">
                {m.stay.finance}
                <ArrowRightIcon />
              </Link>
            </div>
          </article>
          <article className="bpm-cleaning-card">
            <div className="bpm-cleaning-visual">
              <img
                src={cleaning}
                alt={sitePhotoAlt('pmsCleaning', language)}
                loading="lazy"
              />
              <div>
                <span>
                  <SparklesIcon />
                  {m.stay.cleanStatus}
                </span>
                <strong>{m.stay.cleanTime}</strong>
                <span className="bpm-cleaning-track" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
            <div className="bpm-story-copy">
              <h3>{m.stay.cleaning}</h3>
              <p>{m.stay.cleaningCopy}</p>
              <Link to="/produit/operations-menage" className="bpm-text-link">
                {m.stay.operations}
                <ArrowRightIcon />
              </Link>
            </div>
          </article>
        </div>
        <p className="bpm-stay-footer">
          <LockKeyholeIcon />
          {m.stay.footer}
        </p>
      </section>

      <section className="site-shell bpm-faq">
        <h2>{m.faq}</h2>
        <div>
          {text.faq.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ChevronDownIcon />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="bpm-final">
        <div className="site-shell">
          <div>
            <p className="bpm-eyebrow">{m.final.eyebrow}</p>
            <h2>{m.final.title}</h2>
            <p>{m.final.copy}</p>
          </div>
          <div className="bpm-actions">
            <SiteAcquisitionLink to="/demo" className="baitly-button">
              {m.cta}
              <ArrowRightIcon />
            </SiteAcquisitionLink>
            <Link to="/migration" className="bpm-text-link">
              {m.final.migration}
              <ArrowRightIcon />
            </Link>
            <Link to="/tarifs" className="bpm-text-link">
              {m.pricing}
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
