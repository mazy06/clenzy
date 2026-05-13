import React, { useState } from 'react';
import { Box, Typography, IconButton, Divider } from '@mui/material';
import { ArrowBack, Delete, Remove, Add, ChevronRight, PhotoLibrary } from '../../../icons';
import type { ResolvedTokens, PreviewProperty, PreviewPage, CartItem } from '../types/bookingEngine';
import { fmt, fmtDate } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import type { BookingServiceCategory, SelectedServiceOption } from '../../../services/api/bookingServiceOptionsApi';
import BookingStepIndicator from './BookingStepIndicator';
import PropertyDetailPanel from './PropertyDetailPanel';
import BookingServiceOptionsSection, { computeOptionsTotal } from './BookingServiceOptionsSection';
import iconAdultsUrl from '../assets/default/icon-adults.svg';
import iconChildrenUrl from '../assets/default/icon-children.svg';
import iconBabyUrl from '../assets/default/icon-baby.svg';

interface BookingCartPageProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setPage: (page: PreviewPage) => void;
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
  nights: number;
  checkIn: string | null;
  checkOut: string | null;
  defaultCurrency: string;
  showCleaningFee: boolean;
  showTouristTax: boolean;
  isAuthenticated: boolean;
  serviceCategories?: BookingServiceCategory[];
  selectedOptions?: SelectedServiceOption[];
  onOptionChange?: (options: SelectedServiceOption[]) => void;
}

const BookingCartPage: React.FC<BookingCartPageProps> = ({
  tk, i18n, btnSx, cart, setCart, setPage,
  adults, setAdults, children, setChildren, nights,
  checkIn, checkOut, defaultCurrency,
  showCleaningFee, showTouristTax, isAuthenticated,
  serviceCategories = [], selectedOptions = [], onOptionChange,
}) => {
  const [detailProperty, setDetailProperty] = useState<PreviewProperty | null>(null);
  const subtotal = cart.reduce((sum, item) => sum + (item.property.nightlyPrice || 0) * item.nights, 0);
  const cleaningTotal = showCleaningFee ? cart.reduce((sum, item) => sum + (item.property.cleaningFee || 0), 0) : 0;
  // Taxe de sejour : pas de calcul frontend, sera fournie par l'API availability du serveur
  const touristTaxTotal = 0; // TODO: integrer avec bookingEngineApi.checkPropertyAvailability() pour obtenir le montant reel
  const optionsTotal = computeOptionsTotal(serviceCategories, selectedOptions, adults, children, nights);
  const total = subtotal + cleaningTotal + touristTaxTotal + optionsTotal;
  const currentStep = 0;

  const cardSx = {
    bgcolor: tk.surface, borderRadius: tk.cardRadius, border: `1px solid ${tk.border}`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {/* Header + clear cart */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, maxWidth: 1100, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setPage('results')} sx={{ color: tk.textLabel, mr: 1 }}>
            <ArrowBack size={18} strokeWidth={1.75} />
          </IconButton>
          <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 18, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {i18n.t('cart.title')}
          </Typography>
        </Box>
        {cart.length > 0 && (
          <Box onClick={() => setCart([])} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 2, py: 0.75,
            border: `1px solid ${tk.border}`, borderRadius: tk.radiusSm, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, color: tk.text, textTransform: 'uppercase',
            '&:hover': { borderColor: tk.primary, color: tk.primary },
          }}>
            <Delete size={14} strokeWidth={1.75} /> {i18n.t('cart.clearCart')}
          </Box>
        )}
      </Box>

      {/* Step indicator */}
      <BookingStepIndicator tk={tk} i18n={i18n} activeStep={currentStep} setPage={setPage} />

      {cart.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
          <Typography sx={{ fontSize: 14, color: tk.textLabel, mb: 2 }}>{i18n.t('cart.empty')}</Typography>
          <Box onClick={() => setPage('results')} sx={{ ...btnSx, display: 'inline-flex', px: 3, py: 1, borderRadius: tk.radiusSm, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: tk.btnTransform }}>
            {i18n.t('cart.backHome')}
          </Box>
        </Box>
      ) : (
        <Box sx={{
          display: 'flex', gap: 3, px: 3, pb: 3, maxWidth: 1100, mx: 'auto', width: '100%', boxSizing: 'border-box',
          flexDirection: 'column', '@media (min-width: 700px)': { flexDirection: 'row' },
          alignItems: 'flex-start',
        }}>
          {/* Left column: cart details */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {cart.map((item, idx) => (
              <CartPropertyCard key={idx} item={item} idx={idx} tk={tk} i18n={i18n}
                setCart={setCart} checkIn={checkIn} checkOut={checkOut} defaultCurrency={defaultCurrency}
                onInfoClick={() => setDetailProperty(item.property)} />
            ))}

            <SectionAccordion title={i18n.t('cart.participants')} defaultOpen tk={tk}>
              <ParticipantsSection tk={tk} i18n={i18n} adults={adults} setAdults={setAdults} children={children} setChildren={setChildren} />
            </SectionAccordion>

            {showTouristTax && touristTaxTotal > 0 && (
              <SectionAccordion title={i18n.t('validation.touristTax')} defaultOpen tk={tk}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: tk.text }}>{i18n.t('validation.touristTax')}</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 300, color: tk.primary }}>
                    {fmt(touristTaxTotal, defaultCurrency)}
                  </Typography>
                </Box>
              </SectionAccordion>
            )}

            {showCleaningFee && cleaningTotal > 0 && (
              <SectionAccordion title={i18n.t('validation.cleaningFee')} defaultOpen tk={tk}>
                {cart.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: tk.text }}>{item.property.name}</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 300, color: tk.primary }}>
                      {fmt(item.property.cleaningFee || 0, defaultCurrency)}
                    </Typography>
                  </Box>
                ))}
              </SectionAccordion>
            )}

            {/* Service options */}
            {serviceCategories.length > 0 && onOptionChange && (
              <BookingServiceOptionsSection
                tk={tk} i18n={i18n}
                categories={serviceCategories}
                selectedOptions={selectedOptions}
                onOptionChange={onOptionChange}
                adults={adults} children={children} nights={nights}
                defaultCurrency={defaultCurrency}
              />
            )}

            {/* Promo code */}
            <Box sx={{ mt: 3, p: 2.5, bgcolor: `${tk.primary}05`, borderRadius: tk.radius }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: tk.text, whiteSpace: 'nowrap' }}>
                  {i18n.t('cart.promoCode')}
                </Typography>
                <Box component="input" placeholder="" sx={{
                  flex: 1, p: '10px 12px', borderRadius: tk.radius, border: `1px solid ${tk.border}`,
                  fontSize: 13, fontFamily: tk.font, color: tk.text, bgcolor: tk.surface, outline: 'none',
                }} />
              </Box>
            </Box>
          </Box>

          {/* Right sidebar: recap */}
          <Box sx={{ width: '100%', '@media (min-width: 700px)': { width: 320, flexShrink: 0 } }}>
            <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 14, color: tk.primary, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {i18n.t('cart.yourStays')}
            </Typography>
            {cart.map((item, idx) => (
              <Box key={idx} sx={{ ...cardSx, p: 2.5, mb: 2, boxShadow: tk.cardShadow, border: `1px solid ${tk.primary}40` }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: tk.text, mb: 0.5 }}>
                  {(i18n.tObject('propertyTypes')[item.property.type] || item.property.type)} {item.property.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: tk.text, mb: 0.25 }}>
                  {adults} {i18n.t('guests.adult')}, {children} {i18n.t('guests.child')}, 0 {i18n.t('guests.baby')}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography component="span" sx={{ fontSize: 12, color: tk.primary, fontWeight: 600 }}>
                      {item.nights} {i18n.t('cart.nights')}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: 12, color: tk.text }}>
                      , {i18n.t('validation.from').charAt(0).toUpperCase() + i18n.t('validation.from').slice(1)}{' '}
                      {checkIn && fmtDate(checkIn)}{' '}
                      {i18n.t('validation.to')}{' '}
                      {checkOut && fmtDate(checkOut)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 300, color: tk.primary, whiteSpace: 'nowrap', ml: 2 }}>
                    {fmt((item.property.nightlyPrice || 0) * item.nights, defaultCurrency)}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* Total TTC block */}
            <Box sx={{ bgcolor: tk.secondary, borderRadius: tk.radius, p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                {i18n.t('cart.totalTTC')}
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 300, color: tk.primary, mb: 2, letterSpacing: -0.5 }}>
                {fmt(total, defaultCurrency)}
              </Typography>
              <Box onClick={() => setPage(isAuthenticated ? 'validation' : 'identification')} sx={{
                bgcolor: `${tk.primary}30`, color: tk.primary, py: 1.25, borderRadius: tk.radiusSm,
                cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.5,
                '&:hover': { bgcolor: `${tk.primary}50` },
              }}>
                {i18n.t('cart.continue')}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {detailProperty && (
        <PropertyDetailPanel
          property={detailProperty} tk={tk} i18n={i18n}
          onClose={() => setDetailProperty(null)}
        />
      )}
    </Box>
  );
};

// ─── CartPropertyCard ───────────────────────────────────────────────────────

interface CartPropertyCardProps {
  item: CartItem;
  idx: number;
  tk: ResolvedTokens;
  i18n: BookingI18n;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  checkIn: string | null;
  checkOut: string | null;
  defaultCurrency: string;
  onInfoClick?: () => void;
}

const CartPropertyCard: React.FC<CartPropertyCardProps> = ({
  item, idx, tk, i18n, setCart, checkIn, checkOut, defaultCurrency, onInfoClick,
}) => (
  <Box sx={{
    display: 'flex', border: `2px solid ${tk.primary}`, borderRadius: tk.radius,
    overflow: 'hidden', bgcolor: tk.surface, mb: 2.5,
    flexDirection: 'column', '@media (min-width: 500px)': { flexDirection: 'row' },
  }}>
    <Box sx={{
      width: '100%', minHeight: 160,
      '@media (min-width: 500px)': { width: '40%', minHeight: 180 },
      bgcolor: tk.secondary, position: 'relative', flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {(item.property.photoUrls ?? []).length > 0 ? (
        <Box component="img" src={item.property.photoUrls![0]} alt={item.property.name} sx={{
          width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0,
        }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.3)' }}><PhotoLibrary size={32} strokeWidth={1.75} /></Box>
      )}
    </Box>
    <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography sx={{ fontSize: 11, color: tk.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {i18n.tObject('propertyTypes')[item.property.type] || item.property.type}
        </Typography>
        <Box onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5,
          border: `1px solid ${tk.border}`, borderRadius: tk.radiusSm, cursor: 'pointer',
          fontSize: 10, fontWeight: 700, color: tk.text, textTransform: 'uppercase',
          '&:hover': { borderColor: '#d32f2f', color: '#d32f2f' },
        }}>
          <Delete size={12} strokeWidth={1.75} /> {i18n.t('cart.remove')}
        </Box>
      </Box>
      <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 20, color: tk.text, mb: 0.75, lineHeight: 1.2 }}>
        {item.property.name}
      </Typography>
      <Typography sx={{ fontSize: 12, color: tk.textLabel, mb: 1 }}>
        {i18n.t('validation.from').charAt(0).toUpperCase() + i18n.t('validation.from').slice(1)}{' '}
        {checkIn && fmtDate(checkIn)}{' '}
        {i18n.t('validation.to')}{' '}
        {checkOut && fmtDate(checkOut)}
      </Typography>
      <Typography sx={{ fontSize: 12, color: tk.primary, fontWeight: 600, mb: 1.5 }}>
        {item.nights} {i18n.t('cart.nights')}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box onClick={(e) => { e.stopPropagation(); onInfoClick?.(); }} sx={{
          display: 'inline-flex', px: 1.5, py: 0.5, border: `1px solid ${tk.border}`,
          borderRadius: tk.radiusSm, cursor: 'pointer', fontSize: 10, fontWeight: 700,
          color: tk.text, textTransform: 'uppercase',
          '&:hover': { borderColor: tk.primary, color: tk.primary },
        }}>
          {i18n.t('results.moreInfo')}
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 300, color: tk.primary }}>
          {fmt((item.property.nightlyPrice || 0) * item.nights, defaultCurrency)}
        </Typography>
      </Box>
    </Box>
  </Box>
);

// ─── SectionAccordion ───────────────────────────────────────────────────────

const SectionAccordion: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tk: ResolvedTokens;
}> = ({ title, children, defaultOpen = false, tk }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ borderBottom: `1px solid ${tk.border}` }}>
      <Box onClick={() => setOpen(!open)} sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        py: 2, cursor: 'pointer',
      }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {title}
        </Typography>
        <Box component="span" sx={{ display: 'inline-flex', color: tk.textLabel, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><ChevronRight size={18} strokeWidth={1.75} /></Box>
      </Box>
      {open && <Box sx={{ pb: 2 }}>{children}</Box>}
    </Box>
  );
};

// ─── ParticipantsSection ────────────────────────────────────────────────────

const ParticipantsSection: React.FC<{
  tk: ResolvedTokens;
  i18n: BookingI18n;
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
}> = ({ tk, i18n, adults, setAdults, children, setChildren }) => {
  const guests = [
    { label: i18n.t('guests.adults'), sub: i18n.t('guests.adultsAge'), val: adults, set: setAdults, min: 1, icon: iconAdultsUrl },
    { label: i18n.t('guests.children'), sub: i18n.t('guests.childrenAge'), val: children, set: setChildren, min: 0, icon: iconChildrenUrl },
    { label: i18n.t('guests.babies'), sub: i18n.t('guests.babiesAge'), val: 0, set: () => {}, min: 0, icon: iconBabyUrl },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {guests.map(g => (
        <Box key={g.label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: `${tk.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Box sx={{ width: 24, height: 24, bgcolor: tk.primary, WebkitMaskImage: `url(${g.icon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${g.icon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tk.text }}>{g.label}</Typography>
            <Typography sx={{ fontSize: 11, color: tk.textLabel }}>({g.sub})</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => g.set(Math.max(g.min, g.val - 1))} sx={{ border: `1px solid ${tk.border}`, width: 28, height: 28 }}>
              <Remove size={14} strokeWidth={1.75} />
            </IconButton>
            <Typography sx={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{g.val}</Typography>
            <IconButton size="small" onClick={() => g.set(g.val + 1)} sx={{ border: `1px solid ${tk.border}`, width: 28, height: 28 }}>
              <Add size={14} strokeWidth={1.75} />
            </IconButton>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default BookingCartPage;
