import React from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  complianceConnectionApi,
  COMPLIANCE_PROVIDER_META,
  type ComplianceProvider,
} from '../../../services/api/complianceConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

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

const NEUTRAL = 'var(--muted)';

const ComplianceProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = COMPLIANCE_PROVIDER_META[provider];
  const countryFlag =
    meta.countryCode === 'FR' ? '🇫🇷' : meta.countryCode === 'MA' ? '🇲🇦' : '🇸🇦';

  const headerChip = (
    <span className="text-[0.6rem] font-bold tracking-[0.02em] rounded-[4px] px-[3px] py-[0.75px] inline-flex items-center gap-[3px]" style={{ color: NEUTRAL, backgroundColor: `color-mix(in srgb, ${NEUTRAL} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${NEUTRAL} 20%, transparent)` }}>
      {meta.countryCode}
      <span aria-hidden="true" style={{ fontSize: '0.85em' }}>{countryFlag}</span>
    </span>
  );

  // Le ton `warning` du kit est plein ; l'ancienne alerte etait « outlined » :
  // fond transparent + liseré teinte, restitue ici en classes.
  const bodyAlert = (
    <Alert
      variant="warning"
      className="rounded-[8px] py-[3px] bg-transparent border border-solid border-[color-mix(in_srgb,var(--bui-warning)_50%,transparent)]"
    >
      <TriangleAlert />
      <AlertDescription className="text-[0.74rem]">
        <strong>Obligation légale :</strong> {meta.legalNote}
      </AlertDescription>
    </Alert>
  );

  // Chekin dispose d'une API publique : la connexion valide la clé par un appel réel
  // et les fiches de police sont transmises automatiquement. Les providers
  // gouvernementaux (DGSN / Absher) attendent un partenariat officiel : la connexion
  // enregistre les credentials mais aucune transmission n'a lieu.
  const scaffoldingNote =
    provider === 'CHEKIN'
      ? 'Votre clé API est validée par un appel réel à Chekin lors de la connexion. Les fiches de police des voyageurs sont ensuite transmises automatiquement dès que le check-in en ligne est complété.'
      : `L'intégration ${meta.label} nécessite un accès officiel de l'autorité concernée (pas d'API publique). Vos credentials sont enregistrés dès maintenant ; la transmission automatique sera activée dès que le partenariat sera établi.`;

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
