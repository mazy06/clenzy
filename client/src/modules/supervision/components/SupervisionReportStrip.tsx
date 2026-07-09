/* ============================================================
   <SupervisionReportStrip> — carte « Bilan · 30 jours »

   Surface le ROI de la constellation (temps opérateur épargné estimé,
   actions autonomes, taux d'acceptation des suggestions) pour rendre la
   valeur des agents lisible. Ne s'affiche que si le bilan est disponible.
   ============================================================ */

import { Box, Typography } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervisionReport } from '../core/useSupervisionReport';

const cardSx = {
  border: '1px solid var(--line, #e6e8ef)',
  borderRadius: '14px',
  bgcolor: 'var(--card, #fff)',
  overflow: 'hidden',
};

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

  return (
    <Box sx={cardSx}>
      <Typography sx={{ p: '14px 16px 6px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
        {t('supervision.report.title', 'Bilan · 30 jours')}
      </Typography>
      <Box sx={{ display: 'flex', p: '2px 8px 14px' }}>
        {stats.map((s) => (
          <Box key={s.label} sx={{ flex: 1, textAlign: 'center', px: 0.5, minWidth: 0 }}>
            <Box
              sx={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={s.value}
            >
              {s.value}
            </Box>
            <Box sx={{ fontSize: 10.5, color: 'var(--muted, #6b7280)', mt: 0.5, fontWeight: 600 }}>{s.label}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
