import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  GlobeIcon,
} from '../../src/icons/glyphs';
import { Link } from 'react-router-dom';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import BaitlyBookingDemo from '../components/BaitlyBookingDemo';
import BaitlyBookingPreview from '../components/BaitlyBookingPreview';
import BaitlyBookingUpsells from '../components/BaitlyBookingUpsells';
import { BAITLY_BOOKING_UPSELL_MESSAGES } from '../lib/messages/baitlyBookingUpsells';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { moduleText } from '../lib/messages/modules';
import { useSiteLanguage } from '../lib/siteLanguage';

export default function BaitlyBookingPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const upsells = BAITLY_BOOKING_UPSELL_MESSAGES[language];
  const text = moduleText('booking-engine', language);
  return (
    <div className="bb-page">
      <section className="bb-hero site-shell">
        <div className="bb-hero-copy">
          <p className="bb-eyebrow">
            <GlobeIcon />
            {m.eyebrow}
          </p>
          <h1>
            {m.title[0]}
            <br />
            <span>{m.title[1]}</span>
          </h1>
          <p className="bb-intro">{m.intro}</p>
          <div className="bb-actions">
            <SiteAcquisitionLink to="/demo" className="baitly-button">
              {m.cta}
              <ArrowRightIcon />
            </SiteAcquisitionLink>
            <a href="#booking-templates" className="bb-explore">
              {m.explore}
              <ArrowDownIcon />
            </a>
            <a href="#booking-upsells" className="bb-explore">
              {upsells.link}
              <ArrowDownIcon />
            </a>
          </div>
          <ul className="bb-promises">
            {m.promises.map((promise) => (
              <li key={promise}>
                <CheckIcon />
                {promise}
              </li>
            ))}
          </ul>
        </div>
        <div className="bb-hero-visual">
          <BaitlyBookingPreview />
          <p>
            {m.demo} · {m.templateCount}
          </p>
        </div>
      </section>
      <BaitlyBookingUpsells />
      <BaitlyBookingDemo />
      <section className="bb-capabilities site-shell">
        <div>
          {text.features.map((feature, index) => (
            <article key={feature.title}>
              <span>0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bb-faq site-shell">
        <h2>{m.faq}</h2>
        <div>
          {text.faq.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ArrowDownIcon />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="bb-final site-shell">
        <div>
          <h2>{m.finalTitle}</h2>
          <p>{m.finalCopy}</p>
          <div className="bb-actions">
            <SiteAcquisitionLink to="/demo" className="baitly-button">
              {m.cta}
              <ArrowRightIcon />
            </SiteAcquisitionLink>
            <Link to="/tarifs" className="bb-explore">
              {m.pricing}
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
