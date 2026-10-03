import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, NativeSelect, Skeleton } from "../ui";
import { useTranslation } from "../../hooks/useTranslation";
import { useCurrency } from "../../hooks/useCurrency";
import PropertyForm from "../../modules/properties/PropertyForm";
import ManagementContractRequiredModal from "../../modules/contracts/ManagementContractRequiredModal";
import ICalImportModal from "../../modules/dashboard/ICalImportModal";
import { propertiesApi, type Property } from "../../services/api/propertiesApi";
import {
  calendarPricingApi,
  type RatePlan,
} from "../../services/api/calendarPricingApi";
import SetupForm from "./SetupForm";
import type { SetupStepProps } from "./OnboardingStepContent";

export default function SetupProperty(props: SetupStepProps) {
  if (props.stepKey === "create_property") return <CreateProperty {...props} />;
  if (
    props.stepKey === "connect_channels" ||
    props.stepKey === "setup_integrations"
  )
    return (
      <ICalImportModal
        embedded
        open
        onClose={() => {}}
        onImportSuccess={() => {
          void props.onCheck();
        }}
      />
    );
  return <ExistingProperty {...props} />;
}
function CreateProperty({ onCheck }: SetupStepProps) {
  const [created, setCreated] = useState<Property | null>(null);
  return created ? (
    <ManagementContractRequiredModal
      embedded
      open
      property={created}
      onCompleted={() => {
        void onCheck();
      }}
    />
  ) : (
    <PropertyForm embedded onSuccess={setCreated} />
  );
}
function ExistingProperty(props: SetupStepProps) {
  const { t } = useTranslation();
  const [id, setId] = useState("");
  const query = useQuery({
    queryKey: ["setup-properties"],
    queryFn: () => propertiesApi.getAll({ size: 500, sort: "name,asc" }),
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError)
    return <p role="alert">{t("onboarding.guide.loadError")}</p>;
  if (!query.data.length) return <CreateProperty {...props} />;
  const propertyId = Number(id || query.data[0].id);
  return (
    <div>
      <label className="setup-property-picker">
        {t("onboarding.form.property")}
        <NativeSelect
          value={propertyId}
          onChange={(e) => setId(e.target.value)}
        >
          {query.data.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      {props.stepKey === "define_pricing" ? (
        <Pricing {...props} key={propertyId} propertyId={propertyId} />
      ) : (
        <PropertyForm
          embedded
          key={propertyId}
          mode="edit"
          propertyId={propertyId}
          onSuccess={() => {
            void props.onCheck();
          }}
        />
      )}
    </div>
  );
}
function Pricing(props: SetupStepProps & { propertyId: number }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["rate-plans", props.propertyId],
    queryFn: () => calendarPricingApi.getRatePlans(props.propertyId),
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError)
    return <p role="alert">{t("onboarding.guide.loadError")}</p>;
  // Reuse the existing base plan: revisiting this step must not create duplicates.
  const base = query.data.find(
    (plan) =>
      plan.type === "BASE" &&
      !plan.startDate &&
      !plan.endDate &&
      !plan.daysOfWeek?.length,
  );
  return <PricingEditor {...props} initial={base} />;
}
function PricingEditor({
  propertyId,
  initial,
  onSaved,
}: SetupStepProps & { propertyId: number; initial?: RatePlan }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const cache = useQueryClient();
  const [price, setPrice] = useState(initial?.nightlyPrice?.toString() ?? "");
  const [code, setCode] = useState(initial?.currency ?? currency);
  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(price);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Invalid amount");
      return initial
        ? calendarPricingApi.updateRatePlan(initial.id, {
            nightlyPrice: amount,
            currency: code,
            isActive: true,
          })
        : calendarPricingApi.createRatePlan({
            propertyId,
            name: t("onboarding.form.baseRate"),
            type: "BASE",
            priority: 1,
            nightlyPrice: amount,
            currency: code,
            isActive: true,
          });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["rate-plans"] });
      await cache.invalidateQueries({ queryKey: ["planning"] });
    },
  });
  return (
    <SetupForm onSubmit={() => mutation.mutateAsync()} onSaved={onSaved}>
      <p>{t("onboarding.form.pricingHelp")}</p>
      <label>
        {t("onboarding.form.nightlyPrice")}
        <Input
          type="number"
          min="0.01"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label>
        {t("onboarding.form.currency")}
        <NativeSelect value={code} onChange={(e) => setCode(e.target.value)}>
          {Array.from(
            new Set([code, "EUR", "SAR", "MAD", "USD", "GBP", "AED"]),
          ).map((value) => (
            <option key={value}>{value}</option>
          ))}
        </NativeSelect>
      </label>
    </SetupForm>
  );
}
