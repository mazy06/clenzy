import { useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { useTranslation } from "../../hooks/useTranslation";

/** A successful request is required before notifying the guide. No local completion flags. */
export default function SetupForm({
  children,
  onSubmit,
  onSaved,
  submitLabel,
}: {
  children: ReactNode;
  onSubmit: () => Promise<unknown>;
  onSaved: () => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      className="setup-inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(false);
        try {
          await onSubmit();
          onSaved();
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p role="alert" className="setup-guide-error">
          {t("onboarding.guide.saveError")}
        </p>
      )}
      <Button className="setup-primary" type="submit" disabled={busy}>
        {t(busy ? "common.saving" : (submitLabel ?? "onboarding.guide.save"))}
      </Button>
    </form>
  );
}
