import { Link } from "react-router-dom";
import { ArrowRightIcon, HistoryIcon, RadioIcon } from "lucide-react";
import BaitlyMarkLogo from "../../src/components/BaitlyMarkLogo";
import { useSiteLanguage } from "../lib/siteLanguage";
import { useSiteLaunch } from "../lib/siteLaunch";
import { PRELAUNCH_MESSAGES } from "../lib/messages/prelaunch";
import { BAITLY_READINESS_MESSAGES } from "../lib/messages/baitlyReadiness";
import "../baitly-readiness.css";

export default function StatusPage() {
  const { language } = useSiteLanguage();
  const { paused, loading, error, refresh } = useSiteLaunch();
  const m = BAITLY_READINESS_MESSAGES[language].status;
  const uncertain = loading || Boolean(error);
  const title = uncertain ? m.unknownTitle : paused ? m.title : m.openTitle;
  const intro = uncertain ? m.unknownIntro : paused ? m.intro : m.openIntro;
  const label = loading
    ? m.loading
    : error
      ? m.unknown
      : paused
        ? m.launch
        : m.open;

  return (
    <div className="baitly-readiness site-shell">
      <section className="baitly-readiness-hero">
        <div>
          <p className="baitly-readiness-eyebrow">{m.eyebrow}</p>
          <h1>{title}</h1>
          <p className="baitly-readiness-lead">{intro}</p>
          <div className="baitly-readiness-actions">
            <Link
              className="baitly-button"
              to={`/bientot-disponible?lang=${language}`}
            >
              {paused || uncertain
                ? m.action
                : PRELAUNCH_MESSAGES[language].register}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <Link
              className="baitly-text-link"
              to={`/produit/pms-channel-manager?lang=${language}`}
            >
              {m.explore}
            </Link>
          </div>
        </div>
        <aside className="baitly-readiness-context">
          <BaitlyMarkLogo variant="mark" size={64} colorMode="inherit" />
          <p className="baitly-readiness-label" role="status">
            {label}
          </p>
          <h2>{m.contextTitle}</h2>
          <p>{m.contextCopy}</p>
          {error && (
            <button
              className="baitly-text-link"
              type="button"
              onClick={refresh}
            >
              {PRELAUNCH_MESSAGES[language].retry}
            </button>
          )}
        </aside>
      </section>
      <section
        className="baitly-readiness-services"
        aria-labelledby="service-status-title"
      >
        <div>
          <h2 id="service-status-title">{m.componentsTitle}</h2>
          <p>{m.componentsCopy}</p>
          <ul className="baitly-service-status-list">
            {m.components.map((component) => (
              <li key={component}>
                <span>{component}</span>
                <span>
                  <RadioIcon size={15} aria-hidden="true" />
                  {m.unmeasured}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="baitly-readiness-target">
          <span>{m.targetLabel}</span>
          <h3>{m.measurementTitle}</h3>
          <p>{m.measurementCopy}</p>
          <Link className="baitly-text-link" to={`/legal/cgv?lang=${language}`}>
            {m.terms}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </aside>
      </section>
      <section className="baitly-readiness-history">
        <HistoryIcon size={26} aria-hidden="true" />
        <div>
          <h2>{m.incidentsTitle}</h2>
          <p>{m.noIncidents}</p>
        </div>
      </section>
    </div>
  );
}
