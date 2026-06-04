import { Box } from '@mui/material';
import ServiceGridCard from './ServiceGridCard';
import type { ProviderId } from './ProviderLogos';
import type { SignatureProvider } from '../../../services/api/integrationsApi';

/**
 * Grille de cards pour selectionner UN provider de signature a visualiser /
 * configurer en bas. Selection = navigation pure (single-focus), pas de
 * connexion ici. Chaque provider conserve sa propre connexion cote backend.
 *
 * Utilise le composant partage {@link ServiceGridCard} (meme design que les
 * cartes IoT Tuya/Minut) : logo + pastille de statut + description 1 ligne +
 * tooltip riche. Le badge "QTSP 🇫🇷" passe en {@code titleAdornment}.
 */

const ACCENT = '#4A9B8E';

type SelectableProvider = Exclude<SignatureProvider, null>;

interface ProviderCardSpec {
  id: ProviderId;
  value: SelectableProvider;
  label: string;
  description: string;
  qtspFr?: boolean;
}

const PROVIDERS: ProviderCardSpec[] = [
  { id: 'YOUSIGN',    value: 'YOUSIGN',    label: 'Yousign',    description: 'QTSP français · API key', qtspFr: true },
  { id: 'UNIVERSIGN', value: 'UNIVERSIGN', label: 'Universign', description: 'QTSP français · API key', qtspFr: true },
  { id: 'DOCAPOSTE',  value: 'DOCAPOSTE',  label: 'DocaPoste',  description: 'QTSP français · API + LRE', qtspFr: true },
  { id: 'DOCUSIGN',   value: 'DOCUSIGN',   label: 'DocuSign',   description: 'Leader mondial · OAuth2' },
  { id: 'PENNYLANE',  value: 'PENNYLANE',  label: 'Pennylane',  description: 'Compta + signature · OAuth2' },
  { id: 'ODOO',       value: 'ODOO',       label: 'Odoo',       description: 'ERP open source · API key' },
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

interface SignatureProviderCardsProps {
  /** Provider actuellement focuse (panneau affiche en bas). null si aucun. */
  value: SelectableProvider | null;
  onChange: (next: SelectableProvider) => void;
  /** Set des providers qui ont deja une connexion active (pour le badge). */
  connectedSet?: Set<SelectableProvider>;
  /** Section "bientot disponible" : pilote le statut affiche (l'interactivite est bloquee par le wrapper). */
  disabled?: boolean;
  /**
   * Filtre par ID de service : si non-null, on n'affiche QUE la card du
   * service correspondant (utile depuis l'autocomplete de recherche).
   * null = toutes les cards visibles (comportement par defaut).
   */
  serviceFilter?: string | null;
}

export default function SignatureProviderCards({
  value,
  onChange,
  connectedSet,
  disabled = false,
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
      {visibleProviders.map((p) => (
        <ServiceGridCard
          key={p.id}
          providerId={p.id}
          serviceTooltipId={p.value}
          label={p.label}
          description={p.description}
          role="radio"
          selected={value === p.value}
          status={connectedSet?.has(p.value) ? 'connected' : disabled ? 'comingSoon' : 'idle'}
          onClick={() => onChange(p.value)}
          titleAdornment={p.qtspFr ? qtspBadge : undefined}
        />
      ))}
    </Box>
  );
}
