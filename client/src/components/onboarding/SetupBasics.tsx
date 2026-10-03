import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, NativeSelect, Skeleton } from "../ui";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import { usersApi } from "../../services/api/usersApi";
import { organizationsApi } from "../../services/api/organizationsApi";
import { invitationsApi } from "../../services/api/invitationsApi";
import { guestMessagingApi } from "../../services/api/guestMessagingApi";
import userPreferencesApi, {
  type UserPreferencesDto,
} from "../../services/api/userPreferencesApi";
import { interventionsApi } from "../../services/api/interventionsApi";
import { ASSIGNABLE_ORG_ROLES } from "../../utils/orgRoleLabels";
import SetupForm from "./SetupForm";
import type { SetupStepProps } from "./OnboardingStepContent";

export default function SetupBasics(props: SetupStepProps) {
  switch (props.stepKey) {
    case "complete_profile":
      return <Profile {...props} />;
    case "configure_org":
      return <Organization {...props} />;
    case "invite_members":
      return <Invitation {...props} />;
    case "setup_general":
      return <Preferences {...props} />;
    case "setup_messaging":
      return <Messaging {...props} />;
    case "view_interventions":
      return <Interventions {...props} />;
    default:
      return null;
  }
}

function Profile({ onCheck }: SetupStepProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  return (
    <SetupForm
      onSubmit={() => usersApi.updateMyProfile({ phoneNumber: phone.trim() })}
      onSaved={() => {
        void onCheck();
      }}
    >
      <div className="setup-identity">
        <strong>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
        </strong>
        <span>{user?.email}</span>
      </div>
      <label>
        {t("onboarding.form.phone")}
        <Input
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
    </SetupForm>
  );
}

function Organization({ onCheck }: SetupStepProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(user?.organizationName ?? "");
  if (!user?.organizationId)
    return <p role="alert">{t("onboarding.form.noOrganization")}</p>;
  return (
    <SetupForm
      onSubmit={() =>
        organizationsApi.update(user.organizationId!, { name: name.trim() })
      }
      onSaved={() => {
        void onCheck();
      }}
    >
      <label>
        {t("onboarding.form.company")}
        <Input
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
    </SetupForm>
  );
}

function Invitation({ onSaved }: SetupStepProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  if (!user?.organizationId)
    return <p role="alert">{t("onboarding.form.noOrganization")}</p>;
  return (
    <SetupForm
      onSubmit={() =>
        invitationsApi.send(user.organizationId!, { email: email.trim(), role })
      }
      onSaved={onSaved}
      submitLabel="onboarding.form.sendInvitation"
    >
      <label>
        {t("onboarding.form.email")}
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        {t("onboarding.form.role")}
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
          {ASSIGNABLE_ORG_ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </NativeSelect>
      </label>
    </SetupForm>
  );
}

function Preferences(props: SetupStepProps) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["user-preferences", "me"],
    queryFn: userPreferencesApi.getMyPreferences,
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError)
    return <p role="alert">{t("onboarding.guide.loadError")}</p>;
  return <PreferencesEditor {...props} initial={query.data} />;
}
function PreferencesEditor({
  initial,
  onSaved,
}: SetupStepProps & { initial: UserPreferencesDto }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [value, setValue] = useState(initial);
  return (
    <SetupForm
      onSubmit={async () => {
        const saved = await userPreferencesApi.updateMyPreferences({
          timezone: value.timezone,
          currency: value.currency,
          language: value.language,
        });
        cache.setQueryData(["user-preferences", "me"], saved);
      }}
      onSaved={onSaved}
    >
      <label>
        {t("onboarding.form.language")}
        <NativeSelect
          value={value.language}
          onChange={(e) => setValue({ ...value, language: e.target.value })}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </NativeSelect>
      </label>
      <label>
        {t("onboarding.form.currency")}
        <NativeSelect
          value={value.currency}
          onChange={(e) => setValue({ ...value, currency: e.target.value })}
        >
          {Array.from(
            new Set([value.currency, "EUR", "SAR", "MAD", "USD", "GBP", "AED"]),
          ).map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </NativeSelect>
      </label>
      <label>
        {t("onboarding.form.timezone")}
        <Input
          required
          list="setup-timezones"
          value={value.timezone}
          onChange={(e) => setValue({ ...value, timezone: e.target.value })}
        />
        <datalist id="setup-timezones">
          {Intl.supportedValuesOf("timeZone").map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </datalist>
      </label>
    </SetupForm>
  );
}

function Messaging(props: SetupStepProps) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["setup-messaging"],
    queryFn: guestMessagingApi.getConfig,
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError)
    return <p role="alert">{t("onboarding.guide.loadError")}</p>;
  return (
    <MessagingEditor
      {...props}
      initial={{
        start: query.data.quietHoursStart ?? "",
        end: query.data.quietHoursEnd ?? "",
      }}
    />
  );
}
function MessagingEditor({
  initial,
  onSaved,
}: SetupStepProps & { initial: { start: string; end: string } }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  return (
    <SetupForm
      onSubmit={() =>
        guestMessagingApi.updateConfig({
          quietHoursStart: value.start,
          quietHoursEnd: value.end,
        })
      }
      onSaved={onSaved}
    >
      <p>{t("messaging.quietHours.body")}</p>
      <label>
        {t("messaging.quietHours.start")}
        <Input
          type="time"
          required={!!value.end}
          value={value.start}
          onChange={(e) => setValue({ ...value, start: e.target.value })}
        />
      </label>
      <label>
        {t("messaging.quietHours.end")}
        <Input
          type="time"
          required={!!value.start}
          value={value.end}
          onChange={(e) => setValue({ ...value, end: e.target.value })}
        />
      </label>
    </SetupForm>
  );
}

function Interventions({ onSaved }: SetupStepProps) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["setup-interventions"],
    queryFn: () => interventionsApi.getAll({ size: 5 }),
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError)
    return <p role="alert">{t("onboarding.guide.loadError")}</p>;
  return (
    <div className="setup-task-list">
      {query.data.length ? (
        <ul>
          {query.data.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.propertyName}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("onboarding.form.noInterventions")}</p>
      )}
      <Button className="setup-primary" onClick={onSaved}>
        {t("onboarding.form.understood")}
      </Button>
    </div>
  );
}
