import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import BaitlyProductProofs from "../components/BaitlyProductProofs";
import { useSiteLanguage } from "../lib/siteLanguage";
import {
  BAITLY_COMPARISON_ROUTES,
  BAITLY_READINESS_MESSAGES,
} from "../lib/messages/baitlyReadiness";

export default function ComparePage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_READINESS_MESSAGES[language].compare;
  return (
    <div className="baitly-readiness site-shell">
      <section className="baitly-compare-hero">
        <p className="baitly-readiness-eyebrow">{m.eyebrow}</p>
        <h1>{m.title}</h1>
        <p className="baitly-readiness-lead">{m.intro}</p>
      </section>
      <BaitlyProductProofs />
      <p className="baitly-readiness-note">{m.note}</p>
      <section
        className="baitly-compare-criteria"
        aria-labelledby="comparison-criteria-title"
      >
        <div className="baitly-proof-heading">
          <h2 id="comparison-criteria-title">{m.criteriaTitle}</h2>
          <p>{m.criteriaCopy}</p>
        </div>
        <ol>
          {m.criteria.map((criterion, index) => (
            <li key={criterion.title}>
              <span className="baitly-criterion-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="baitly-criterion-topic">
                  {criterion.title}
                </span>
                <h3>{criterion.question}</h3>
              </div>
              <div>
                <p>{criterion.copy}</p>
                <Link
                  className="baitly-text-link"
                  to={`${BAITLY_COMPARISON_ROUTES[index]}?lang=${language}`}
                >
                  {criterion.action}
                  <ArrowRightIcon size={17} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="baitly-compare-next">
        <h2>{m.closingTitle}</h2>
        <p>{m.closingCopy}</p>
        <div className="baitly-readiness-actions">
          <Link className="baitly-button" to={`/tarifs?lang=${language}`}>
            {m.pricing}
            <ArrowRightIcon size={18} aria-hidden="true" />
          </Link>
          <Link className="baitly-text-link" to={`/migration?lang=${language}`}>
            {m.migration}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
