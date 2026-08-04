import React, { useState } from 'react';
import { Button, Spinner } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import {
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingIcon,
  ArrowForward as ArrowIcon,
  CheckCircleOutline as CheckIcon,
} from '../../icons';
import { subscriptionApi } from '../../services/api/subscriptionApi';

// ─── Couleurs Baitly (brand) ───────────────────────────────────────────────
const C = {
  primary:      '#6B8A9A',
  primaryLight: '#8BA3B3',
} as const;

// ─── Forfaits ──────────────────────────────────────────────────────────────

interface ForfaitInfo {
  label: string;
  features: string[];
  highlight: boolean;
}

const FORFAITS: Record<string, ForfaitInfo> = {
  essentiel: {
    label: 'Essentiel',
    features: ['Gestion des proprietes', 'Interventions manuelles', 'Suivi basique'],
    highlight: false,
  },
  confort: {
    label: 'Confort',
    features: ['Planning interactif', 'Import iCal automatique', 'Interventions auto', 'Notifications'],
    highlight: true,
  },
  premium: {
    label: 'Premium',
    features: ['Tout Confort inclus', 'Rapports & analytics', 'Support prioritaire', 'API dediee'],
    highlight: false,
  },
};

// ─── Composant ─────────────────────────────────────────────────────────────

interface UpgradeBannerProps {
  currentForfait?: string;
  onUpgradeComplete?: () => void;
}

const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ currentForfait }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (targetForfait: string) => {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await subscriptionApi.upgrade(targetForfait);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch {
      setError('Impossible de lancer la mise a niveau. Veuillez reessayer.');
      setLoading(false);
    }
  };

  if (!currentForfait || currentForfait.toLowerCase() !== 'essentiel') {
    return null;
  }

  return (
    // L'ombre bascule desormais par la variante `dark:` (pilotee par
    // [data-theme="dark"]) : plus besoin de lire le mode a l'execution.
    <div className="bg-[var(--card)] rounded-[12px] border-l-4 border-solid border-l-[var(--mui-primary)] p-[15px] mb-3 flex flex-col gap-3 shadow-[0_2px_8px_rgba(107,138,154,0.12)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      {/* ── Ligne 1 : Description (gauche) + Forfaits (droite) ──────── */}
      <div className="flex flex-col min-[900px]:flex-row gap-[15px] min-[900px]:items-start">
        {/* Colonne gauche : icone + texte descriptif */}
        <div className="flex gap-3 flex-[1_1_0] min-w-0">
          {/* Icone cercle */}
          <div className="w-[48px] h-[48px] rounded-[50%] bg-[rgba(107,138,154,0.08)] flex items-center justify-center shrink-0">
            <span className="inline-flex" style={{ color: C.primary }}><CalendarIcon size={24} strokeWidth={1.75} /></span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <h6 className="cn-text-h6 font-bold text-[1rem] text-foreground leading-[1.3]">
                Debloquez le Planning & l'import iCal
              </h6>
              <StatusChip tone="neutral" label="Forfait Essentiel" className="text-[0.7rem]" />
            </div>
            <p className="cn-text-body2 text-muted-foreground text-[0.813rem] leading-[1.6]">
              Votre forfait actuel ne permet pas l'acces au planning interactif ni a l'import
              automatique de vos calendriers Airbnb, Booking et autres plateformes. Passez au
              forfait Confort pour automatiser la gestion de vos reservations.
            </p>
          </div>
        </div>

        {/* Colonne droite : 3 forfaits cote a cote */}
        <div className="flex gap-[9px] flex-[1_1_0] min-w-0 shrink-0">
          {Object.entries(FORFAITS).map(([key, { label, features, highlight }]) => {
            const isCurrent = key === currentForfait?.toLowerCase();
            return (
              <div
                key={key}
                className={cn(
                  'flex-[1_1_0] min-w-0 rounded-[8px] p-[9px] relative border-solid',
                  'transition-shadow duration-200 ease-[ease] motion-reduce:transition-none',
                  // Branches LITTERALES : fond et ombre basculent par la variante
                  // `dark:`, la ou l'ancien style inline lisait le mode MUI.
                  highlight
                    ? 'border-[1.5px] border-[var(--mui-primary)] bg-[rgba(107,138,154,0.05)] dark:bg-[rgba(107,138,154,0.12)] shadow-[0_1px_4px_rgba(107,138,154,0.10)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.2)]'
                    : 'border border-[var(--line)] bg-[#F8FAFC] dark:bg-[rgba(255,255,255,0.04)]',
                )}
              >
                {/* Puce a cheval sur la bordure de la carte : fond OPAQUE
                    (--card) et bordure d'accent, sinon le trait de la carte
                    transparait sous le fond doux habituel. */}
                {highlight && (
                  <StatusChip
                    tokens={{ color: 'var(--accent)', bg: 'var(--card)' }}
                    label="Recommande"
                    size="sm"
                    className="absolute -top-2.5 right-2 h-5 border-[1.5px] border-solid border-[var(--accent)] px-1.5 text-[0.65rem] font-bold"
                  />
                )}
                {/* Couleur calculee a l'execution (highlight/isCurrent) : elle passe par
                    style, ou les jetons MUI 'text.*' seraient inertes — d'ou les
                    variables CSS. mb: 0.75 = 4,5 px (theme.spacing vaut 6). */}
                <h6
                  className="cn-text-subtitle2 font-bold text-[0.813rem] mb-[4.5px]"
                  style={{ color: highlight ? C.primary : isCurrent ? 'var(--muted)' : 'var(--ink)' }}
                >
                  {label}
                  {isCurrent && (
                    <span className="text-[0.7rem] text-muted-foreground font-normal ms-0.5">
                      (actuel)
                    </span>
                  )}
                </h6>
                {features.map((f) => (
                  <div className="flex items-center gap-1 mb-0.5" key={f}>
                    {/* 'text.disabled' etait un jeton MUI inerte en style inline : jeton CSS du projet */}
                    <span className="inline-flex shrink-0" style={{ color: highlight ? C.primary : isCurrent ? 'var(--faint)' : C.primaryLight }}>
                      <CheckIcon size={13} strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        'cn-text-caption text-[0.7rem] leading-[1.35]',
                        isCurrent ? 'text-[var(--muted)] line-through opacity-60' : 'text-[var(--ink)]',
                      )}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ligne 2 : Boutons CTA en dessous ────────────────────────── */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* « Confort » est l'offre poussee par la banniere : action principale du bloc.
            « Premium » reste une alternative, donc secondaire (outline sourdine). */}
        <Button
          disabled={loading}
          onClick={() => handleUpgrade('confort')}
        >
          {loading ? <Spinner className="size-4" /> : <CalendarIcon />}
          {loading ? 'Redirection...' : 'Passer au Confort'}
          {!loading && <ArrowIcon size={18} strokeWidth={1.75} />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[var(--muted)]"
          disabled={loading}
          onClick={() => handleUpgrade('premium')}
        >
          <TrendingIcon size={16} strokeWidth={1.75} />
          Passer au Premium
        </Button>

        {/* Error message */}
        {error && (
          <span className="cn-text-caption text-destructive ms-1.5">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

export default UpgradeBanner;
