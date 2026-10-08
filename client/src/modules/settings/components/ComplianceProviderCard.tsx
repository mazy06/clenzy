import React from 'react';
import { Alert, AlertDescription, Badge } from '../../../components/ui';
import { TriangleAlert } from '../../../icons/glyphs';
import {
  complianceConnectionApi,
  COMPLIANCE_PROVIDER_META,
  type ComplianceProvider,
} from '../../../services/api/complianceConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Wrapper Compliance autour du composant generique {@link ApiKeyConnectionCard}.
 * Ajoute deux slots specifiques au domaine :
 *   - {@code headerChip} : code pays (FR / MA / SA) avec drapeau
 *   - {@code bodyAlert} : rappel de l'obligation legale (severity warning)
 */
interface Props {
  provider: ComplianceProvider;
  onStatusChange?: (connected: boolean) => void;
}

const ComplianceProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const { t } = useTranslation();
  const meta = COMPLIANCE_PROVIDER_META[provider];
  // Drapeau national : aucune icone lucide n'en tient lieu, et il ne porte
  // aucun sens a lui seul — le code pays le precede, le drapeau est masque
  // aux lecteurs d'ecran.
  const countryFlag =
    meta.countryCode === 'FR' ? '🇫🇷' : meta.countryCode === 'MA' ? '🇲🇦' : '🇸🇦';

  const headerChip = (
    // `border-solid` : sans preflight Tailwind, une bordure sans style declare
    // a bien une largeur mais reste invisible (cf. note dans StatusChip).
    <Badge
      variant="outline"
      className="gap-[3px] border-solid px-1 py-0 text-2xs font-semibold text-muted-foreground"
    >
      {meta.countryCode}
      <span aria-hidden="true" className="text-[0.85em] leading-none">{countryFlag}</span>
    </Badge>
  );

  // Le ton `warning` du kit est plein ; l'ancienne alerte etait « outlined » :
  // fond transparent + liseré teinte, restitue ici en classes. `border-solid`
  // est indispensable : le projet tourne sans preflight Tailwind, une bordure
  // sans style declare reste invisible.
  const bodyAlert = (
    <Alert
      variant="warning"
      className="rounded-md py-[3px] bg-transparent border-solid border-warning/50"
    >
      <TriangleAlert />
      <AlertDescription className="text-xs">
        <strong>{t('settings.integrations.legalObligation')}</strong> {t(meta.legalNoteKey)}
      </AlertDescription>
    </Alert>
  );

  // Chekin dispose d'une API publique : la connexion valide la clé par un appel réel
  // et les fiches de police sont transmises automatiquement. Les providers
  // gouvernementaux (DGSN / Absher) attendent un partenariat officiel : la connexion
  // enregistre les credentials mais aucune transmission n'a lieu.
  const scaffoldingNote =
    provider === 'CHEKIN'
      ? t('settings.integrations.chekinHint')
      : t('settings.integrations.scaffolding.compliance', { provider: meta.label });

  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={complianceConnectionApi as ApiKeyConnectionApi<ComplianceProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      headerChip={headerChip}
      bodyAlert={bodyAlert}
      scaffoldingNote={scaffoldingNote}
    />
  );
};

export default ComplianceProviderCard;
