import { Alert, AlertDescription, Skeleton } from "../../components/ui";
import { TriangleAlert } from "../../icons/glyphs";
import StatTile from "../../components/baitly/StatTile";
import StatTileRow from "../../components/baitly/StatTileRow";
import { useTranslation } from "../../hooks/useTranslation";
import { useVoucherAnalytics } from "../../hooks/useBookingVouchers";
import { intlLocale } from "../../utils/localeDate";

/** Résultats enregistrés sur la période de l’API, sans projection de revenus. */
export default function VoucherAnalyticsPanel() {
 const { t, currentLanguage } = useTranslation();
 const { data, isLoading, error } = useVoucherAnalytics();
 const money = (value: string) => new Intl.NumberFormat(intlLocale(currentLanguage),{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(value));
 const date = (value: string) => new Intl.DateTimeFormat(intlLocale(currentLanguage),{dateStyle:"short"}).format(new Date(value));
 return <section className="baitly-voucher-performance">
  <div className="baitly-voucher-performance-title"><img src="/images/dashboard-kpis/revenue.webp" width={52} height={52} alt="" /><div><h2>{t("vouchers.workspace.performance")}</h2><p>{data ? date(data.from)+" → "+date(data.to) : t("vouchers.workspace.period")}</p></div></div>
  {error ? <Alert variant="warning"><TriangleAlert /><AlertDescription>{t("vouchers.analytics.loadError")}</AlertDescription></Alert> : isLoading ? <div className="p-4" aria-busy="true"><Skeleton className="h-[140px] w-full" /></div> : data && <>
   {data.totalUsages === 0 ? <div className="baitly-voucher-performance-empty"><img src="/images/dashboard-kpis/bookings.webp" width={88} height={88} alt="" /><h3>{t("vouchers.workspace.firstUsage")}</h3><p>{t("vouchers.workspace.firstUsageHint",{count:data.activeVouchersCount})}</p></div> : <>
    <StatTileRow presentation="overview" className="baitly-voucher-performance-stats">
      <StatTile icon={null} label={t("vouchers.analytics.totalUsages")} value={data.totalUsages} />
      <StatTile icon={null} label={t("vouchers.analytics.totalGross")} value={money(data.totalGross)} />
      <StatTile icon={null} label={t("vouchers.analytics.totalDiscount")} value={money(data.totalDiscount)} />
      <StatTile icon={null} label={t("vouchers.analytics.totalNet")} value={money(data.totalNet)} />
    </StatTileRow>
    {data.topVouchers.length > 0 && <div className="baitly-voucher-top"><h3>{t("vouchers.analytics.topVouchersTitle")}</h3><ol>{data.topVouchers.slice(0,5).map(v=><li key={v.voucherId}><div><strong>{v.voucherName}</strong><span>{v.usageCount} {t("vouchers.workspace.uses")}</span></div><b>{money(v.totalNet)}</b></li>)}</ol></div>}
   </>}
   <p className="baitly-voucher-performance-note">{t("vouchers.workspace.performanceHint")}</p>
  </>}
 </section>;
}
