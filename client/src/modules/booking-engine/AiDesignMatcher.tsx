import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertAction, AlertDescription, AlertTitle, Button, Spinner } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Field, FieldLabel, FieldDescription, Input } from '../../components/ui';
import { AutoFixHighRounded } from '../../icons';
import { CheckCircleOutlineRounded } from '../../icons';
import { SettingsRounded } from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAnalyzeWebsiteDesign } from '../../hooks/useBookingEngineConfig';
import type { DesignTokens } from '../../services/api/bookingEngineApi';
import type { ApiError } from '../../services/apiClient';

interface AiDesignMatcherProps {
  configId: number | null;
  sourceWebsiteUrl: string;
  onSourceWebsiteUrlChange: (url: string) => void;
  onTokensExtracted: (tokens: DesignTokens, generatedCss: string) => void;
  onAnalysisComplete?: () => void;
  onError?: (message: string) => void;
}

/**
 * Component that lets the user enter a website URL to analyze its design
 * and extract design tokens via AI. Shown in Step 2 (Appearance) of the wizard.
 */
export default function AiDesignMatcher({ configId, sourceWebsiteUrl, onSourceWebsiteUrlChange, onTokensExtracted, onAnalysisComplete, onError }: AiDesignMatcherProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const url = sourceWebsiteUrl;
  const setUrl = onSourceWebsiteUrlChange;
  const [success, setSuccess] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [aiNotConfigured, setAiNotConfigured] = useState<string | null>(null);
  const [budgetExceeded, setBudgetExceeded] = useState(false);

  const analyzeMutation = useAnalyzeWebsiteDesign();

  const handleAnalyze = () => {
    if (!configId || !url.trim()) return;

    setSuccess(false);
    setExtractedColors([]);
    setAiNotConfigured(null);
    setBudgetExceeded(false);

    analyzeMutation.mutate(
      { configId, websiteUrl: url.trim() },
      {
        onSuccess: (data) => {
          setSuccess(true);

          // Extract color swatches for mini preview
          const tokens = data.designTokens;
          const colors = [
            tokens.primaryColor,
            tokens.secondaryColor,
            tokens.accentColor,
            tokens.backgroundColor,
            tokens.textColor,
          ].filter((c): c is string => c != null && c !== '');
          setExtractedColors(colors);

          onTokensExtracted(tokens, data.generatedCss);
          onAnalysisComplete?.();
        },
        onError: (err) => {
          const apiErr = err as unknown as ApiError;
          const details = apiErr.details as Record<string, unknown> | undefined;
          const errorCode = details?.errorCode as string | undefined;

          if (errorCode === 'AI_NOT_CONFIGURED' || errorCode === 'AI_FEATURE_DISABLED') {
            setAiNotConfigured((details?.feature as string) ?? 'openai');
            return;
          }

          if (errorCode === 'AI_BUDGET_EXCEEDED') {
            setBudgetExceeded(true);
            return;
          }

          const message = apiErr.message || t('bookingEngine.ai.analyzeError');
          onError?.(message);
        },
      },
    );
  };

  const isDisabled = configId === null;
  const isLoading = analyzeMutation.isPending;

  return (
    <div className="mb-4">
      {/* URL input + button */}
      <div className="flex flex-row items-start gap-[9px]">
        <Field className="flex-1">
          <FieldLabel htmlFor="ai-design-website-url">{t('bookingEngine.ai.websiteUrl')}</FieldLabel>
          <Input
            id="ai-design-website-url"
            type="url"
            placeholder="https://www.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isDisabled || isLoading}
          />
          {isDisabled && (
            <FieldDescription>{t('bookingEngine.ai.saveFirst')}</FieldDescription>
          )}
        </Field>
        <Button
          size="lg"
          className="whitespace-nowrap min-w-[180px]"
          onClick={handleAnalyze}
          disabled={isDisabled || isLoading || !url.trim()}
        >
          <AutoFixHighRounded />
          {t('bookingEngine.ai.analyzeDesign')}
        </Button>
      </div>

      {/* Loading state */}
      {/* Le kit n'a pas de barre indeterminee : le Spinner porte la meme
          information (analyse en cours, duree inconnue). */}
      {isLoading && (
        <div className="mt-3 flex items-center gap-1.5">
          <Spinner className="size-4 text-[var(--muted)]" />
          <p className="cn-text-body2 text-muted-foreground">
            {t('bookingEngine.ai.analyzing')}
          </p>
        </div>
      )}

      {/* Success state */}
      {success && !isLoading && (
        <Alert variant="success" className="mt-3">
          <CheckCircleOutlineRounded />
          <AlertTitle className={cn('cn-text-body2 font-semibold', extractedColors.length > 0 ? 'mb-1.5' : 'mb-0')}>
            {t('bookingEngine.ai.analyzeSuccess')}
          </AlertTitle>
          {extractedColors.length > 0 && (
            <AlertDescription className="flex flex-row flex-wrap gap-0.5">
              {extractedColors.map((color, idx) => (
                <StatusChip tokens={{ color: isLightColor(color) ? '#000' : '#fff', bg: color }} label={color} className="font-mono text-[0.75rem]" key={idx} />
              ))}
            </AlertDescription>
          )}
        </Alert>
      )}

      {/* AI not configured — actionable message */}
      {aiNotConfigured && !isLoading && (
        <Alert variant="warning" className="mt-3">
          <SettingsRounded />
          <AlertTitle className="cn-text-body2 font-semibold">
            {t('bookingEngine.ai.aiNotConfiguredTitle')}
          </AlertTitle>
          <AlertDescription className="cn-text-body2">
            {t('bookingEngine.ai.aiNotConfiguredMessage', { provider: aiNotConfigured })}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
              onClick={() => navigate('/settings?tab=ai')}
            >
              {t('bookingEngine.ai.goToSettings')}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Budget exceeded — actionable message */}
      {budgetExceeded && !isLoading && (
        <Alert variant="warning" className="mt-3">
          <SettingsRounded />
          <AlertTitle className="cn-text-body2 font-semibold">
            {t('bookingEngine.ai.budgetExceededTitle')}
          </AlertTitle>
          <AlertDescription className="cn-text-body2">
            {t('bookingEngine.ai.budgetExceededMessage')}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
              onClick={() => navigate('/settings?tab=ai')}
            >
              {t('bookingEngine.ai.goToSettings')}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Generic error state */}
      {analyzeMutation.isError && !isLoading && !aiNotConfigured && !budgetExceeded && (
        <Alert variant="destructive" className="mt-3">
          <TriangleAlert />
          <AlertDescription>{t('bookingEngine.ai.analyzeError')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Simple heuristic to determine if a hex color is light (for text contrast).
 */
function isLightColor(hex: string): boolean {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Perceived brightness
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  } catch {
    return false;
  }
}
