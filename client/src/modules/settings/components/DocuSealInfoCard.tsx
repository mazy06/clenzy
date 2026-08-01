import { Alert } from '@mui/material';
import StatusChip from '../../../components/StatusChip';
import { Card } from '../../../components/ui';
import ProviderLogo from './ProviderLogos';
import { CheckCircle } from '../../../icons';

/**
 * Panneau d'information DocuSeal — provider de signature open source
 * auto-hébergé. Contrairement à Yousign (clé API per-org saisie ici), DocuSeal
 * est un service partagé de la plateforme : son branchement est une opération
 * d'infrastructure (clenzy-infra), pas une saisie utilisateur. Ce panneau
 * explique l'état et la marche à suivre.
 */

interface DocuSealInfoCardProps {
  /** Instance configurée côté backend (DOCUSEAL_BASE_URL + DOCUSEAL_API_KEY). */
  available: boolean;
  /** Provider actif (SIGNATURE_PROVIDER=docuseal). */
  active: boolean;
}

const STEPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Déployer l’instance (clenzy-infra)',
    detail: 'Ajouter le container DocuSeal au docker-compose + reverse proxy nginx (ex. sign.clenzy.fr).',
  },
  {
    title: 'Configurer le backend',
    detail: 'Renseigner DOCUSEAL_BASE_URL et DOCUSEAL_API_KEY (clé générée dans DocuSeal → Réglages → API) sur le service pms-server.',
  },
  {
    title: 'Activer le provider',
    detail: 'Basculer SIGNATURE_PROVIDER=docuseal puis redéployer. Sans cette bascule, le workflow interne Clenzy (SES) reste utilisé.',
  },
];

export default function DocuSealInfoCard({ available, active }: DocuSealInfoCardProps) {
  return (
    <Card className="gap-0 py-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2 border-b border-[var(--line)]">
        <ProviderLogo provider="DOCUSEAL" size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="cn-text-body1 text-[0.9rem] font-semibold">DocuSeal</p>
            {active ? (
              <StatusChip size="sm" tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label="Provider actif" className="text-[0.6rem]" />
            ) : available ? (
              <StatusChip size="sm" tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label="Instance connectée — non activé" className="text-[0.6rem]" />
            ) : (
              <StatusChip size="sm" tokens={{ color: 'var(--warn)', bg: 'var(--warn-soft)' }} label="Prêt — à brancher" className="text-[0.6rem]" />
            )}
          </div>
          <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mt-0.5">
            Alternative open source (AGPL) auto-hébergée à DocuSign — signature SES avec scellement cryptographique du PDF, données sur votre infrastructure, 0 € de licence.
          </p>
        </div>
      </div>

      {/* Corps */}
      <div className="px-3 py-2.5">
        <Alert severity={available ? 'success' : 'info'} variant="outlined" sx={{ borderRadius: '8px', fontSize: '0.75rem', py: 0.25, mb: 1.5 }}>
          {available
            ? "L'instance DocuSeal est configurée. Le provider est implémenté et fonctionnel — il ne sera utilisé qu'après la bascule SIGNATURE_PROVIDER=docuseal."
            : "L'intégration est entièrement implémentée côté code (création de la demande, lien de signature, statut, téléchargement du document signé). Elle est inactive tant que l'instance self-hosted n'est pas déployée et branchée — opération d'infrastructure, pas de saisie ici."}
        </Alert>

        <p className="cn-text-body1 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
          Branchement (opération infra)
        </p>
        <div className="flex flex-col gap-1.5">
          {STEPS.map((step, i) => (
            <div className="flex gap-2 items-start" key={step.title}>
              <div className="w-[20px] h-[20px] rounded-[50%] shrink-0 inline-flex items-center justify-center text-[0.65rem] font-bold bg-[var(--accent-soft)] text-[var(--accent)]">
                {i + 1}
              </div>
              <div>
                <p className="cn-text-body1 text-[0.78rem] font-semibold leading-[1.3]">{step.title}</p>
                <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.45]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 mt-2">
          <span className="inline-flex text-[var(--ok)]">
            <CheckCircle size={13} strokeWidth={2} />
          </span>
          <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">
            En attendant, la signature électronique fonctionne via le workflow interne Clenzy (SES, lien public + certificat de preuve).
          </p>
        </div>
      </div>
    </Card>
  );
}
