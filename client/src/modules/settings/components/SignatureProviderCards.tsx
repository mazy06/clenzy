import { Box, Chip } from '@mui/material';
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

const ACCENT = '#4A9B8E';
const READY = '#D4A574';

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
  <Box
    component="span"
    sx={{
      fontSize: '0.56rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      color: ACCENT,
      backgroundColor: `${ACCENT}14`,
      border: `1px solid ${ACCENT}33`,
      borderRadius: '3px',
      px: 0.375,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      flexShrink: 0,
    }}
  >
    QTSP
    <span aria-hidden="true" style={{ fontSize: '0.85em' }}>🇫🇷</span>
  </Box>
);

/** Provider implémenté côté code mais pas encore branché (config/clé manquante). */
const readyToWireBadge = (
  <Chip
    label="Prêt — à brancher"
    size="small"
    sx={{
      height: 18,
      fontSize: '0.6rem',
      fontWeight: 700,
      color: READY,
      backgroundColor: `${READY}14`,
      border: `1px solid ${READY}40`,
      '& .MuiChip-label': { px: 0.875 },
    }}
  />
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
    <Box
      role="radiogroup"
      aria-label="Fournisseur de signature electronique"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 1.5,
        mt: 1,
      }}
    >
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
    </Box>
  );
}
