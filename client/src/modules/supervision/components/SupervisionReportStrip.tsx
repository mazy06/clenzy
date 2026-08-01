/* ============================================================
   <SupervisionReportStrip> — carte « Bilan · 30 jours »

   Surface le ROI de la constellation (temps opérateur épargné estimé,
   actions autonomes, taux d'acceptation des suggestions) pour rendre la
   valeur des agents lisible, puis le détail « Acceptation par type »
   (Vague 1 autonomie — aide à activer les actions automatiques).
   Ne s'affiche que si le bilan est disponible.
   ============================================================ */

import { Typography } from '@mui/material';
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
    <div className="overflow-hidden rounded-[14px] border border-solid border-[var(--line,#e6e8ef)] bg-[var(--card,#fff)]">
      <Typography sx={{ p: '14px 16px 6px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
        {t('supervision.report.title', 'Bilan · 30 jours')}
      </Typography>
      <div className="flex p-[2px 8px 14px]">
        {stats.map((s) => (
          <div className="flex-1 text-center px-0.5 min-w-0" key={s.label}>
            <div
              className="text-[17px] font-extrabold text-[var(--accent)] tabular-nums leading-[1.15] whitespace-nowrap overflow-hidden text-ellipsis"
              title={s.value}
            >
              {s.value}
            </div>
            <div className="text-[10.5px] text-[var(--muted,_#6b7280)] mt-[3px] font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Acceptation PAR TYPE (Vague 1) : lignes compactes type → décisions → taux. */}
      {byType.length > 0 && (
        <div className="px-[9px] pt-1.5 pb-[7.5px]" style={{ borderTop: '1px solid var(--line, #e6e8ef)' }}>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--muted, #6b7280)',
              mb: 0.5,
            }}
          >
            {t('supervision.report.acceptanceByType', 'Acceptation par type')}
          </Typography>
          {byType.map((row) => {
            const decided = row.applied + row.dismissed;
            return (
              <div className="flex items-center gap-1.5 py-0.5 min-w-0" key={`${row.moduleKey}:${row.actionType}`}>
                <Typography
                  noWrap
                  sx={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--ink, #1b2240)', fontWeight: 600 }}
                  title={row.actionType}
                >
                  {t(
                    `supervision.report.types.${row.actionType}`,
                    row.actionType.replaceAll('_', ' ').toLowerCase(),
                  )}
                </Typography>
                <Typography
                  sx={{ fontSize: 11, color: 'var(--muted, #6b7280)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {t('supervision.report.decisions', '{{count}} déc.', { count: decided })}
                </Typography>
                <span className={cn('min-w-[40px] text-end text-[11.5px] font-bold tabular-nums', decided === 0 ? 'text-[var(--muted,_#6b7280)]' : 'text-[var(--accent)]')}>
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
