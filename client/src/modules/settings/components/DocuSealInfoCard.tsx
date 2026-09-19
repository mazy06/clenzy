import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription, Card } from '../../../components/ui';
import ProviderLogo from './ProviderLogos';
import { CheckCircle } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';

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

/** Les libelles vivent dans les locales : `docuseal.steps.<id>.{title,detail}`. */
const STEP_IDS = ['deploy', 'backend', 'enable'] as const;

export default function DocuSealInfoCard({ available, active }: DocuSealInfoCardProps) {
  const { t } = useTranslation();
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
              <StatusChip size="sm" tone="ok" label={t('settings.integrations.docuseal.instanceConnected')} />
            ) : (
              <StatusChip size="sm" tone="warn" label={t('settings.integrations.status.readyToWire2')} />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('settings.integrations.docuseal.description')}
          </p>
        </div>
      </div>

      {/* Corps */}
      <div className="px-3 py-2.5">
        <Alert variant={available ? 'success' : 'info'} className="rounded-md py-[1.5px] mb-[9px]">
          <AlertDescription className="text-xs">
            {available
              ? t('docuseal.configured')
              : t('docuseal.notDeployed')}
          </AlertDescription>
        </Alert>

        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          {t('settings.integrations.docuseal.wiring')}
        </p>
        {/* Volontairement des <div> et non un <ol> : le projet tourne sans
            preflight Tailwind, une liste native rapporterait puce, retrait et
            marges du navigateur — et un second numerotage. */}
        <div className="flex flex-col gap-1.5">
          {STEP_IDS.map((step, i) => (
            <div className="flex gap-2 items-start" key={step}>
              <span className="size-5 rounded-full shrink-0 inline-flex items-center justify-center text-2xs font-semibold tabular-nums bg-primary-soft text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium leading-snug">{t('docuseal.steps.' + step + '.title')}</p>
                <p className="text-xs text-muted-foreground">{t('docuseal.steps.' + step + '.detail')}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 mt-2">
          <span className="inline-flex text-success">
            <CheckCircle size={13} strokeWidth={2} />
          </span>
          <p className="text-xs text-muted-foreground">
            {t('settings.integrations.docuseal.meanwhile')}
          </p>
        </div>
      </div>
    </Card>
  );
}
