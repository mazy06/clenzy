import React, { useMemo } from 'react';
import { Box, Typography, Paper, Button, Chip } from '@mui/material';
import {
  Search, CalendarMonth, CreditCard, Star, Map, Phone,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import type { ComponentVisibility } from './ComponentVisibilityConfig';
import { DEFAULT_COMPONENT_VISIBILITY } from './ComponentVisibilityConfig';
import type { DesignTokens } from '../../services/api/bookingEngineApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingEnginePreviewProps {
  primaryColor: string;
  accentColor: string | null;
  fontFamily: string | null;
  logoUrl: string | null;
  customCss: string | null;
  componentConfig: ComponentVisibility;
  designTokens?: DesignTokens;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BookingEnginePreview: React.FC<BookingEnginePreviewProps> = React.memo(
  ({ primaryColor, accentColor, fontFamily, logoUrl, customCss, componentConfig, designTokens }) => {
    const { t } = useTranslation();
    const vis = componentConfig || DEFAULT_COMPONENT_VISIBILITY;
    const font = fontFamily || designTokens?.bodyFontFamily || 'inherit';
    const accent = accentColor || primaryColor;

    // Build CSS custom properties from design tokens
    const tokenCssVars = useMemo(() => {
      if (!designTokens) return {};
      const vars: Record<string, string> = {};
      if (designTokens.primaryColor) vars['--bw-primary'] = designTokens.primaryColor;
      if (designTokens.secondaryColor) vars['--bw-secondary'] = designTokens.secondaryColor;
      if (designTokens.accentColor) vars['--bw-accent'] = designTokens.accentColor;
      if (designTokens.backgroundColor) vars['--bw-bg'] = designTokens.backgroundColor;
      if (designTokens.surfaceColor) vars['--bw-surface'] = designTokens.surfaceColor;
      if (designTokens.textColor) vars['--bw-text'] = designTokens.textColor;
      if (designTokens.textSecondaryColor) vars['--bw-text-secondary'] = designTokens.textSecondaryColor;
      if (designTokens.borderRadius) vars['--bw-radius'] = designTokens.borderRadius;
      if (designTokens.cardBorderRadius) vars['--bw-card-radius'] = designTokens.cardBorderRadius;
      if (designTokens.buttonBorderRadius) vars['--bw-btn-radius'] = designTokens.buttonBorderRadius;
      if (designTokens.spacing) vars['--bw-spacing'] = designTokens.spacing;
      if (designTokens.boxShadow) vars['--bw-shadow'] = designTokens.boxShadow;
      if (designTokens.cardShadow) vars['--bw-card-shadow'] = designTokens.cardShadow;
      if (designTokens.borderColor) vars['--bw-border'] = designTokens.borderColor;
      if (designTokens.headingFontFamily) vars['--bw-heading-font'] = designTokens.headingFontFamily;
      if (designTokens.bodyFontFamily) vars['--bw-body-font'] = designTokens.bodyFontFamily;
      if (designTokens.baseFontSize) vars['--bw-font-size'] = designTokens.baseFontSize;
      return vars;
    }, [designTokens]);

    // Derived styles from tokens
    const bgColor = designTokens?.backgroundColor || '#fafafa';
    const surfaceColor = designTokens?.surfaceColor || '#fff';
    const borderColor = designTokens?.borderColor || undefined;
    const cardRadius = designTokens?.cardBorderRadius || undefined;
    const cardShadow = designTokens?.cardShadow || undefined;
    const btnRadius = designTokens?.buttonBorderRadius || undefined;
    const textTransform = designTokens?.buttonTextTransform as React.CSSProperties['textTransform'] || 'none';

    return (
      <Box sx={{ position: 'relative' }}>
        {/* Inject custom CSS */}
        {customCss && <style>{customCss}</style>}

        <Paper
          className="booking-widget"
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: cardRadius || 2,
            fontFamily: font,
            maxHeight: 420,
            overflow: 'auto',
            bgcolor: bgColor,
            ...(Object.keys(tokenCssVars).length > 0 ? { style: tokenCssVars } : {}),
          }}
          style={Object.keys(tokenCssVars).length > 0 ? tokenCssVars : undefined}
        >
          {/* Header with logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            {logoUrl ? (
              <Box
                component="img"
                src={logoUrl}
                alt="Logo"
                sx={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>B</Typography>
              </Box>
            )}
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', fontFamily: font }}>
              {t('bookingEngine.preview.title')}
            </Typography>
          </Box>

          {/* Search bar */}
          {vis.searchBar && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                p: 1.5,
                mb: 1.5,
                borderRadius: 1.5,
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {t('bookingEngine.preview.searchPlaceholder')}
              </Typography>
            </Box>
          )}

          {/* Property list (mock cards) */}
          {vis.propertyList && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              {['Studio Montmartre', 'Appart. Marais'].map((name) => (
                <Box
                  key={name}
                  sx={{
                    flex: 1,
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: '#fff',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  {vis.propertyGallery && (
                    <Box
                      sx={{
                        height: 48,
                        borderRadius: cardRadius || 1,
                        bgcolor: 'grey.100',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled' }}>📷</Typography>
                    </Box>
                  )}
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: font }}>
                    {name}
                  </Typography>
                  <Typography className="price" sx={{ fontSize: '0.6875rem', color: primaryColor, fontWeight: 600 }}>
                    90€ / {t('bookingEngine.preview.night')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Availability calendar */}
          {vis.availabilityCalendar && (
            <Box
              sx={{
                p: 1.5,
                mb: 1.5,
                borderRadius: 1.5,
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <CalendarMonth sx={{ fontSize: 14, color: primaryColor }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                  {t('bookingEngine.preview.calendar')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      textAlign: 'center',
                      py: 0.5,
                      borderRadius: 0.5,
                      bgcolor: i >= 2 && i <= 4 ? `${primaryColor}20` : 'transparent',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: i >= 2 && i <= 4 ? primaryColor : 'text.secondary',
                    }}
                  >
                    {d}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Price breakdown */}
          {vis.priceBreakdown && (
            <Box
              sx={{
                p: 1.5,
                mb: 1.5,
                borderRadius: 1.5,
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, mb: 0.5 }}>
                {t('bookingEngine.preview.priceBreakdown')}
              </Typography>
              {[
                { label: '3 × 90€', value: '270€' },
                { label: t('bookingEngine.preview.cleaning'), value: '45€' },
                { label: t('bookingEngine.preview.touristTax'), value: '3.30€' },
              ].map((row) => (
                <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>{row.label}</Typography>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 600 }}>{row.value}</Typography>
                </Box>
              ))}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  pt: 0.5,
                  mt: 0.5,
                  borderTop: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: primaryColor }}>318.30€</Typography>
              </Box>
            </Box>
          )}

          {/* Reviews */}
          {vis.reviewsSection && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Star sx={{ fontSize: 14, color: '#FFC107' }} />
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600 }}>4.8</Typography>
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>(127 avis)</Typography>
            </Box>
          )}

          {/* Map */}
          {vis.mapSection && (
            <Box
              sx={{
                p: 1,
                mb: 1.5,
                borderRadius: 1,
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Map sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                {t('bookingEngine.preview.map')}
              </Typography>
            </Box>
          )}

          {/* Payment */}
          {vis.paymentSection && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <CreditCard sx={{ fontSize: 14, color: accent }} />
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                {t('bookingEngine.preview.payment')}
              </Typography>
            </Box>
          )}

          {/* Cancellation policy */}
          {vis.cancellationPolicy && (
            <Chip
              label={t('bookingEngine.preview.cancellationPolicy')}
              size="small"
              sx={{ fontSize: '0.625rem', height: 20, mb: 1 }}
            />
          )}

          {/* Contact */}
          {vis.contactSection && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                {t('bookingEngine.preview.contact')}
              </Typography>
            </Box>
          )}

          {/* Book button */}
          {vis.guestForm && (
            <Button
              fullWidth
              variant="contained"
              size="small"
              sx={{
                bgcolor: designTokens?.primaryColor || primaryColor,
                textTransform,
                fontWeight: 600,
                fontSize: '0.8125rem',
                fontFamily: font,
                borderRadius: btnRadius || 1.5,
                boxShadow: cardShadow || undefined,
                '&:hover': { bgcolor: designTokens?.primaryColor || primaryColor, filter: 'brightness(0.9)' },
              }}
            >
              {t('bookingEngine.preview.bookNow')}
            </Button>
          )}
        </Paper>
      </Box>
    );
  }
);

BookingEnginePreview.displayName = 'BookingEnginePreview';

export default BookingEnginePreview;
