import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "../../components/ui";

interface UpgradeBannerProps { currentForfait?: string; onUpgradeComplete?: () => void }
export default function UpgradeBanner({ currentForfait }: UpgradeBannerProps) {
  const { t } = useTranslation();
  if (!currentForfait || currentForfait.toLowerCase() !== "essentiel") return null;
  return <section className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
    <div><h2 className="text-base font-semibold text-balance">{t("monthlySubscription.discover")}</h2>
    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("monthlySubscription.intro")}</p></div>
    <Button variant="outline" asChild><Link to="/settings?tab=subscription">{t("monthlySubscription.review")}<ArrowRight /></Link></Button>
  </section>;
}
