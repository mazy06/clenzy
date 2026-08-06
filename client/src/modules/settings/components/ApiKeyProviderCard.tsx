import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import {
  externalConnectionApi,
  PROVIDER_META,
  type ApiKeyProvider,
} from '../../../services/api/externalConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper Signature autour du composant generique {@link ApiKeyConnectionCard}.
 *
 * <p>Specificite domain : QTSP chip dans le header (pour les providers certifies
 * ANSSI — Yousign, Universign, DocaPoste). Le reste est identique aux autres
 * wrappers (pricing, compliance) — toute la mecanique vit dans le generic.</p>
 */
interface Props {
  provider: ApiKeyProvider;
  onStatusChange?: (connected: boolean) => void;
}

const ACCENT = 'var(--bui-success-ink)';

const ApiKeyProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = PROVIDER_META[provider];

  const qtspChip = meta.qtspFrance ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-[0.6rem] font-bold tracking-[0.02em] rounded-[4px] px-[3px] py-[0.75px] inline-flex items-center gap-[3px] cursor-help" style={{ color: ACCENT, backgroundColor: `color-mix(in srgb, ${ACCENT} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${ACCENT} 20%, transparent)` }}>
          QTSP
          <span aria-hidden="true" style={{ fontSize: '0.85em' }}>🇫🇷</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Qualified Trust Service Provider certifié ANSSI (France)</TooltipContent>
    </Tooltip>
  ) : undefined;

  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={externalConnectionApi as ApiKeyConnectionApi<ApiKeyProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      headerChip={qtspChip}
      scaffoldingNote={`L'intégration ${meta.label} est en cours de développement. La connexion permet de valider et stocker vos credentials ; les appels signature seront ajoutés prochainement.`}
    />
  );
};

export default ApiKeyProviderCard;
