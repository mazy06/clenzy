import React, { useState } from 'react';
import { Box, Typography, IconButton, Divider, Checkbox, CircularProgress } from '@mui/material';
import { ArrowBack, CheckCircle, Close } from '../../../icons';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import type { ResolvedTokens, PreviewPage, CartItem } from '../types/bookingEngine';
import { fmt, fmtDate } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import BookingStepIndicator from './BookingStepIndicator';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

// ─── Validation Page (Step 3) ────────────────────────────────────────────────

interface BookingValidationPageProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  cart: CartItem[];
  nights: number;
  adults: number;
  children: number;
  checkIn: string | null;
  checkOut: string | null;
  setPage: (page: PreviewPage) => void;
  defaultCurrency: string;
  showCleaningFee: boolean;
  showTouristTax: boolean;
  cancellationPolicy?: string | null;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  /** Creates a Stripe Checkout session and returns the clientSecret */
  onCreateCheckoutSession?: () => Promise<string | null>;
}

export const BookingValidationPage: React.FC<BookingValidationPageProps> = ({
  tk, i18n, btnSx, cart, nights, adults, children: childCount,
  checkIn, checkOut, setPage,
  defaultCurrency, showCleaningFee, showTouristTax,
  cancellationPolicy, termsUrl, privacyUrl, onCreateCheckoutSession,
}) => {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [guestMessage, setGuestMessage] = useState('');
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + (item.property.nightlyPrice || 0) * item.nights, 0);
  const cleaningTotal = showCleaningFee ? cart.reduce((sum, item) => sum + (item.property.cleaningFee || 0), 0) : 0;
  // Pas de calcul frontend — la taxe sera fournie par l'API availability du serveur
  const touristTax = 0;
  const total = subtotal + cleaningTotal + touristTax;

  const cardSx = {
    bgcolor: tk.surface, borderRadius: tk.cardRadius, border: `1px solid ${tk.border}`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2 }}>
        <IconButton size="small" onClick={() => setPage('identification')} sx={{ color: tk.textLabel, mr: 1 }}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 18, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {i18n.t('cart.title')}
        </Typography>
      </Box>

      <BookingStepIndicator tk={tk} i18n={i18n} activeStep={2} setPage={setPage} />

      {/* Two-column layout */}
      <Box sx={{ display: 'flex', gap: 3, px: 3, pb: 3, flexDirection: { xs: 'column', md: 'row' }, '@media (min-width: 700px)': { flexDirection: 'row' } }}>

        {/* Left column: Reservation recap */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {cart.map((item, idx) => (
            <Box key={idx} sx={{ ...cardSx, p: 3, mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: tk.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                {i18n.t('validation.hotelReservation')}
              </Typography>
              <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 22, color: tk.text, mb: 1, lineHeight: 1.2 }}>
                {(i18n.tObject('propertyTypes')[item.property.type] || item.property.type)} - {item.property.name}
              </Typography>
              <Typography sx={{ fontSize: 13, color: tk.textLabel, mb: 1 }}>
                {i18n.t('validation.from').charAt(0).toUpperCase() + i18n.t('validation.from').slice(1)} {checkIn && fmtDate(checkIn)} {i18n.t('validation.to')} {checkOut && fmtDate(checkOut)}
              </Typography>

              <Typography sx={{ fontSize: 28, fontWeight: 300, color: tk.primary, textAlign: 'right', mb: 2 }}>
                {fmt((item.property.nightlyPrice || 0) * item.nights, defaultCurrency)}
              </Typography>

              <Divider sx={{ borderColor: tk.border, my: 2 }} />

              {/* Tourist tax */}
              {showTouristTax && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                    <Box>
                      <Typography sx={{ fontSize: 13, color: tk.text }}>{adults} {i18n.t('validation.touristTax')}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 300, color: tk.primary }}>
                      {fmt(touristTax, defaultCurrency)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: tk.border, my: 2 }} />
                </>
              )}

              {/* Total */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 28, fontWeight: 300, color: tk.primary, mb: 0.5 }}>
                  {fmt(total, defaultCurrency)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: tk.textLabel }}>
                  {nights} {i18n.t('cart.nights')}
                </Typography>
              </Box>
            </Box>
          ))}

          {/* Promo code */}
          <Box sx={{ ...cardSx, p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tk.text, whiteSpace: 'nowrap' }}>
              {i18n.t('cart.promoCode')}
            </Typography>
            <Box component="input" sx={{
              flex: 1, p: '10px 14px', borderRadius: tk.radius,
              border: `1px solid ${tk.border}`, bgcolor: tk.surfaceMuted,
              fontSize: 13, fontFamily: tk.font, color: tk.text, outline: 'none',
              '&:focus': { borderColor: tk.primary },
            }} />
          </Box>

          {/* Total du panier TTC */}
          <Box sx={{ ...cardSx, p: 2.5, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 16, color: tk.text }}>
              {i18n.t('cart.totalTTC')}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 300, color: tk.primary }}>
              {fmt(total, defaultCurrency)}
            </Typography>
          </Box>
        </Box>

        {/* Right sidebar: Payment schedule */}
        <Box sx={{ width: '100%', '@media (min-width: 700px)': { width: 340, flexShrink: 0 } }}>
          <Box sx={{ bgcolor: tk.secondary, borderRadius: tk.cardRadius, p: 3, color: '#fff' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, mb: 2.5, color: 'rgba(255,255,255,0.9)' }}>
              {i18n.t('validation.paymentSchedule')}
            </Typography>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 2 }} />

            {/* Payment line */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                {i18n.t('validation.today')}
              </Typography>
              <Typography sx={{ fontSize: 13, color: tk.primary, fontWeight: 600 }}>
                {fmt(total, defaultCurrency)} ({i18n.t('validation.autoDebit')})
              </Typography>
            </Box>

            {/* Guest message textarea */}
            <Box
              component="textarea"
              value={guestMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGuestMessage(e.target.value)}
              placeholder={i18n.t('validation.messagePlaceholder')}
              rows={3}
              sx={{
                width: '100%', p: '10px 12px', borderRadius: tk.radius,
                border: '1px solid rgba(255,255,255,0.2)', bgcolor: 'rgba(255,255,255,0.08)',
                fontSize: 12, fontFamily: tk.font, color: 'rgba(255,255,255,0.7)',
                resize: 'vertical', outline: 'none', mb: 2.5, boxSizing: 'border-box',
                '&:focus': { borderColor: tk.primary },
              }}
            />

            {/* Cancellation policy */}
            {cancellationPolicy && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: tk.radius, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  {i18n.t('validation.cancellationPolicy')}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  {cancellationPolicy}
                </Typography>
              </Box>
            )}

            {/* Terms checkbox */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                size="small"
                sx={{ color: 'rgba(255,255,255,0.5)', p: 0, mt: 0.25, '&.Mui-checked': { color: tk.primary } }}
              />
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                {i18n.t('validation.acceptTerms')}{' '}
                {termsUrl ? (
                  <Box component="a" href={termsUrl} target="_blank" rel="noopener noreferrer" sx={{ color: tk.primary, textDecoration: 'underline' }}>
                    {i18n.t('validation.termsOfSale')}
                  </Box>
                ) : (
                  <Box component="span" sx={{ color: tk.primary }}>{i18n.t('validation.termsOfSale')}</Box>
                )}
                {', '}
                {termsUrl ? (
                  <Box component="a" href={termsUrl} target="_blank" rel="noopener noreferrer" sx={{ color: tk.primary, textDecoration: 'underline' }}>
                    {i18n.t('validation.termsOfUse')}
                  </Box>
                ) : (
                  <Box component="span" sx={{ color: tk.primary }}>{i18n.t('validation.termsOfUse')}</Box>
                )}
                {` ${i18n.t('common.and')} `}
                {privacyUrl ? (
                  <Box component="a" href={privacyUrl} target="_blank" rel="noopener noreferrer" sx={{ color: tk.primary, textDecoration: 'underline' }}>
                    {i18n.t('validation.privacyPolicy')}
                  </Box>
                ) : (
                  <Box component="span" sx={{ color: tk.primary }}>{i18n.t('validation.privacyPolicy')}</Box>
                )}
                .
              </Typography>
            </Box>

            {paymentError && (
              <Typography sx={{ fontSize: 12, color: '#ff6b6b', textAlign: 'center', mb: 1 }}>
                {paymentError}
              </Typography>
            )}

            {/* Pay button */}
            <Box
              onClick={acceptTerms && !isLoadingPayment ? async () => {
                if (onCreateCheckoutSession) {
                  setIsLoadingPayment(true);
                  setPaymentError(null);
                  try {
                    const clientSecret = await onCreateCheckoutSession();
                    if (clientSecret) {
                      setStripeClientSecret(clientSecret);
                      setShowStripeCheckout(true);
                    } else {
                      setPaymentError('Impossible de créer la session de paiement.');
                    }
                  } catch {
                    setPaymentError('Erreur lors de la création du paiement.');
                  } finally {
                    setIsLoadingPayment(false);
                  }
                } else {
                  // No Stripe configured — skip to confirmation (preview fallback)
                  setPage('confirmation');
                }
              } : undefined}
              sx={{
                bgcolor: acceptTerms ? `${tk.primary}30` : 'rgba(255,255,255,0.1)',
                color: acceptTerms ? tk.primary : 'rgba(255,255,255,0.3)',
                py: 1.5, borderRadius: tk.radiusSm,
                cursor: acceptTerms && !isLoadingPayment ? 'pointer' : 'not-allowed',
                textAlign: 'center', fontSize: 13, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.5,
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                ...(acceptTerms && !isLoadingPayment ? { '&:hover': { bgcolor: `${tk.primary}50` } } : {}),
              }}
            >
              {isLoadingPayment && <CircularProgress size={14} sx={{ color: 'inherit' }} />}
              {i18n.t('validation.payButton')}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Stripe Checkout Overlay ── */}
      {showStripeCheckout && stripeClientSecret && (
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box sx={{
            bgcolor: '#fff', borderRadius: '12px', width: '100%', maxWidth: 500,
            maxHeight: '90vh', overflow: 'auto', position: 'relative', m: 2,
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e5e7eb' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{i18n.t('validation.securePayment')}</Typography>
              <IconButton size="small" onClick={() => { setShowStripeCheckout(false); setStripeClientSecret(null); }}>
                <Close size={18} strokeWidth={1.75} />
              </IconButton>
            </Box>
            <Box sx={{ p: 2 }}>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret: stripeClientSecret,
                  onComplete: () => {
                    setShowStripeCheckout(false);
                    setStripeClientSecret(null);
                    setPage('confirmation');
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};


// ─── Confirmation Page ──────────────────────────────────────────────────────

interface BookingConfirmationPageProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  cart: CartItem[];
  nights: number;
  adults: number;
  checkIn: string | null;
  checkOut: string | null;
  defaultCurrency: string;
  showCleaningFee: boolean;
  showTouristTax: boolean;
  autoConfirm: boolean;
  resetBooking: () => void;
  setPage: (page: PreviewPage) => void;
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  tk, i18n, btnSx, cart, nights, adults,
  checkIn, checkOut,
  defaultCurrency, showCleaningFee, showTouristTax, autoConfirm, resetBooking, setPage,
}) => {
  // Stable mock reservation number — generated once, not on every render
  const [reservationNumber] = useState(() => {
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `BE-${new Date().getFullYear()}-${num}`;
  });

  const subtotal = cart.reduce((sum, item) => sum + (item.property.nightlyPrice || 0) * item.nights, 0);
  const cleaningTotal = showCleaningFee ? cart.reduce((sum, item) => sum + (item.property.cleaningFee || 0), 0) : 0;
  // Pas de calcul frontend — la taxe sera fournie par l'API availability du serveur
  const touristTax = 0;
  const total = subtotal + cleaningTotal + touristTax;

  const cardSx = {
    bgcolor: tk.surface, borderRadius: tk.cardRadius, border: `1px solid ${tk.border}`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      <BookingStepIndicator tk={tk} i18n={i18n} activeStep={3} setPage={setPage} />

      <Box sx={{ px: 3, pb: 3, maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mt: 2, mb: 3 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: tk.primary, mb: 1 }}><CheckCircle size={56} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 22, color: tk.text }}>
            {autoConfirm ? i18n.t('confirmation.confirmed') : i18n.t('confirmation.pending')}
          </Typography>
        </Box>

        <Box sx={{ ...cardSx, p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 13, color: tk.textLabel }}>{i18n.t('confirmation.reservationNumber')}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tk.text }}>
              {reservationNumber}
            </Typography>
          </Box>
          {cart.map((item, idx) => (
            <Box key={idx} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: tk.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>
                {i18n.tObject('propertyTypes')[item.property.type] || item.property.type}
              </Typography>
              <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 16, color: tk.text, mb: 0.5 }}>
                {item.property.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: tk.textLabel }}>
                {checkIn && fmtDate(checkIn)} → {checkOut && fmtDate(checkOut)} · {item.nights} {i18n.t('cart.nights')}
              </Typography>
            </Box>
          ))}
          <Divider sx={{ my: 1.5, borderColor: tk.border }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tk.text }}>{i18n.t('confirmation.totalPaid')}</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tk.primary }}>{fmt(total, defaultCurrency)}</Typography>
          </Box>
        </Box>

        <Box onClick={resetBooking} sx={{
          ...btnSx, py: 1.5, borderRadius: tk.radiusSm, cursor: 'pointer', textAlign: 'center',
          fontSize: 13, fontWeight: 700, textTransform: tk.btnTransform,
        }}>
          {i18n.t('confirmation.backHome')}
        </Box>
      </Box>
    </Box>
  );
};
