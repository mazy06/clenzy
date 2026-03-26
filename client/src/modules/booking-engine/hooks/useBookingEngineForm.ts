import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { BookingEngineConfig, BookingEngineConfigUpdate, DesignTokens } from '../../../services/api/bookingEngineApi';
import type { ComponentVisibility } from '../ComponentVisibilityConfig';
import { DEFAULT_COMPONENT_VISIBILITY } from '../ComponentVisibilityConfig';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default design tokens inspired by Safari Lodge (Diadao SDK). */
export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  primaryColor: '#B2974A',
  secondaryColor: '#49554C',
  accentColor: '#B2974A',
  backgroundColor: '#F2F1EB',
  surfaceColor: '#FFFFFF',
  textColor: '#49554C',
  textSecondaryColor: '#8EA093',
  headingFontFamily: 'Poppins, Arial, sans-serif',
  bodyFontFamily: 'Poppins, Arial, sans-serif',
  baseFontSize: '15px',
  headingFontWeight: '500',
  borderRadius: '4px',
  buttonBorderRadius: '2px',
  cardBorderRadius: '4px',
  spacing: '8px',
  boxShadow: '0 0 40px rgba(0,0,0,0.16)',
  cardShadow: 'none',
  buttonStyle: 'filled',
  buttonTextTransform: 'uppercase',
  borderColor: '#E5E2D9',
  dividerColor: '#E5E2D9',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseComponentConfig(raw: string | null): ComponentVisibility {
  if (!raw) return { ...DEFAULT_COMPONENT_VISIBILITY };
  try {
    return { ...DEFAULT_COMPONENT_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COMPONENT_VISIBILITY };
  }
}

function buildFormFromConfig(config: BookingEngineConfig | null): BookingEngineConfigUpdate {
  if (!config) {
    return {
      name: '',
      primaryColor: '#2563eb',
      accentColor: null,
      logoUrl: null,
      fontFamily: null,
      defaultLanguage: 'fr',
      defaultCurrency: 'EUR',
      minAdvanceDays: 1,
      maxAdvanceDays: 365,
      cancellationPolicy: null,
      termsUrl: null,
      privacyUrl: null,
      allowedOrigins: null,
      collectPaymentOnBooking: true,
      autoConfirm: true,
      showCleaningFee: true,
      showTouristTax: true,
      customCss: null,
      customJs: null,
      componentConfig: null,
      designTokens: null,
      sourceWebsiteUrl: null,
      aiAnalysisAt: null,
      widgetPosition: 'bottom',
      inlineTargetId: null,
      inlinePlacement: 'after',
    };
  }
  return {
    name: config.name,
    primaryColor: config.primaryColor || '#B2974A',
    accentColor: config.accentColor,
    logoUrl: config.logoUrl,
    fontFamily: config.fontFamily,
    defaultLanguage: config.defaultLanguage || 'fr',
    defaultCurrency: config.defaultCurrency || 'EUR',
    minAdvanceDays: config.minAdvanceDays ?? 1,
    maxAdvanceDays: config.maxAdvanceDays ?? 365,
    cancellationPolicy: config.cancellationPolicy,
    termsUrl: config.termsUrl,
    privacyUrl: config.privacyUrl,
    allowedOrigins: config.allowedOrigins,
    collectPaymentOnBooking: config.collectPaymentOnBooking,
    autoConfirm: config.autoConfirm,
    showCleaningFee: config.showCleaningFee,
    showTouristTax: config.showTouristTax,
    customCss: config.customCss,
    customJs: config.customJs,
    componentConfig: config.componentConfig,
    designTokens: config.designTokens,
    sourceWebsiteUrl: config.sourceWebsiteUrl,
    aiAnalysisAt: config.aiAnalysisAt,
    widgetPosition: config.widgetPosition ?? 'bottom',
    inlineTargetId: config.inlineTargetId,
    inlinePlacement: config.inlinePlacement ?? 'after',
  };
}

function parseDesignTokens(raw: string | null | undefined): DesignTokens {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseBookingEngineFormResult {
  name: string;
  setName: (name: string) => void;
  form: BookingEngineConfigUpdate;
  handleChange: (field: keyof BookingEngineConfigUpdate, value: unknown) => void;
  designTokens: DesignTokens;
  setDesignTokens: Dispatch<SetStateAction<DesignTokens>>;
  componentVis: ComponentVisibility;
  handleComponentVisChange: (vis: ComponentVisibility) => void;
}

export function useBookingEngineForm(config: BookingEngineConfig | null): UseBookingEngineFormResult {
  const [name, setName] = useState(config?.name || '');
  const [form, setForm] = useState<BookingEngineConfigUpdate>(() => buildFormFromConfig(config));

  const [designTokens, setDesignTokens] = useState<DesignTokens>(() => {
    if (config?.designTokens) return parseDesignTokens(config.designTokens);
    return { ...DEFAULT_DESIGN_TOKENS };
  });

  const [componentVis, setComponentVis] = useState<ComponentVisibility>(
    parseComponentConfig(config?.componentConfig ?? null),
  );

  // Sync when config changes (edit mode) or reset when null (create mode)
  useEffect(() => {
    setName(config?.name || '');
    setForm(buildFormFromConfig(config));
    setComponentVis(parseComponentConfig(config?.componentConfig ?? null));

    if (config?.designTokens) {
      setDesignTokens(parseDesignTokens(config.designTokens));
    } else {
      // Create mode (config === null) → use defaults; edit mode without tokens → empty
      setDesignTokens(config === null ? { ...DEFAULT_DESIGN_TOKENS } : {});
    }
  }, [config]);

  const handleChange = useCallback((field: keyof BookingEngineConfigUpdate, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleComponentVisChange = useCallback((vis: ComponentVisibility) => {
    setComponentVis(vis);
    setForm((prev) => ({ ...prev, componentConfig: JSON.stringify(vis) }));
  }, []);

  return {
    name,
    setName,
    form,
    handleChange,
    designTokens,
    setDesignTokens,
    componentVis,
    handleComponentVisChange,
  };
}
