import { Link } from 'react-router-dom';
import { ArrowRightIcon, KeyRound, Volume2, Video } from '../../src/icons/glyphs';
import { useSiteLanguage } from '../lib/siteLanguage';
import { HOME_HIGHLIGHT_MESSAGES } from '../lib/messages/homeHighlights';
import { CONNECTED_HOME_MESSAGES } from '../lib/messages/connectedHome';
import connectedHome from '../assets/photos/editorial/baitlyConnectedHome.webp';
import Reveal from './Reveal';
import '../baitly-home-highlights.css';

const DEVICE_ICONS = [KeyRound, Volume2, Video];

export default function BaitlyHomeConnectedSection() {
  const { language } = useSiteLanguage();
  const m = HOME_HIGHLIGHT_MESSAGES[language].connected;
  const destination = `/produit/objets-connectes?lang=${language}`;
  return (
    <section className="site-shell bh-connected" aria-labelledby="home-connected-title">
      <Reveal className="bh-connected-visual">
        <Link to={destination} aria-label={m.link}>
          <img src={connectedHome} alt={CONNECTED_HOME_MESSAGES[language].illustrationAlt}
            width={1448} height={1086} loading="lazy" decoding="async" />
          <span className="bh-image-arrow" aria-hidden="true"><ArrowRightIcon /></span>
        </Link>
      </Reveal>
      <Reveal delay={1} className="bh-connected-copy">
        <p className="baitly-section-label">{m.label}</p>
        <h2 id="home-connected-title">{m.title}</h2>
        <p className="bh-intro">{m.intro}</p>
        <ul className="bh-device-benefits">
          {m.benefits.map(([title, copy], index) => {
            const Icon = DEVICE_ICONS[index];
            return <li key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{copy}</p></div></li>;
          })}
        </ul>
        <Link to={destination} className="baitly-text-link">{m.link}<ArrowRightIcon aria-hidden="true" /></Link>
      </Reveal>
    </section>
  );
}
