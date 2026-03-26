import React, { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { useGuestAuth } from '../../hooks/useGuestAuth';
import type { ComponentVisibility } from './ComponentVisibilityConfig';
import { DEFAULT_COMPONENT_VISIBILITY } from './ComponentVisibilityConfig';
import type { DesignTokens } from '../../services/api/bookingEngineApi';
import type { BookingServiceCategory, SelectedServiceOption } from '../../services/api/bookingServiceOptionsApi';
import { createBookingI18n } from './sdk/i18n';
import { useBookingNavigation } from './hooks/useBookingNavigation';
import { DEFAULTS } from './types/bookingEngine';
import type { PreviewProperty, PreviewPropertyType, PreviewAvailabilityDay } from './types/bookingEngine';
import BookingSearchBar from './components/BookingSearchBar';
import BookingResultsPage from './components/BookingResultsPage';
import BookingCartPage from './components/BookingCartPage';
import BookingAuthPage from './components/BookingAuthPage';
import { BookingValidationPage, BookingConfirmationPage } from './components/BookingPaymentPage';

// Re-export types for backward compatibility
export type { PreviewProperty, PreviewPropertyType, PreviewAvailabilityDay };

interface BookingEnginePreviewProps {
  primaryColor: string;
  accentColor: string | null;
  fontFamily: string | null;
  logoUrl: string | null;
  customCss: string | null;
  componentConfig: ComponentVisibility;
  designTokens?: DesignTokens;
  properties?: PreviewProperty[];
  availabilityDays?: Map<string, PreviewAvailabilityDay>;
  propertyTypes?: PreviewPropertyType[];
  availabilityLoading?: boolean;
  onMonthChange?: (year: number, month: number) => void;
  onTypesChange?: (types: string[]) => void;
  onGuestsChange?: (adults: number, children: number) => void;
  organizationId?: number | null;
  defaultCurrency?: string;
  minAdvanceDays?: number;
  maxAdvanceDays?: number;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  cancellationPolicy?: string | null;
  collectPaymentOnBooking?: boolean;
  autoConfirm?: boolean;
  showCleaningFee?: boolean;
  showTouristTax?: boolean;
  defaultLanguage?: string;
  reviewStats?: Map<number, { avg: number; count: number }>;
  panelDirection?: 'up' | 'down';
  onPageChange?: (page: string) => void;
  serviceCategories?: BookingServiceCategory[];
}

const BookingEnginePreview: React.FC<BookingEnginePreviewProps> = (props) => {
  const {
    primaryColor, accentColor, fontFamily, logoUrl, customCss, componentConfig,
    designTokens, properties, availabilityDays, propertyTypes, availabilityLoading,
    onMonthChange, onTypesChange, onGuestsChange, organizationId,
    defaultCurrency = 'EUR',
    minAdvanceDays = 0, maxAdvanceDays = 365,
    termsUrl, privacyUrl, cancellationPolicy,
    collectPaymentOnBooking = true, autoConfirm = true,
    showCleaningFee = true, showTouristTax = true,
    defaultLanguage = 'fr', reviewStats,
    panelDirection = 'up',
    onPageChange,
    serviceCategories = [],
  } = props;

  const i18n = useMemo(() => createBookingI18n(defaultLanguage as 'fr' | 'en' | 'ar'), [defaultLanguage]);
  const isRTL = defaultLanguage === 'ar';

  // ─── Design tokens ──────────────────────────────────────────────────
  const tk = useMemo(() => ({
    primary: designTokens?.primaryColor || primaryColor || DEFAULTS.primary,
    accent: designTokens?.accentColor || accentColor || designTokens?.primaryColor || primaryColor || DEFAULTS.primary,
    secondary: designTokens?.secondaryColor || DEFAULTS.secondary,
    text: designTokens?.textColor || DEFAULTS.text,
    textLabel: designTokens?.textSecondaryColor || DEFAULTS.textLabel,
    textPlaceholder: DEFAULTS.textPlaceholder,
    surface: designTokens?.surfaceColor || DEFAULTS.surface,
    surfaceMuted: designTokens?.backgroundColor || DEFAULTS.surfaceMuted,
    border: designTokens?.borderColor || DEFAULTS.border,
    font: fontFamily || designTokens?.bodyFontFamily || DEFAULTS.font,
    headingFont: designTokens?.headingFontFamily || DEFAULTS.font,
    radius: designTokens?.borderRadius || DEFAULTS.radius,
    radiusSm: designTokens?.buttonBorderRadius || DEFAULTS.radiusSm,
    cardRadius: designTokens?.cardBorderRadius || DEFAULTS.cardRadius,
    shadow: designTokens?.boxShadow || '0 0 40px rgba(0,0,0,0.16)',
    cardShadow: designTokens?.cardShadow || '0 2px 12px rgba(0,0,0,0.08)',
    btnTransform: (designTokens?.buttonTextTransform || 'uppercase') as React.CSSProperties['textTransform'],
    btnStyle: designTokens?.buttonStyle || 'filled',
  }), [designTokens, primaryColor, accentColor, fontFamily]);

  // Compute min bookable date from minAdvanceDays
  const minBookableDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + minAdvanceDays);
    return d.toISOString().slice(0, 10);
  }, [minAdvanceDays]);

  const btnSx = useMemo(() => {
    if (tk.btnStyle === 'outlined') {
      return {
        border: `1.5px solid ${tk.border}`, color: tk.text, bgcolor: 'transparent',
        '&:hover': { borderColor: tk.primary, color: tk.primary },
      };
    }
    return {
      bgcolor: tk.primary, color: tk.surface,
      '&:hover': { bgcolor: tk.primary, filter: 'brightness(1.08)' },
    };
  }, [tk]);

  // ─── Navigation hook ────────────────────────────────────────────────
  const nav = useBookingNavigation({
    propertyTypes, properties,
    onMonthChange, onTypesChange, onGuestsChange, onPageChange,
  });

  const guestAuth = useGuestAuth(organizationId ?? null);

  // ─── Service options state ────────────────────────────────────────
  const [selectedOptions, setSelectedOptions] = useState<SelectedServiceOption[]>([]);

  // ─── Page router ──────────────────────────────────────────────────
  const renderPage = () => {
    switch (nav.page) {
      case 'search':
        return (
          <BookingSearchBar
            tk={tk} i18n={i18n} btnSx={btnSx} isCompact={nav.isCompact}
            activePanel={nav.activePanel} togglePanel={nav.togglePanel} panelDirection={panelDirection}
            adults={nav.adults} setAdults={nav.setAdults} children={nav.children} setChildren={nav.setChildren}
            selectedTypes={nav.selectedTypes} setSelectedTypes={nav.setSelectedTypes} propertyTypes={propertyTypes}
            checkIn={nav.checkIn} checkOut={nav.checkOut} calMonth={nav.calMonth} setCalMonth={nav.setCalMonth}
            hoverDate={nav.hoverDate} setHoverDate={nav.setHoverDate} handleDayClick={nav.handleDayClick}
            availabilityDays={availabilityDays} availabilityLoading={availabilityLoading}
            defaultCurrency={defaultCurrency} defaultLanguage={defaultLanguage}
            handleSearch={nav.handleSearch}
            logoUrl={logoUrl} minBookableDate={minBookableDate}
          />
        );
      case 'results':
        return (
          <BookingResultsPage
            tk={tk} i18n={i18n} btnSx={btnSx}
            filteredProperties={nav.filteredProperties} cart={nav.cart} setCart={nav.setCart} setPage={nav.setPage}
            checkIn={nav.checkIn} checkOut={nav.checkOut} nights={nav.nights}
            adults={nav.adults} children={nav.children}
            defaultCurrency={defaultCurrency} showCleaningFee={showCleaningFee} reviewStats={reviewStats}
          />
        );
      case 'cart':
        return (
          <BookingCartPage
            tk={tk} i18n={i18n} btnSx={btnSx}
            cart={nav.cart} setCart={nav.setCart} setPage={nav.setPage}
            adults={nav.adults} setAdults={nav.setAdults} children={nav.children} setChildren={nav.setChildren}
            nights={nav.nights} checkIn={nav.checkIn} checkOut={nav.checkOut}
            defaultCurrency={defaultCurrency} showCleaningFee={showCleaningFee} showTouristTax={showTouristTax}
            isAuthenticated={guestAuth.isAuthenticated}
            serviceCategories={serviceCategories}
            selectedOptions={selectedOptions}
            onOptionChange={setSelectedOptions}
          />
        );
      case 'identification':
        return (
          <BookingAuthPage
            tk={tk} i18n={i18n} btnSx={btnSx}
            authTab={nav.authTab} setAuthTab={nav.setAuthTab} setPage={nav.setPage}
            onAuthenticate={async (data) => {
              const success = nav.authTab === 'login'
                ? await guestAuth.login({ email: data.email, password: data.password })
                : await guestAuth.register({
                    email: data.email, password: data.password,
                    firstName: data.firstName || '', lastName: data.lastName || '',
                    phone: data.phone || '',
                  });
              if (success) nav.setPage('validation');
            }}
            isLoading={guestAuth.isLoading}
            error={guestAuth.error}
          />
        );
      case 'validation':
        return (
          <BookingValidationPage
            tk={tk} i18n={i18n} btnSx={btnSx}
            cart={nav.cart} nights={nav.nights} setPage={nav.setPage}
            adults={nav.adults} children={nav.children}
            checkIn={nav.checkIn} checkOut={nav.checkOut}
            defaultCurrency={defaultCurrency} showCleaningFee={showCleaningFee} showTouristTax={showTouristTax}
            cancellationPolicy={cancellationPolicy} termsUrl={termsUrl} privacyUrl={privacyUrl}
            onCreateCheckoutSession={async () => {
              // Call backend to create Stripe Checkout session
              try {
                const { bookingEngineApi } = await import('../../services/api/bookingEngineApi');
                const firstItem = nav.cart[0];
                if (!firstItem) return null;
                const subtotal = nav.cart.reduce((s, item) => s + (item.property.nightlyPrice || 0) * item.nights, 0);
                const cleaningFee = showCleaningFee ? nav.cart.reduce((s, item) => s + (item.property.cleaningFee || 0), 0) : 0;
                // Tourist tax sera calculee cote serveur lors de la creation de la session
                const totalAmount = subtotal + cleaningFee;
                const response = await bookingEngineApi.createCheckoutSession({
                  propertyId: firstItem.property.id,
                  amount: totalAmount,
                  checkIn: nav.checkIn || '',
                  checkOut: nav.checkOut || '',
                  guests: nav.adults + nav.children,
                  customerEmail: guestAuth.session?.profile?.email,
                });
                return response.clientSecret;
              } catch {
                return null;
              }
            }}
          />
        );
      case 'confirmation':
        return (
          <BookingConfirmationPage
            tk={tk} i18n={i18n} btnSx={btnSx}
            cart={nav.cart} nights={nav.nights} adults={nav.adults}
            checkIn={nav.checkIn} checkOut={nav.checkOut}
            defaultCurrency={defaultCurrency} showCleaningFee={showCleaningFee} showTouristTax={showTouristTax}
            autoConfirm={autoConfirm} resetBooking={nav.resetBooking} setPage={nav.setPage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box ref={nav.containerRef} sx={{
      fontFamily: tk.font, color: tk.text, bgcolor: nav.page === 'search' ? 'transparent' : tk.surface,
      display: 'flex', flexDirection: 'column', minHeight: 80,
      direction: isRTL ? 'rtl' : 'ltr', position: 'relative',
      ...(nav.page !== 'search' ? { flex: 1 } : {}),
    }}>
      {customCss && <style>{customCss}</style>}
      {renderPage()}
    </Box>
  );
};

export default BookingEnginePreview;
