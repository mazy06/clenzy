import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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
 * <p>Tooltip riche = pattern Menus/Popovers Signature (baseline §2) :
 * surface {@code var(--card)}, hairline {@code var(--line)}, r12,
 * {@code var(--shadow-pop)}. Pastilles d'etapes en accent
 * ({@code var(--accent)} / {@code var(--accent-soft)}).</p>
 */

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
      'Baitly compile les payouts approuvés en un fichier XML ISO 20022 (norme pain.001.001.03), prêt à être traité par votre banque.',
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
      'Une fois le virement confirmé par la banque, revenez sur Baitly et cliquez sur l\'icône « Payé » du payout. Renseignez la référence du virement (visible sur votre portail bancaire) pour traçabilité.',
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
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* Tooltip riche = pattern Menus/Popovers Signature : surface --card,
          hairline --line, r12, --shadow-pop (tokens → dark auto). La fleche est
          l'enfant direct SVG du contenu : on la reteinte au meme jeton. */}
      <TooltipContent
        side={placement}
        className="max-w-[380px] p-[9px] rounded-[12px] text-[0.75rem] bg-[var(--card)] text-[var(--body)] border border-solid border-[var(--line)] shadow-[var(--shadow-pop)] [&>svg]:bg-[var(--card)] [&>svg]:fill-[var(--card)]"
      >
        <div className="min-w-[280px] max-w-[360px]">
          {/* Header */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[0.78rem] font-bold text-[var(--ink)]">
              Virement SEPA — Procédure
            </span>
            <span className="text-[0.58rem] font-bold tracking-[0.02em] px-0.5 py-0 rounded-[24px] border border-[currentColor] opacity-70">
              MANUEL
            </span>
          </div>

          <span className="block text-[0.68rem] text-inherit opacity-82 leading-[1.45] mb-1.5">
            4 étapes pour exécuter un virement groupé. L'automatisation
            arrivera via Wise (hors EU) et Open Banking (auto-SEPA) — voir
            roadmap.
          </span>

          {/* Steps */}
          <div className="flex flex-col gap-1.5">
            {STEPS.map((step) => (
              <div className="flex items-start gap-1" key={step.index}>
                {/* Pastille numérotée */}
                <div className="shrink-0 w-[18px] h-[18px] rounded-[50%] bg-[var(--accent-soft)] text-[var(--accent)] inline-flex items-center justify-center text-[0.62rem] font-bold leading-[1] mt-px" aria-hidden="true">
                  {step.index}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-inherit opacity-70" aria-hidden="true">
                      {step.icon}
                    </span>
                    <span className="text-[0.7rem] font-bold text-[var(--ink)]">
                      {step.title}
                    </span>
                  </div>
                  <span className="block text-[0.66rem] text-inherit opacity-78 leading-[1.45] mt-0">
                    {step.body}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="flex items-start gap-0.5 mt-2 pt-1.5 border-t border-[var(--line)] opacity-78">
            <InfoIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="text-[0.64rem] text-inherit leading-[1.4]">
              Tant que vous n'avez pas marqué comme payé, le propriétaire ne
              reçoit pas de notification. Pensez à le faire pour fermer la
              boucle.
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
