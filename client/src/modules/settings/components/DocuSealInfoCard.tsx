import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription, Card } from '../../../components/ui';
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
    detail: 'Basculer SIGNATURE_PROVIDER=docuseal puis redéployer. Sans cette bascule, le workflow interne Baitly (SES) reste utilisé.',
  },
];

export default function DocuSealInfoCard({ available, active }: DocuSealInfoCardProps) {
  return (
    <Card className="gap-0 py-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2 border-b border-border">
        <ProviderLogo provider="DOCUSEAL" size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold tracking-tight">DocuSeal</p>
            {active ? (
              <StatusChip size="sm" tone="ok" label="Provider actif" />
            ) : available ? (
              <StatusChip size="sm" tone="ok" label="Instance connectée — non activé" />
            ) : (
              <StatusChip size="sm" tone="warn" label="Prêt — à brancher" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Alternative open source (AGPL) auto-hébergée à DocuSign — signature SES avec scellement cryptographique du PDF, données sur votre infrastructure, 0 € de licence.
          </p>
        </div>
      </div>

      {/* Corps */}
      <div className="px-3 py-2.5">
        <Alert variant={available ? 'success' : 'info'} className="rounded-md py-[1.5px] mb-[9px]">
          <AlertDescription className="text-xs">
            {available
              ? "L'instance DocuSeal est configurée. Le provider est implémenté et fonctionnel — il ne sera utilisé qu'après la bascule SIGNATURE_PROVIDER=docuseal."
              : "L'intégration est entièrement implémentée côté code (création de la demande, lien de signature, statut, téléchargement du document signé). Elle est inactive tant que l'instance self-hosted n'est pas déployée et branchée — opération d'infrastructure, pas de saisie ici."}
          </AlertDescription>
        </Alert>

        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Branchement (opération infra)
        </p>
        {/* Volontairement des <div> et non un <ol> : le projet tourne sans
            preflight Tailwind, une liste native rapporterait puce, retrait et
            marges du navigateur — et un second numerotage. */}
        <div className="flex flex-col gap-1.5">
          {STEPS.map((step, i) => (
            <div className="flex gap-2 items-start" key={step.title}>
              <span className="size-5 rounded-full shrink-0 inline-flex items-center justify-center text-2xs font-semibold tabular-nums bg-primary-soft text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium leading-snug">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 mt-2">
          <span className="inline-flex text-success">
            <CheckCircle size={13} strokeWidth={2} />
          </span>
          <p className="text-xs text-muted-foreground">
            En attendant, la signature électronique fonctionne via le workflow interne Baitly (SES, lien public + certificat de preuve).
          </p>
        </div>
      </div>
    </Card>
  );
}
