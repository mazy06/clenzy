import { useLocation } from "react-router-dom";
import { useOnboarding } from "../hooks/useOnboarding";
import OnboardingGuide from "./onboarding/OnboardingGuide";

/** The launcher follows the user; the guide opens only on request. Progress lives on the server. */
export default function OnboardingDockMount() {
  const { pathname, search } = useLocation();
  const resumePayments = new URLSearchParams(search).get("setup") === "payment";
  const {
    steps,
    totalCount,
    isAllCompleted,
    isDismissed,
    isLoading,
    completeStep,
    dismiss,
    isCompleting,
    completionError,
    checkStep,
  } = useOnboarding();
  if (
    isLoading ||
    totalCount === 0 ||
    (!resumePayments && (isDismissed || isAllCompleted))
  )
    return null;
  if (pathname.startsWith("/booking-engine/studio/")) return null;
  return (
    <OnboardingGuide
      resumePayments={resumePayments}
      steps={steps}
      onComplete={completeStep}
      onCheck={checkStep}
      onSkip={completeStep}
      onDismiss={dismiss}
      isCompleting={isCompleting}
      completionError={completionError}
    />
  );
}
