import React, { useState } from 'react';
import { Badge, Button, Card, CardContent, Spinner } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingIcon,
  ArrowForward as ArrowIcon,
  CheckCircleOutline as CheckIcon,
} from '../../icons';
import { subscriptionApi } from '../../services/api/subscriptionApi';

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
    // Le liseré latéral de 4 px est proscrit : la carte se distingue par sa
    // surface et son ombre discrète, pas par une bande de couleur.
    <Card size="sm" className="mb-3 shadow-sm">
      <CardContent className="flex flex-col gap-3">
        {/* ── Ligne 1 : Description (gauche) + Forfaits (droite) ──────── */}
        <div className="flex flex-col gap-[15px] min-[900px]:flex-row min-[900px]:items-start">
          {/* Colonne gauche : icone + texte descriptif */}
          <div className="flex flex-[1_1_0] min-w-0 gap-3">
            {/* Icone cercle */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CalendarIcon size={24} strokeWidth={1.75} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <h6 className="text-base font-semibold tracking-tight text-balance text-foreground">
                  Debloquez le Planning & l'import iCal
                </h6>
                <Badge variant="secondary">Forfait Essentiel</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Votre forfait actuel ne permet pas l'acces au planning interactif ni a l'import
                automatique de vos calendriers Airbnb, Booking et autres plateformes. Passez au
                forfait Confort pour automatiser la gestion de vos reservations.
              </p>
            </div>
          </div>

          {/* Colonne droite : 3 forfaits cote a cote */}
          <div className="flex flex-[1_1_0] min-w-0 shrink-0 gap-[9px]">
            {Object.entries(FORFAITS).map(([key, { label, features, highlight }]) => {
              const isCurrent = key === currentForfait?.toLowerCase();
              return (
                <div
                  key={key}
                  className={cn(
                    'relative flex-[1_1_0] min-w-0 rounded-md border border-solid p-[9px]',
                    'transition-shadow duration-200 ease-out-quart motion-reduce:transition-none',
                    // L'offre poussée se signale par sa surface (fond doux +
                    // filet d'accent), pas par une bande latérale.
                    highlight
                      ? 'border-primary bg-primary-soft shadow-sm'
                      : 'border-border bg-muted',
                  )}
                >
                  {/* Puce a cheval sur la bordure de la carte : fond OPAQUE
                      (bg-card) et filet d'accent, sinon le trait de la carte
                      transparait sous le fond doux habituel. */}
                  {highlight && (
                    <Badge
                      variant="outline"
                      className="absolute -top-2.5 end-2 h-5 border-solid border-primary bg-card px-1.5 text-2xs font-bold text-primary"
                    >
                      Recommande
                    </Badge>
                  )}
                  {/* Branches LITTERALES : Tailwind n'emet que les classes qu'il
                      lit dans la source, une classe construite depuis une
                      variable ne naitrait jamais. */}
                  <h6
                    className={cn(
                      'mb-[4.5px] text-xs font-bold',
                      highlight ? 'text-primary' : isCurrent ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {label}
                    {isCurrent && (
                      <span className="ms-0.5 text-2xs font-normal text-muted-foreground">
                        (actuel)
                      </span>
                    )}
                  </h6>
                  {features.map((f) => (
                    <div className="mb-0.5 flex items-center gap-1" key={f}>
                      <span
                        className={cn(
                          'inline-flex shrink-0',
                          highlight ? 'text-primary' : isCurrent ? 'text-faint' : 'text-muted-foreground',
                        )}
                      >
                        <CheckIcon size={13} strokeWidth={1.75} />
                      </span>
                      <span
                        className={cn(
                          'text-2xs leading-[1.35]',
                          isCurrent ? 'text-muted-foreground line-through opacity-60' : 'text-foreground',
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
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={loading}
            onClick={() => handleUpgrade('premium')}
          >
            <TrendingIcon size={16} strokeWidth={1.75} />
            Passer au Premium
          </Button>

          {/* Error message */}
          {error && (
            <span className="ms-1.5 text-xs text-destructive-ink">
              {error}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UpgradeBanner;
