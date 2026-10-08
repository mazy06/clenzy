import {
  ArrowRight,
  CalendarDays,
  Check,
  FileSpreadsheet,
  House,
  Users,
  Wallet,
  Bell,
  BedDouble,
  Bath,
  MapPin,
  ShieldCheck,
  FileCheck2,
  Mail,
  Phone,
  CreditCard,
  Building2,
  SlidersHorizontal,
  ClipboardCheck,
  UserRound,
} from "../../icons/glyphs";
import { useTranslation } from "../../hooks/useTranslation";
import riadPhoto from "../../../site/assets/photos/baitly-riad.webp";
import hostPhoto from "../../../site/assets/photos/host.jpg";
import "./setup-surfaces.css";

/** Illustrative data flow, deliberately separate from real account data. */
export default function SetupIllustration({
  step = "migrate_pms",
}: {
  step?: string;
}) {
  const { t } = useTranslation();
  if (step !== "migrate_pms") return <StepScene step={step} />;
  return (
    <div
      className="setup-illustration"
      data-scene="migrate_pms"
      aria-hidden="true"
    >
      <div className="setup-illustration-orbit" />
      <div className="setup-source-paper">
        <span className="setup-paper-icon">
          <FileSpreadsheet size={23} strokeWidth={1.6} />
        </span>
        <strong>{t("setupVisual.files")}</strong>
        <div className="setup-paper-lines">
          <i />
          <i />
          <i />
        </div>
        <span className="setup-file-types" dir="ltr">
          CSV · Excel · JSON
        </span>
      </div>
      <div className="setup-flow-path">
        <span />
        <ArrowRight size={24} />
      </div>
      <div className="setup-property-preview">
        <img src={riadPhoto} alt="" width="700" height="700" decoding="async" />
        <div className="setup-property-caption">
          <House size={18} />
          <strong>{t("setupVisual.properties")}</strong>
          <span>
            <Check size={12} />
          </span>
        </div>
        <div className="setup-mini-calendar">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <b />
          <b />
        </div>
      </div>
      <div className="setup-guest-preview">
        <img src={hostPhoto} alt="" width="160" height="160" decoding="async" />
        <span>
          <strong>{t("setupVisual.guests")}</strong>
          <small>{t("setupVisual.connected")}</small>
        </span>
        <Check size={15} />
      </div>
    </div>
  );
}

/** Short, finite animations illustrate the task, never the state of the user's account. */
function StepScene({ step }: { step: string }) {
  const { t, currentLanguage } = useTranslation();
  const n = (value: number) =>
    new Intl.NumberFormat(
      currentLanguage === "ar" ? "ar-u-nu-arab" : currentLanguage,
    ).format(value);
  const label = t(`onboarding.visual.${step}`);
  const lines = (
    <div className="setup-paper-lines">
      <i />
      <i />
      <i />
    </div>
  );
  let scene;
  switch (step) {
    case "complete_profile":
      scene = (
        <div className="setup-demo-profile">
          <img src={hostPhoto} alt="" />
          <div>
            <UserRound size={20} />
            <strong>{label}</strong>
            {lines}
          </div>
          <Check className="setup-demo-check" />
        </div>
      );
      break;
    case "create_property":
      scene = (
        <>
          <img className="setup-demo-house-photo" src={riadPhoto} alt="" />
          <div className="setup-demo-caption">
            <House size={24} />
            <strong>{label}</strong>
            <MapPin size={18} />
          </div>
        </>
      );
      break;
    case "configure_details":
      scene = (
        <>
          <img className="setup-demo-room-photo" src={riadPhoto} alt="" />
          <div className="setup-demo-amenities">
            {[BedDouble, Bath, Users].map((Icon, i) => (
              <span key={i}>
                <Icon size={22} />
                <b>{n(i === 2 ? 4 : 2)}</b>
              </span>
            ))}
            <strong>{label}</strong>
          </div>
        </>
      );
      break;
    case "setup_rates":
      scene = (
        <div className="setup-demo-rate-quote">
          <Wallet size={25} />
          <strong>{label}</strong>
          {[1, 2, 3].map((i) => (
            <div key={i}>
              {lines}
              <b>{n(i * 25)}</b>
            </div>
          ))}
          <span>
            <Check size={15} />
            {t("setupVisual.connected")}
          </span>
        </div>
      );
      break;
    case "define_pricing":
      scene = (
        <div className="setup-demo-chart">
          <strong>{label}</strong>
          <div>
            {[36, 56, 47, 72, 88, 66, 51].map((h, i) => (
              <span key={i}>
                <i
                  style={{ blockSize: `${h}%`, animationDelay: `${i * 70}ms` }}
                />
                <small>{n(i + 1)}</small>
              </span>
            ))}
          </div>
          <CalendarDays size={24} />
        </div>
      );
      break;
    case "setup_fiscal":
    case "accept_provider_terms":
    case "upload_provider_documents":
      scene = (
        <div className={`setup-demo-documents setup-demo-${step}`}>
          <div className="setup-demo-sheet">
            {step === "setup_fiscal" ? (
              <Building2 />
            ) : step === "accept_provider_terms" ? (
              <ShieldCheck />
            ) : (
              <FileCheck2 />
            )}
            <strong>{label}</strong>
            {lines}
            {lines}
            <div className="setup-demo-signature">
              <svg viewBox="0 0 130 30">
                <path d="M4 23 Q23 -8 22 15 T41 14 Q33 34 57 17 T80 17 L124 17" />
              </svg>
              <Check size={18} />
            </div>
          </div>
          {step === "upload_provider_documents" && (
            <>
              <div className="setup-demo-doc-back" />
              <FileCheck2 className="setup-demo-stamp" size={42} />
            </>
          )}
        </div>
      );
      break;
    case "setup_notifications":
    case "setup_messaging":
    case "setup_assignment_contacts":
      scene = (
        <div className={`setup-demo-messages setup-demo-${step}`}>
          <div className="setup-demo-phone">
            {step === "setup_notifications" ? (
              <Bell size={25} />
            ) : step === "setup_assignment_contacts" ? (
              <Phone size={25} />
            ) : (
              <Mail size={25} />
            )}
            <strong>{label}</strong>
            <div className="setup-demo-bubble">
              {lines}
              <Check size={14} />
            </div>
            <div className="setup-demo-bubble">{lines}</div>
          </div>
          {step === "setup_assignment_contacts" && (
            <div className="setup-demo-hours">
              {n(9)}:{n(0)}
              {n(0)} <span>↔</span> {n(18)}:{n(0)}
              {n(0)}
            </div>
          )}
          {step === "setup_messaging" && (
            <img src={hostPhoto} className="setup-demo-avatar" alt="" />
          )}
        </div>
      );
      break;
    case "connect_channels":
    case "setup_integrations":
      scene = (
        <div className={`setup-demo-connections setup-demo-${step}`}>
          <div>
            {(step === "connect_channels"
              ? ["Airbnb", "Booking.com", "Vrbo"]
              : ["API", "iCal", "PMS"]
            ).map((name) => (
              <span key={name} dir="ltr">
                {name}
              </span>
            ))}
          </div>
          <svg viewBox="0 0 280 60">
            <path d="M30 0 V20 Q30 30 45 30 H235 Q250 30 250 20 V0 M140 0 V58" />
          </svg>
          <div className="setup-demo-hub">
            <House size={24} />
            <strong>baitly</strong>
            <Check size={18} />
          </div>
        </div>
      );
      break;
    case "setup_availability":
      scene = (
        <div className="setup-demo-calendar">
          <CalendarDays />
          <strong>{label}</strong>
          <div>
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className={i % 5 < 3 ? "is-available" : ""}>
                {n(i + 1)}
              </span>
            ))}
          </div>
        </div>
      );
      break;
    case "setup_coverage_zone":
      scene = (
        <div className="setup-demo-map">
          <svg viewBox="0 0 350 190">
            <path d="M0 35 L350 145 M0 120 L350 40 M65 0 L120 190 M235 0 L185 190 M0 165 L350 165" />
            <circle cx="175" cy="92" r="57" />
          </svg>
          <MapPin className="setup-demo-map-pin" size={36} />
          <strong>{label}</strong>
        </div>
      );
      break;
    case "create_team":
    case "invite_members":
      scene = (
        <div className={`setup-demo-team setup-demo-${step}`}>
          <div>
            <img src={hostPhoto} alt="" />
            <span>
              <UserRound />
            </span>
            <span>{step === "invite_members" ? <Mail /> : <Users />}</span>
          </div>
          <svg viewBox="0 0 280 50">
            <path d="M45 0 V18 H235 V0 M140 18 V50" />
          </svg>
          <strong>{label}</strong>
        </div>
      );
      break;
    case "setup_payment":
    case "setup_payouts":
    case "setup_payout_account":
      scene = (
        <div className={`setup-demo-payment setup-demo-${step}`}>
          <div className="setup-demo-bank-card">
            <CreditCard size={30} />
            <strong>{label}</strong>
            <span>••••　••••　••••</span>
          </div>
          <div className="setup-demo-receipt">
            {step === "setup_payment" ? <Wallet /> : <Building2 />}
            {lines}
            <ShieldCheck size={25} />
          </div>
        </div>
      );
      break;
    case "view_interventions":
      scene = (
        <div className="setup-demo-tasks">
          <ClipboardCheck />
          <strong>{label}</strong>
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <span>
                <Check size={16} />
              </span>
              {lines}
            </div>
          ))}
        </div>
      );
      break;
    case "configure_org":
    case "setup_general":
    default:
      scene = (
        <div className={`setup-demo-organization setup-demo-${step}`}>
          <div>
            {step === "configure_org" ? (
              <Building2 size={46} />
            ) : (
              <SlidersHorizontal size={46} />
            )}
            <strong>{label}</strong>
          </div>
          <div>
            {[1, 2, 3].map((i) => (
              <span key={i}>
                {lines}
                <i className="setup-demo-toggle" />
              </span>
            ))}
          </div>
        </div>
      );
  }
  return (
    <div
      className="setup-illustration setup-subject-scene"
      data-scene={step}
      aria-hidden="true"
    >
      <div className="setup-illustration-orbit" />
      {scene}
    </div>
  );
}
