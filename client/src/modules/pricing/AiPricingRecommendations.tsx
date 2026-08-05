import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Badge, Button, Card } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import {
  AutoAwesome,
  TrendingUp,
  TrendingDown,
  Settings as SettingsIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiPricingPredictions } from '../../hooks/useAi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiPricingRecommendationsProps {
  propertyId: number;
  from: string;
  to: string;
  enabled?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Densité de la carte : la surface vient de la primitive `Card`, le rythme d'ici. */
const PANEL_CLASS = 'gap-0 py-0 p-[9px]';

function isAiNotConfiguredError(error: unknown): boolean {
  const apiErr = error as { details?: Record<string, unknown> } | undefined;
  const errorCode = apiErr?.details?.errorCode;
  return errorCode === 'AI_NOT_CONFIGURED' || errorCode === 'AI_FEATURE_DISABLED';
}

function confidenceTone(confidence: number): StatusTone {
  if (confidence >= 0.7) return 'ok';
  if (confidence >= 0.4) return 'warn';
  return 'err';
}

/** En-tête commun aux quatre états du panneau (chargement, erreur, vide, contenu). */
const PanelHeading: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="flex items-center gap-1.5 mb-[9px]">
    <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
    <h6 className="text-xs font-semibold tracking-tight">{title}</h6>
    {count != null && (
      <Badge variant="default" className="h-5 text-2xs font-semibold tabular-nums">{`${count}`}</Badge>
    )}
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────────

const AiPricingRecommendations: React.FC<AiPricingRecommendationsProps> = React.memo(
  ({ propertyId, from, to, enabled = true }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data, isLoading, isError, error } = useAiPricingPredictions(
      propertyId,
      from,
      to,
      enabled,
    );

    // ── Loading state ─────────────────────────────────────────────────
    if (isLoading) {
      return (
        <Card className={PANEL_CLASS}>
          <PanelHeading title={t('bookingEngine.ai.pricing.title')} />
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[48px] rounded-md" />
            ))}
          </div>
        </Card>
      );
    }

    // ── Error state ───────────────────────────────────────────────────
    if (isError) {
      const aiNotConfigured = isAiNotConfiguredError(error);

      return (
        <Card className={PANEL_CLASS}>
          <PanelHeading title={t('bookingEngine.ai.pricing.title')} />
          {aiNotConfigured ? (
            <Alert variant="info" className="text-xs">
              <Info />
              <AlertDescription><p className="text-xs mb-1.5">
                {t('bookingEngine.ai.guidance.pricing.text')}
              </p><Button
                size="xs"
                variant="outline"
                onClick={() => navigate('/settings')}
              >
                <SettingsIcon strokeWidth={1.75} />
                {t('bookingEngine.ai.guidance.pricing.button')}
              </Button></AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="text-xs">
              <TriangleAlert />
              <AlertDescription>{t('common.error')}</AlertDescription>
            </Alert>
          )}
        </Card>
      );
    }

    // ── Empty state ───────────────────────────────────────────────────
    if (!data || data.length === 0) {
      return (
        <Card className={PANEL_CLASS}>
          <PanelHeading title={t('bookingEngine.ai.pricing.title')} />
          <p className="text-xs text-muted-foreground">
            {t('bookingEngine.ai.pricing.loading')}
          </p>
        </Card>
      );
    }

    // ── Content ───────────────────────────────────────────────────────
    return (
      <Card className={PANEL_CLASS}>
        <PanelHeading title={t('bookingEngine.ai.pricing.title')} count={data.length} />

        <div className="flex flex-col gap-1.5">
          {data.map((rec) => (
            <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted" key={rec.date}>
              {/* Date */}
              <div className="min-w-[60px]">
                <span className="text-[0.7rem] font-semibold tabular-nums">
                  {rec.date}
                </span>
              </div>

              {/* Suggested Price */}
              <div className="min-w-[70px] text-end">
                <p className="text-sm font-semibold text-primary tabular-nums">
                  {rec.suggestedPrice.toFixed(0)} €
                </p>
              </div>

              {/* Confidence */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Le `span` porte la ref que TooltipTrigger pose sur son
                      enfant : StatusChip est une fonction et n'en transmet pas. */}
                  <span className="inline-flex">
                    <StatusChip
                      tone={confidenceTone(rec.confidence)}
                      size="sm"
                      label={`${(rec.confidence * 100).toFixed(0)}%`}
                      className="text-[0.6rem]"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {`${t('bookingEngine.ai.pricing.confidence')}: ${(rec.confidence * 100).toFixed(0)}%`}
                </TooltipContent>
              </Tooltip>

              {/* Explanation */}
              <span className="flex-1 truncate text-[0.7rem] text-muted-foreground">
                {rec.explanation}
              </span>
            </div>
          ))}
        </div>

        {/* Market comparison from first recommendation */}
        {data[0]?.marketComparison && (
          <div className="mt-2 pt-1.5 border-t border-border">
            <span className="text-[0.7rem] text-muted-foreground">
              {t('bookingEngine.ai.pricing.marketComparison')}: {data[0].marketComparison}
            </span>
          </div>
        )}
      </Card>
    );
  },
);

AiPricingRecommendations.displayName = 'AiPricingRecommendations';

export default AiPricingRecommendations;
