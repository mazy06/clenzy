import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
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
 * <p>Tooltip riche = pattern Menus/Popovers Baitly UI : surface {@code bg-card},
 * hairline {@code border-border}, r12, ombre discrete. Pastilles d'etapes en
 * primaire ({@code bg-primary-soft} / {@code text-primary}).</p>
 */

interface ProcedureStep {
  index: number;
  /** Prefixe de cle en locales : `accounting.sepa.steps.<id>`. */
  id: string;
  icon: React.ReactNode;
}

// Libelles en locales : `accounting.sepa.steps.<id>.{title,body}`.
const STEPS: ProcedureStep[] = [
  { index: 1, id: 'generate', icon: <FileTextIcon size={12} strokeWidth={2} /> },
  { index: 2, id: 'download', icon: <DownloadIcon size={12} strokeWidth={2} /> },
  { index: 3, id: 'upload', icon: <ExternalLinkIcon size={12} strokeWidth={2} /> },
  { index: 4, id: 'markPaid', icon: <VerifiedIcon size={12} strokeWidth={2} /> },
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
  const { t } = useTranslation();
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* Tooltip riche = pattern Menus/Popovers Baitly UI : surface carte,
          hairline, r12, ombre discrete (tokens → dark auto). La fleche est
          l'enfant direct SVG du contenu : on la reteinte au meme jeton. */}
      <TooltipContent
        side={placement}
        className="max-w-[380px] p-[9px] rounded-xl text-xs bg-card text-foreground border border-solid border-border shadow-md [&>svg]:bg-card [&>svg]:fill-card"
      >
        <div className="min-w-[280px] max-w-[360px]">
          {/* Header */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[0.78rem] font-bold text-foreground">
              {t('accounting.sepa.title')}
            </span>
            <span className="text-[0.58rem] font-bold tracking-[0.02em] px-0.5 py-0 rounded-[24px] border border-[currentColor] opacity-70">
              MANUEL
            </span>
          </div>

          <span className="block text-[0.68rem] text-inherit opacity-82 leading-[1.45] mb-1.5">
            {t('accounting.sepa.intro')}
          </span>

          {/* Steps */}
          <div className="flex flex-col gap-1.5">
            {STEPS.map((step) => (
              <div className="flex items-start gap-1" key={step.index}>
                {/* Pastille numérotée */}
                <div className="shrink-0 w-[18px] h-[18px] rounded-full bg-primary-soft text-primary inline-flex items-center justify-center text-[0.62rem] font-bold leading-[1] mt-px" aria-hidden="true">
                  {step.index}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-inherit opacity-70" aria-hidden="true">
                      {step.icon}
                    </span>
                    <span className="text-[0.7rem] font-bold text-foreground">
                      {t(`accounting.sepa.steps.${step.id}.title`)}
                    </span>
                  </div>
                  <span className="block text-[0.66rem] text-inherit opacity-78 leading-[1.45] mt-0">
                    {t(`accounting.sepa.steps.${step.id}.body`)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="flex items-start gap-0.5 mt-2 pt-1.5 border-t border-border opacity-78">
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="text-[0.64rem] text-inherit leading-[1.4]">
              {t('accounting.sepa.markPaidHint')}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
