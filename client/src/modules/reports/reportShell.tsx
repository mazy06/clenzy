import React from 'react';
import { Alert, AlertDescription, Button, Spinner } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useCurrency } from '../../hooks/useCurrency';
import { useTranslation } from '../../hooks/useTranslation';
import type { ValueFormatter } from '../../components/stats';

/**
 * Coque commune des onglets de Rapports.
 *
 * <p>Chaque onglet chargeait son état vide, son erreur et son bouton de reprise
 * à sa façon : trois messages différents pour le même incident. Ils se lisent
 * maintenant d'un seul endroit.</p>
 */
export const ReportFrame: React.FC<{
  loading: boolean;
  error?: boolean | string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}> = ({ loading, error, onRetry, children }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>
            {typeof error === 'string'
              ? error
              : t('reports.charts.errorLoading', 'Erreur lors du chargement des données')}
          </span>
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t('common.retry', 'Réessayer')}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

/**
 * Formateurs de valeurs des graphiques.
 *
 * <p>Un montant sans devise et un taux sans pourcent se lisent comme des
 * effectifs. Les axes et les infobulles passent tous par ici.</p>
 */
export function useReportFormats() {
  const { convertAndFormat, convert, currency, currencySymbol, rates } = useCurrency();

  return React.useMemo(() => {
    // Sans matrice de taux on reste en euros : afficher le symbole cible sur un
    // montant non converti mentirait sur la valeur.
    const converted = !!rates && currency in rates;
    const symbol = converted ? currencySymbol : '€';
    const compact = new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });

    return {
      money: ((value: number) => convertAndFormat(value, 'EUR')) as ValueFormatter,
      /**
       * Montant abrégé, pour les AXES et le centre des anneaux.
       *
       * <p>« 12 000,00 € » demande 70 px de gouttière ; l'axe en a 44 et
       * rognait le libellé par la gauche, donnant à lire « 0,00 € » à toutes
       * les graduations. Les infobulles, elles, gardent le montant exact.</p>
       */
      moneyCompact: ((value: number) =>
        `${compact.format(converted ? convert(value, 'EUR') : value)} ${symbol}`) as ValueFormatter,
      // `${30.7}` rend « 30.7 » : le point décimal anglais dans une interface
      // française. La locale du navigateur tranche.
      percent: ((value: number) =>
        `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} %`) as ValueFormatter,
      count: ((value: number) => value.toLocaleString()) as ValueFormatter,
      nights: ((value: number) => value.toLocaleString()) as ValueFormatter,
    };
  }, [convertAndFormat, convert, currency, currencySymbol, rates]);
}

/**
 * Échelle de jugement d'un taux.
 *
 * <p>Vert au-dessus de la cible, ambre en approche, rouge en dessous : la
 * couleur porte le verdict que le nombre seul demande d'aller chercher.</p>
 */
export const scaleColor = (value: number, good: number, fair: number): string =>
  value >= good
    ? 'var(--bui-success)'
    : value >= fair
      ? 'var(--bui-warning)'
      : 'var(--bui-destructive)';

export interface SignalItem {
  id: string;
  tone: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  /** Ligne de pied : action suggérée, impact estimé, confiance. */
  meta?: string;
}

const SIGNAL_DOT: Record<SignalItem['tone'], string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
};

/**
 * Alertes et recommandations, en liste plutôt qu'en cartes.
 *
 * <p>Une carte par alerte empilait des cadres dans un cadre et poussait la
 * troisième alerte hors de l'écran. Une pastille de gravité, un intitulé, une
 * phrase : la tuile en montre cinq d'un coup et défile pour le reste.</p>
 */
export const SignalList: React.FC<{ items: SignalItem[]; emptyLabel: string }> = ({
  items,
  emptyLabel,
}) => {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="no-scrollbar m-0 flex h-full list-none flex-col gap-2 overflow-y-auto p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
        >
          <span
            aria-hidden="true"
            className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', SIGNAL_DOT[item.tone])}
          />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs font-semibold text-foreground">{item.title}</p>
            <p className="m-0 text-2xs leading-snug text-muted-foreground">{item.description}</p>
            {item.meta ? (
              <p className="m-0 mt-0.5 text-2xs font-semibold tabular-nums text-success-ink">
                {item.meta}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Un tableau dans une tuile : c'est lui qui défile, jamais la tuile. */
export const TileScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="no-scrollbar h-full min-h-0 overflow-auto">{children}</div>
);
