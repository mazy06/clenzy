/* ============================================================
   <SupervisionReportStrip> — carte « Bilan · 30 jours »

   Surface le ROI de la constellation (temps opérateur épargné estimé,
   actions autonomes, taux d'acceptation des suggestions) pour rendre la
   valeur des agents lisible, puis le détail « Acceptation par type »
   (Vague 1 autonomie — aide à activer les actions automatiques).
   Ne s'affiche que si le bilan est disponible.
   ============================================================ */


import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervisionReport } from '../core/useSupervisionReport';

export function SupervisionReportStrip() {
  const { t } = useTranslation();
  const { report, loading } = useSupervisionReport();

  if (loading || !report) return null;

  const stats = [
    { label: t('supervision.report.timeSaved', 'Temps gagné'), value: report.estimatedTimeSaved },
    { label: t('supervision.report.autoActions', 'Actions auto'), value: String(report.autoActions) },
    {
      label: t('supervision.report.acceptance', 'Acceptation'),
      value: `${Math.round(report.acceptanceRate * 100)} %`,
    },
  ];

  const byType = report.acceptanceByType ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-solid border-border bg-card">
      {/* Les gabarits d'espacement etaient ecrits `p-[14px 16px 6px]` : une valeur
          arbitraire a espaces, que Tailwind n'emet pas — le bandeau n'avait donc
          aucune marge interieure. Repris sur l'echelle. */}
      <p className="px-4 pt-3.5 pb-1.5 text-sm font-semibold text-foreground">
        {t('supervision.report.title', 'Bilan · 30 jours')}
      </p>
      <div className="flex px-2 pt-0.5 pb-3.5">
        {stats.map((s) => (
          <div className="flex-1 text-center px-0.5 min-w-0" key={s.label}>
            <div
              className="cn-font-heading text-lg font-semibold text-foreground tabular-nums leading-[1.15] whitespace-nowrap overflow-hidden text-ellipsis"
              title={s.value}
            >
              {s.value}
            </div>
            <div className="text-2xs text-muted-foreground mt-[3px] font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Acceptation PAR TYPE (Vague 1) : lignes compactes type → décisions → taux. */}
      {byType.length > 0 && (
        <div className="px-[9px] pt-1.5 pb-[7.5px] border-t border-solid border-border">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[3px]">
            {t('supervision.report.acceptanceByType', 'Acceptation par type')}
          </p>
          {byType.map((row) => {
            const decided = row.applied + row.dismissed;
            return (
              <div className="flex items-center gap-1.5 py-0.5 min-w-0" key={`${row.moduleKey}:${row.actionType}`}>
                <p className="truncate flex-1 min-w-0 text-xs text-foreground font-medium" title={row.actionType}>
                  {t(
                    `supervision.report.types.${row.actionType}`,
                    row.actionType.replaceAll('_', ' ').toLowerCase(),
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t('supervision.report.decisions', '{{count}} déc.', { count: decided })}
                </p>
                <span className={cn('min-w-[40px] text-end text-xs font-semibold tabular-nums', decided === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                  {decided === 0 ? '—' : `${Math.round(row.acceptanceRate * 100)} %`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
