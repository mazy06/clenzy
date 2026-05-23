import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import {
  Article as FileTextIcon,
  Download as DownloadIcon,
  OpenInNew as ExternalLinkIcon,
  Verified as VerifiedIcon,
  Info as InfoIcon,
} from '../../../icons';

/**
 * Tooltip riche detaillant les 4 etapes du virement SEPA manuel
 * ({@code SEPA_TRANSFER}). Affichee sur l'icone de telechargement et sur le
 * bouton batch "SEPA XML (N)" — tout ce qui declenche le flow manuel — pour
 * que l'admin n'ait jamais a se demander "et apres ?".
 *
 * <h2>Pourquoi ce tooltip</h2>
 * <p>Le flow SEPA reste manuel tant que l'auto-virement (Wise / Open Banking)
 * n'est pas en place. Sans tooltip, un nouvel admin ne sait pas que c'est un
 * processus en 4 etapes : il pourrait croire que cliquer sur "telecharger
 * XML" effectue le virement, alors qu'il doit encore l'uploader sur le
 * portail bancaire et revenir cocher "Marquer comme paye".</p>
 *
 * <h2>Design</h2>
 * <p>Pattern PlanningPropertyColumn : {@code background.paper} en clair,
 * surface sombre en dark, bordure {@code divider}, boxShadow theme-aware.
 * Aligne sur {@link ServiceTooltip} pour rester coherent avec le reste du
 * PMS.</p>
 */

const ACCENT = '#4A9B8E';

interface ProcedureStep {
  index: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: ProcedureStep[] = [
  {
    index: 1,
    icon: <FileTextIcon size={12} strokeWidth={2} />,
    title: 'Génération pain.001',
    body:
      'Clenzy compile les payouts approuvés en un fichier XML ISO 20022 (norme pain.001.001.03), prêt à être traité par votre banque.',
  },
  {
    index: 2,
    icon: <DownloadIcon size={12} strokeWidth={2} />,
    title: 'Téléchargement',
    body:
      'Cliquez sur l\'icône télécharger pour récupérer le XML. Le payout passe en statut « En cours » — il n\'est pas encore débité.',
  },
  {
    index: 3,
    icon: <ExternalLinkIcon size={12} strokeWidth={2} />,
    title: 'Upload sur votre portail bancaire',
    body:
      'Connectez-vous à l\'espace pro de votre banque (HSBC, SG, BNP, etc.), section « Virements groupés » ou « Import SEPA », et uploadez le fichier. La banque exécute le virement (J ou J+1).',
  },
  {
    index: 4,
    icon: <VerifiedIcon size={12} strokeWidth={2} />,
    title: 'Marquer comme payé',
    body:
      'Une fois le virement confirmé par la banque, revenez sur Clenzy et cliquez sur l\'icône « Payé » du payout. Renseignez la référence du virement (visible sur votre portail bancaire) pour traçabilité.',
  },
];

interface SepaTransferProcedureTooltipProps {
  children: React.ReactElement;
  /** Placement du tooltip. Default : 'top'. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export default function SepaTransferProcedureTooltip({
  children,
  placement = 'top',
}: SepaTransferProcedureTooltipProps) {
  return (
    <Tooltip
      arrow
      placement={placement}
      enterDelay={300}
      leaveDelay={100}
      title={
        <Box sx={{ minWidth: 280, maxWidth: 360 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.75 }}>
            <Typography
              component="span"
              sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'inherit' }}
            >
              Virement SEPA — Procédure
            </Typography>
            <Box
              component="span"
              sx={{
                fontSize: '0.58rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                px: 0.5,
                py: 0.125,
                borderRadius: '3px',
                border: '1px solid currentColor',
                opacity: 0.7,
              }}
            >
              MANUEL
            </Box>
          </Box>

          <Typography
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.68rem',
              color: 'inherit',
              opacity: 0.82,
              lineHeight: 1.45,
              mb: 1,
            }}
          >
            4 étapes pour exécuter un virement groupé. L'automatisation
            arrivera via Wise (hors EU) et Open Banking (auto-SEPA) — voir
            roadmap.
          </Typography>

          {/* Steps */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
            {STEPS.map((step) => (
              <Box
                key={step.index}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}
              >
                {/* Pastille numérotée */}
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: `${ACCENT}1F`,
                    color: ACCENT,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    mt: '1px',
                  }}
                  aria-hidden="true"
                >
                  {step.index}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      component="span"
                      sx={{ display: 'inline-flex', color: 'inherit', opacity: 0.7 }}
                      aria-hidden="true"
                    >
                      {step.icon}
                    </Box>
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'inherit' }}
                    >
                      {step.title}
                    </Typography>
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      fontSize: '0.66rem',
                      color: 'inherit',
                      opacity: 0.78,
                      lineHeight: 1.45,
                      mt: 0.125,
                    }}
                  >
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Footer note */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.5,
              mt: 1.25,
              pt: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
              opacity: 0.78,
            }}
          >
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <Typography
              component="span"
              sx={{ fontSize: '0.64rem', color: 'inherit', lineHeight: 1.4 }}
            >
              Tant que vous n'avez pas marqué comme payé, le propriétaire ne
              reçoit pas de notification. Pensez à le faire pour fermer la
              boucle.
            </Typography>
          </Box>
        </Box>
      }
      // Pattern PlanningPropertyColumn : background.paper + text.primary
      // -> blanc en clair, surface sombre en dark mode.
      slotProps={{
        tooltip: {
          sx: (theme) => ({
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            maxWidth: 380,
            p: 1.5,
            fontSize: '0.75rem',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 12px 32px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35)'
                : '0 12px 32px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.08)',
            '& .MuiTooltip-arrow': {
              color: theme.palette.background.paper,
              '&::before': {
                border: '1px solid',
                borderColor: theme.palette.divider,
                backgroundColor: theme.palette.background.paper,
              },
            },
          }),
        },
      }}
    >
      {children}
    </Tooltip>
  );
}
