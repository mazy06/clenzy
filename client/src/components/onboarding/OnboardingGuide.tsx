import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  LockKeyhole,
  X,
} from "../../icons/glyphs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { OnboardingStepWithStatus } from "../../hooks/useOnboarding";
import { useTranslation } from "../../hooks/useTranslation";
import SetupIllustration from "./SetupIllustration";
import BaitlyMarkLogo from "../BaitlyMarkLogo";
import { Skeleton } from "../ui/skeleton";
import ErrorBoundary from "../ErrorBoundary";

const OnboardingStepContent = lazy(() => import("./OnboardingStepContent"));

interface Props {
  steps: OnboardingStepWithStatus[];
  onComplete: (key: string) => void;
  onCheck: (key: string) => Promise<boolean>;
  onSkip: (key: string) => void;
  onDismiss: () => void;
  isCompleting?: boolean;
  completionError?: unknown;
  resumePayments?: boolean;
}

export default function OnboardingGuide({
  steps,
  onComplete,
  onCheck,
  onSkip,
  onDismiss,
  isCompleting,
  completionError,
  resumePayments = false,
}: Props) {
  const { t, currentLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const paymentStep = steps.find((item) =>
    ["setup_payment", "setup_payouts", "setup_payout_account"].includes(
      item.key,
    ),
  )?.key;
  useEffect(() => {
    if (resumePayments && paymentStep) {
      setOpen(true);
      setSelected(paymentStep);
      setEditing(paymentStep);
    }
  }, [resumePayments, paymentStep]);
  const numbers = useMemo(
    () =>
      new Intl.NumberFormat(
        currentLanguage === "ar" ? "ar-u-nu-arab" : currentLanguage,
      ),
    [currentLanguage],
  );
  const current =
    steps.find((step) => !step.completed && !step.locked) ?? steps[0];
  const step = steps.find((item) => item.key === selected) ?? current;
  const done = steps.filter((item) => item.completed).length;
  const progress = t("onboarding.progress", {
    done: numbers.format(done),
    total: numbers.format(steps.length),
  });
  const index = steps.findIndex((item) => item.key === step.key);
  const check = async () => {
    setChecking(true);
    setNotice(null);
    try {
      if (!(await onCheck(step.key)))
        setNotice(t("onboarding.guide.incomplete"));
    } catch {
      setNotice(t("onboarding.guide.saveError"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="baitly-setup setup-launcher"
          type="button"
          aria-label={t("onboarding.guide.open")}
        >
          <span className="setup-launcher-icon">
            <CircleHelp size={22} />
          </span>
          <span>
            <strong>{t("onboarding.dock.title")}</strong>
            <small>{progress}</small>
          </span>
          <ChevronRight size={18} className="setup-directional" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="baitly-setup setup-guide"
        showCloseButton={false}
        dir={currentLanguage === "ar" ? "rtl" : "ltr"}
      >
        <header className="setup-guide-top">
          <span className="setup-wordmark">
            <BaitlyMarkLogo
              variant="mark"
              size={30}
              disableAnimation
              colorMode="inherit"
            />
            baitly
          </span>
          <span>{t("onboarding.guide.welcome")}</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("onboarding.guide.close")}
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </Button>
        </header>
        <div className="setup-guide-layout">
          <aside className="setup-guide-sidebar">
            <h2>{t("onboarding.guide.yourSteps")}</h2>
            <p>{progress}</p>
            <progress max={steps.length} value={done} aria-label={progress} />
            <nav aria-label={t("onboarding.guide.yourSteps")}>
              <ol>
                {steps.map((item, position) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-label={t(item.labelKey)}
                      aria-current={step.key === item.key ? "step" : undefined}
                      onClick={() => {
                        setSelected(item.key);
                        setEditing(null);
                        setNotice(null);
                      }}
                    >
                      <span
                        className="setup-step-number"
                        data-done={item.completed || undefined}
                      >
                        {item.completed ? (
                          <Check size={14} />
                        ) : item.locked ? (
                          <LockKeyhole size={13} />
                        ) : (
                          numbers.format(position + 1)
                        )}
                      </span>
                      <span>
                        {t(item.labelKey)}
                        {item.skippable && (
                          <small>{t("onboarding.optional")}</small>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <button
              className="setup-dismiss"
              type="button"
              onClick={() => {
                setOpen(false);
                onDismiss();
              }}
            >
              {t("onboarding.guide.hide")}
            </button>
          </aside>
          <div
            className="setup-guide-main"
            key={step.key}
            data-editing={editing === step.key || undefined}
          >
            <SetupIllustration step={step.key} />
            <div className="setup-guide-copy">
              <div className="setup-step-eyebrow">
                <span>
                  {t("onboarding.guide.step", {
                    current: numbers.format(index + 1),
                    total: numbers.format(steps.length),
                  })}
                </span>
                {step.skippable && <span>{t("onboarding.optional")}</span>}
              </div>
              <DialogTitle>{t(step.labelKey)}</DialogTitle>
              <DialogDescription>{t(step.descriptionKey)}</DialogDescription>
              {editing === step.key && !step.locked && (
                <div className="setup-embedded">
                  <ErrorBoundary
                    fallback={
                      <p role="alert" className="setup-guide-error">
                        {t("onboarding.guide.loadError")}
                      </p>
                    }
                  >
                    <Suspense
                      fallback={
                        <div role="status" aria-label={t("common.loading")}>
                          <Skeleton className="h-12 mb-3" />
                          <Skeleton className="h-36" />
                        </div>
                      }
                    >
                      <OnboardingStepContent
                        stepKey={step.key}
                        onSaved={() => onComplete(step.key)}
                        onCheck={check}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              )}
              {step.substeps && (
                <ul className="setup-substeps">
                  {step.substeps.map((item) => (
                    <li key={item.key}>
                      <Check size={15} />
                      {t(item.labelKey)}
                    </li>
                  ))}
                </ul>
              )}
              {step.locked && (
                <p className="setup-guide-note">
                  <LockKeyhole size={15} />
                  {t("onboarding.guide.locked")}
                </p>
              )}
              {!!completionError && (
                <p role="alert" className="setup-guide-error">
                  {t("onboarding.guide.saveError")}
                </p>
              )}
              {notice && (
                <p role="status" className="setup-guide-note">
                  {notice}
                </p>
              )}
              {step.completed && (
                <p role="status" className="setup-step-saved">
                  <Check size={17} />
                  {t("onboarding.guide.saved")}
                </p>
              )}
              <div className="setup-guide-actions">
                {step.skippable && !step.completed && !step.locked && (
                  <Button
                    variant="ghost"
                    disabled={isCompleting}
                    onClick={() => {
                      setSelected(null);
                      setEditing(null);
                      setNotice(null);
                      onSkip(step.key);
                    }}
                  >
                    {t(step.skipLabelKey ?? "onboarding.skip")}
                  </Button>
                )}
                {!(
                  editing === paymentStep &&
                  step.key === paymentStep &&
                  !step.completed
                ) && (
                  <Button
                    variant={
                      editing === step.key && !step.completed
                        ? "outline"
                        : "default"
                    }
                    className={
                      editing === step.key && !step.completed
                        ? undefined
                        : "setup-primary"
                    }
                    disabled={step.locked || isCompleting || checking}
                    onClick={() => {
                      if (step.completed) {
                        setSelected(null);
                        setEditing(null);
                        setNotice(null);
                      } else if (editing === step.key) void check();
                      else {
                        setSelected(step.key);
                        setEditing(step.key);
                        setNotice(null);
                      }
                    }}
                  >
                    {t(
                      step.completed
                        ? "onboarding.guide.next"
                        : editing === step.key
                          ? "onboarding.guide.check"
                          : (step.actionLabelKey ?? "onboarding.guide.start"),
                    )}
                    <ArrowRight size={17} className="setup-directional" />
                  </Button>
                )}
              </div>
              <p className="setup-guide-resume">
                {t("onboarding.guide.resume")}
              </p>
              <button
                className="setup-dismiss setup-mobile-dismiss"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDismiss();
                }}
              >
                {t("onboarding.guide.hide")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
