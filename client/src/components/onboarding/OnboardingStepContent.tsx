import { lazy, Suspense, useRef, useState } from "react";
import { Button, Skeleton } from "../ui";
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
} from "../PageHeaderActionsContext";
import { useTranslation } from "../../hooks/useTranslation";
import type { NotificationPreferencesHandle } from "../../modules/settings/NotificationPreferencesCard";
import type { FiscalProfileHandle } from "../../modules/settings/FiscalProfileSection";

const Basics = lazy(() => import("./SetupBasics"));
const Property = lazy(() => import("./SetupProperty"));
const Payout = lazy(() => import("./SetupPayout"));
const Migration = lazy(
  () => import("../../modules/migration/PmsImportWorkspace"),
);
const Notifications = lazy(
  () => import("../../modules/settings/NotificationPreferencesCard"),
);
const Fiscal = lazy(
  () => import("../../modules/settings/FiscalProfileSection"),
);
const Contacts = lazy(
  () => import("../../modules/service-requests/AssignmentContactForm"),
);
const Terms = lazy(() => import("../../modules/account/ProviderTermsCard"));
const Documents = lazy(
  () => import("../../modules/account/ProviderDocumentsCard"),
);
const Coverage = lazy(() => import("../../modules/account/MyCoverageZoneCard"));
const Availability = lazy(
  () => import("../../modules/account/MyAvailabilityCard"),
);
const Rates = lazy(() => import("../../modules/settings/MyRatesSettings"));
const Team = lazy(() => import("../../modules/teams/TeamForm"));

export interface SetupStepProps {
  stepKey: string;
  onSaved: () => void;
  onCheck: () => Promise<void>;
}

/** Mount only the requested task. Header actions stay inside this dialog, even when portalled. */
export default function OnboardingStepContent(props: SetupStepProps) {
  const { stepKey, onSaved, onCheck } = props;
  const { t } = useTranslation();
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const notifications = useRef<NotificationPreferencesHandle>(null);
  const fiscal = useRef<FiscalProfileHandle>(null);
  const [, update] = useState(0);
  let content;
  switch (stepKey) {
    case "migrate_pms":
      content = <Migration embedded />;
      break;
    case "create_property":
    case "configure_details":
    case "define_pricing":
    case "connect_channels":
    case "setup_integrations":
      content = <Property {...props} />;
      break;
    case "setup_notifications":
      content = (
        <>
          <Notifications
            ref={notifications}
            onChangeState={() => update((n) => n + 1)}
            onSaved={onSaved}
          />
          <Button
            className="setup-primary"
            disabled={notifications.current?.isSaving}
            onClick={() => notifications.current?.save()}
          >
            {t("onboarding.guide.save")}
          </Button>
        </>
      );
      break;
    case "setup_fiscal":
      content = (
        <>
          <Fiscal ref={fiscal} onChangeState={() => update((n) => n + 1)} />
          <Button
            className="setup-primary"
            disabled={fiscal.current?.isSaving}
            onClick={async () => {
              await fiscal.current?.save();
              await onCheck();
            }}
          >
            {t("onboarding.guide.save")}
          </Button>
        </>
      );
      break;
    case "setup_payment":
      content = <Payout {...props} />;
      break;
    case "setup_assignment_contacts":
      content = <Contacts />;
      break;
    case "accept_provider_terms":
      content = <Terms onAccepted={onSaved} />;
      break;
    case "upload_provider_documents":
      content = <Documents onFileComplete={onSaved} />;
      break;
    case "setup_coverage_zone":
      content = <Coverage onSaved={onSaved} />;
      break;
    case "setup_availability":
      content = <Availability onSaved={onSaved} />;
      break;
    case "setup_rates":
      content = <Rates onSaved={onSaved} />;
      break;
    case "setup_payouts":
    case "setup_payout_account":
      content = <Payout {...props} />;
      break;
    case "create_team":
      content = <Team embedded onCreated={onSaved} />;
      break;
    default:
      content = <Basics {...props} />;
  }
  return (
    <PageHeaderActionsProvider slot={slot}>
      <Suspense fallback={<Skeleton className="h-44 w-full" />}>
        {content}
      </Suspense>
      <div className="setup-embedded-actions">{portalContainer}</div>
    </PageHeaderActionsProvider>
  );
}
