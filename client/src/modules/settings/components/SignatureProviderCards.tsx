
import StatusChip from '../../../components/StatusChip';
import ServiceGridCard from './ServiceGridCard';
import type { ProviderId } from './ProviderLogos';
import type { SignatureProvider } from '../../../services/api/integrationsApi';

/**
 * Grille des providers de signature électronique — Phase 2 : les deux
 * intégrations retenues (Yousign QTSP + DocuSeal self-hosted), implémentées
 * côté code mais NON branchées (le workflow interne Clenzy reste le provider
 * actif tant que `SIGNATURE_PROVIDER` n'est pas basculé).
 *
 * Sélection = navigation pure (single-focus) vers le panneau de configuration
 * en bas. Utilise le composant partagé {@link ServiceGridCard}.
 */

const ACCENT = 'var(--ok)';
const READY = 'var(--warn)';

type SelectableProvider = Exclude<SignatureProvider, null>;

interface ProviderCardSpec {
  id: ProviderId;
  value: SelectableProvider;
  label: string;
  description: string;
  qtspFr?: boolean;
}

const PROVIDERS: ProviderCardSpec[] = [
  { id: 'YOUSIGN',  value: 'YOUSIGN',  label: 'Yousign',  description: 'QTSP français · SES + AES + QES · clé API', qtspFr: true },
  { id: 'DOCUSEAL', value: 'DOCUSEAL', label: 'DocuSeal', description: 'Open source self-hosted · SES + scellement PDF' },
];

/** Badge "QTSP 🇫🇷" (rendu dans le titre via titleAdornment, sans tooltip propre pour eviter l'imbrication). */
const qtspBadge = (
  <span className="text-[0.56rem] font-bold tracking-[0.02em] bg-[var(--ok-soft)] border border-solid border-[color-mix(in_srgb,_var(--ok)_20%,_transparent)] rounded-[24px] px-[2.25px] inline-flex items-center gap-0.5 shrink-0" style={{ color: ACCENT }}>
    QTSP
    <span aria-hidden="true" style={{ fontSize: '0.85em' }}>🇫🇷</span>
  </span>
);

/** Provider implémenté côté code mais pas encore branché (config/clé manquante). */
const readyToWireBadge = (
  <StatusChip size="sm" tokens={{ color: READY, bg: 'var(--warn-soft)' }} label="Prêt — à brancher" className="text-[0.6rem]" />
);

interface SignatureProviderCardsProps {
  /** Provider actuellement focusé (panneau affiché en bas). null si aucun. */
  value: SelectableProvider | null;
  onChange: (next: SelectableProvider) => void;
  /** Providers configurés/connectés (clé API saisie, instance déployée…). */
  connectedSet?: Set<SelectableProvider>;
  /**
   * Filtre par ID de service : si non-null, on n'affiche QUE la card du
   * service correspondant (utile depuis l'autocomplete de recherche).
   */
  serviceFilter?: string | null;
}

export default function SignatureProviderCards({
  value,
  onChange,
  connectedSet,
  serviceFilter = null,
}: SignatureProviderCardsProps) {
  const visibleProviders = serviceFilter
    ? PROVIDERS.filter((p) => p.value === serviceFilter)
    : PROVIDERS;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-[9px] mt-1.5" role="radiogroup" aria-label="Fournisseur de signature electronique">
      {visibleProviders.map((p) => {
        const connected = connectedSet?.has(p.value) ?? false;
        return (
          <ServiceGridCard
            key={p.id}
            providerId={p.id}
            serviceTooltipId={p.value}
            label={p.label}
            description={p.description}
            role="radio"
            selected={value === p.value}
            status={connected ? 'connected' : 'idle'}
            badge={connected ? undefined : readyToWireBadge}
            onClick={() => onChange(p.value)}
            titleAdornment={p.qtspFr ? qtspBadge : undefined}
          />
        );
      })}
    </div>
  );
}
