import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { useSiteLanguage } from "../lib/siteLanguage";
import { BAITLY_READINESS_MESSAGES } from "../lib/messages/baitlyReadiness";
import BaitlyNavPreview from "./BaitlyNavPreview";
import BaitlyBookingPreview from "./BaitlyBookingPreview";
import "../baitly-readiness.css";

/** Product demonstrations provide evidence without implying customer adoption. */
export default function BaitlyProductProofs() {
  const { language } = useSiteLanguage();
  const m = BAITLY_READINESS_MESSAGES[language].next;
  return (
    <section
      className="baitly-proof-section"
      aria-labelledby="baitly-proof-title"
    >
      <div className="baitly-proof-heading">
        <h2 id="baitly-proof-title">{m.explore}</h2>
        <p>{m.copy}</p>
      </div>
      <div className="baitly-proof-grid">
        <Link
          className="baitly-proof"
          to={`/produit/pms-channel-manager?lang=${language}`}
        >
          <div className="baitly-proof-preview" aria-hidden="true">
            <BaitlyNavPreview kind="sync" />
          </div>
          <div className="baitly-proof-copy">
            <h3>{m.planning}</h3>
            <p>{m.planningCopy}</p>
            <span>
              {m.action}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </span>
          </div>
        </Link>
        <Link
          className="baitly-proof"
          to={`/produit/booking-engine?lang=${language}`}
        >
          <div className="baitly-proof-preview" aria-hidden="true">
            <BaitlyBookingPreview compact />
          </div>
          <div className="baitly-proof-copy">
            <h3>{m.booking}</h3>
            <p>{m.bookingCopy}</p>
            <span>
              {m.action}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
