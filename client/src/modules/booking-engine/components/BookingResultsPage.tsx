import React, { useState } from 'react';
import { Box, Typography, IconButton, Divider } from '@mui/material';
import {
  ArrowBack, ChevronLeft, ChevronRight, Star, Hotel,
  PhotoLibrary, CheckCircle, Delete,
} from '../../../icons';
import type { ResolvedTokens, PreviewProperty, PreviewPage, CartItem } from '../types/bookingEngine';
import { fmt, fmtDate } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import PropertyDetailPanel from './PropertyDetailPanel';

interface BookingResultsPageProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  filteredProperties: PreviewProperty[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setPage: (page: PreviewPage) => void;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  adults: number;
  children: number;
  defaultCurrency: string;
  showCleaningFee: boolean;
  reviewStats?: Map<number, { avg: number; count: number }>;
}

const BookingResultsPage: React.FC<BookingResultsPageProps> = ({
  tk, i18n, btnSx, filteredProperties, cart, setCart, setPage,
  checkIn, checkOut, nights, adults, children,
  defaultCurrency, showCleaningFee, reviewStats,
}) => {
  const [detailProperty, setDetailProperty] = useState<PreviewProperty | null>(null);
  const subtotal = cart.reduce((sum, item) => sum + (item.property.nightlyPrice || 0) * item.nights, 0);
  const cleaningTotal = showCleaningFee ? cart.reduce((sum, item) => sum + (item.property.cleaningFee || 0), 0) : 0;

  const cardSx = {
    bgcolor: tk.surface, borderRadius: tk.cardRadius, border: `1px solid ${tk.border}`,
    overflow: 'hidden',
  };

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, maxWidth: 1100, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
        <IconButton size="small" onClick={() => setPage('search')} sx={{ color: tk.textLabel, mr: 1 }}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 18, color: tk.text, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {i18n.t('results.title')}
        </Typography>
        <Typography onClick={() => setPage('search')} sx={{ fontSize: 12, color: tk.primary, cursor: 'pointer', fontWeight: 600 }}>
          {i18n.t('results.modifySearch')}
        </Typography>
      </Box>

      {/* 2 columns layout */}
      <Box sx={{
        display: 'flex', gap: 3, px: 3, pb: 3, alignItems: 'flex-start',
        maxWidth: 1100, mx: 'auto', width: '100%', boxSizing: 'border-box',
        flexDirection: 'column',
        '@media (min-width: 700px)': { flexDirection: 'row' },
      }}>
        {/* Left: property list */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {filteredProperties.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {filteredProperties.map(prop => (
                <PropertyCard
                  key={prop.id} prop={prop} tk={tk} i18n={i18n} btnSx={btnSx}
                  cart={cart} setCart={setCart} nights={nights}
                  checkIn={checkIn} checkOut={checkOut} defaultCurrency={defaultCurrency}
                  reviewStats={reviewStats} onInfoClick={() => setDetailProperty(prop)}
                />
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: tk.border, mb: 1.5 }}><Hotel size={40} strokeWidth={1.75} /></Box>
              <Typography sx={{ fontSize: 13, color: tk.textLabel, textAlign: 'center' }}>
                {i18n.t('results.noResults')}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Right: recap sidebar */}
        <Box sx={{ width: { xs: '100%' }, '@media (min-width: 700px)': { width: 300, flexShrink: 0 } }}>
          <ResultsSidebar
            tk={tk} i18n={i18n} btnSx={btnSx} cardSx={cardSx}
            cart={cart} setCart={setCart} setPage={setPage}
            adults={adults} children={children} nights={nights}
            checkIn={checkIn} checkOut={checkOut} defaultCurrency={defaultCurrency}
            showCleaningFee={showCleaningFee} subtotal={subtotal} cleaningTotal={cleaningTotal}
          />
        </Box>
      </Box>

      {detailProperty && (
        <PropertyDetailPanel
          property={detailProperty} tk={tk} i18n={i18n}
          onClose={() => setDetailProperty(null)}
        />
      )}
    </Box>
  );
};

// ─── PropertyCard ───────────────────────────────────────────────────────────

interface PropertyCardProps {
  prop: PreviewProperty;
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  nights: number;
  checkIn: string | null;
  checkOut: string | null;
  defaultCurrency: string;
  reviewStats?: Map<number, { avg: number; count: number }>;
  onInfoClick?: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  prop, tk, i18n, btnSx, cart, setCart, nights,
  checkIn, checkOut, defaultCurrency, reviewStats, onInfoClick,
}) => {
  const stats = reviewStats?.get(prop.id);
  const inCart = cart.some(c => c.property.id === prop.id);
  const photoUrls = prop.photoUrls ?? [];
  const hasMultiple = photoUrls.length > 1;
  const [photoIdx, setPhotoIdx] = useState(0);

  return (
    <Box sx={{
      display: 'flex', border: `2px solid ${inCart ? tk.primary : tk.border}`,
      borderRadius: tk.radius, overflow: 'hidden', bgcolor: tk.surface,
      transition: 'border-color 0.2s',
      flexDirection: 'column',
      '@media (min-width: 550px)': { flexDirection: 'row' },
    }}>
      {/* Photo area */}
      <Box sx={{
        width: '100%', minHeight: 200,
        '@media (min-width: 550px)': { width: '50%', minHeight: 220 },
        bgcolor: tk.secondary, position: 'relative', flexShrink: 0, overflow: 'hidden',
      }}>
        {photoUrls.length > 0 ? (
          <Box component="img" src={photoUrls[photoIdx]} alt={prop.name} sx={{
            width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0,
          }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.3)' }}><PhotoLibrary size={32} strokeWidth={1.75} /></Box>
          </Box>
        )}
        {hasMultiple && (
          <>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => i <= 0 ? photoUrls.length - 1 : i - 1); }} sx={{
              position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
              bgcolor: 'rgba(255,255,255,0.85)', width: 28, height: 28, '&:hover': { bgcolor: '#fff' },
            }}>
              <ChevronLeft size={18} strokeWidth={1.75} />
            </IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => i >= photoUrls.length - 1 ? 0 : i + 1); }} sx={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              bgcolor: 'rgba(255,255,255,0.85)', width: 28, height: 28, '&:hover': { bgcolor: '#fff' },
            }}>
              <ChevronRight size={18} strokeWidth={1.75} />
            </IconButton>
            <Box sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.5 }}>
              {photoUrls.map((_, i) => (
                <Box key={i} sx={{
                  width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                  bgcolor: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.8)',
                }} onClick={(e) => { e.stopPropagation(); setPhotoIdx(i); }} />
              ))}
            </Box>
          </>
        )}
        {stats && (
          <Box sx={{
            position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center',
            gap: 0.5, bgcolor: 'rgba(255,255,255,0.9)', borderRadius: '12px', px: 1, py: 0.25,
          }}>
            <Star size={12} strokeWidth={1.75} color='#F5A623' />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{stats.avg.toFixed(1)}</Typography>
            <Typography sx={{ fontSize: 10, color: tk.textLabel }}>({stats.count})</Typography>
          </Box>
        )}
      </Box>

      {/* Info area */}
      <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, position: 'relative' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography sx={{ fontSize: 12, color: tk.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {i18n.tObject('propertyTypes')[prop.type] || prop.type}
          </Typography>
          <Box onClick={() => {
            if (inCart) {
              setCart(prev => prev.filter(c => c.property.id !== prop.id));
            } else {
              setCart(prev => [...prev, { property: prop, nights }]);
            }
          }} sx={{
            ...btnSx, px: 2, py: 0.75, borderRadius: tk.radiusSm, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, textTransform: tk.btnTransform, display: 'inline-flex',
            alignItems: 'center', gap: 0.5, flexShrink: 0,
          }}>
            {inCart && <CheckCircle size={14} strokeWidth={1.75} />}
            {inCart ? i18n.t('results.selected') : i18n.t('results.select')}
          </Box>
        </Box>

        <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 22, color: tk.text, lineHeight: 1.15, mb: 1 }}>
          {prop.name}
        </Typography>

        {checkIn && checkOut && (
          <Typography sx={{ fontSize: 13, color: tk.text, mb: 2, opacity: 0.7 }}>
            {i18n.t('validation.from').charAt(0).toUpperCase() + i18n.t('validation.from').slice(1)}{' '}
            {fmtDate(checkIn)}{' '}
            {i18n.t('validation.to')}{' '}
            {fmtDate(checkOut)}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box onClick={(e) => { e.stopPropagation(); onInfoClick?.(); }} sx={{
            display: 'inline-flex', px: 2, py: 0.75, border: `1px solid ${tk.border}`,
            borderRadius: tk.radiusSm, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            color: tk.text, textTransform: 'uppercase', letterSpacing: 0.3,
            '&:hover': { borderColor: tk.primary, color: tk.primary },
          }}>
            {i18n.t('results.moreInfo')}
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 300, color: tk.primary, letterSpacing: -0.5 }}>
            {prop.nightlyPrice ? fmt(prop.nightlyPrice * nights, defaultCurrency) : '\u2014'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── ResultsSidebar ─────────────────────────────────────────────────────────

interface ResultsSidebarProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  cardSx: Record<string, unknown>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setPage: (page: PreviewPage) => void;
  adults: number;
  children: number;
  nights: number;
  checkIn: string | null;
  checkOut: string | null;
  defaultCurrency: string;
  showCleaningFee: boolean;
  subtotal: number;
  cleaningTotal: number;
}

const ResultsSidebar: React.FC<ResultsSidebarProps> = ({
  tk, i18n, btnSx, cardSx, cart, setCart, setPage,
  adults, children, nights, checkIn, checkOut,
  defaultCurrency, showCleaningFee, cleaningTotal,
}) => (
  <Box sx={{ position: 'sticky', top: 16, ...cardSx, p: 3, boxShadow: tk.cardShadow, border: `1px solid ${tk.primary}40` }}>
    <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 15, color: tk.primary, mb: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {i18n.t('validation.recap')}
    </Typography>
    <Typography sx={{ fontSize: 13, color: tk.text, mb: 0.5 }}>
      {adults} {i18n.t('guests.adult')}, {children} {i18n.t('guests.child')}, 0 {i18n.t('guests.baby')}
    </Typography>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
      <Box>
        <Typography component="span" sx={{ fontSize: 12, color: tk.primary, fontWeight: 600 }}>
          {nights} {i18n.t('cart.nights')}
        </Typography>
        <Typography component="span" sx={{ fontSize: 12, color: tk.text }}>
          , {i18n.t('validation.from')} {checkIn && fmtDate(checkIn)} {i18n.t('validation.to')} {checkOut && fmtDate(checkOut)}
        </Typography>
      </Box>
    </Box>

    <Divider sx={{ borderColor: tk.border, mb: 3 }} />

    {cart.length === 0 ? (
      <Box sx={{ p: 2.5, borderRadius: tk.radius, bgcolor: `${tk.primary}10`, mb: 3 }}>
        <Typography sx={{ fontSize: 12, color: tk.text, textAlign: 'center', lineHeight: 1.6 }}>
          {i18n.t('results.selectPrompt')}
        </Typography>
      </Box>
    ) : (
      <>
        <Typography sx={{ fontSize: 13, color: tk.textLabel, mb: 2.5 }}>
          {i18n.t('results.selectedCount').replace('{count}', String(cart.length))}
        </Typography>

        {cart.map((item, idx) => (
          <Box key={idx} sx={{ mb: 2.5, position: 'relative' }}>
            <Typography sx={{ fontSize: 11, color: tk.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
              {i18n.tObject('propertyTypes')[item.property.type] || item.property.type}
            </Typography>
            <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 18, color: tk.text, mb: 0.75, lineHeight: 1.2 }}>
              {item.property.name}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 12, color: tk.textLabel }}>
                {i18n.t('validation.from').charAt(0).toUpperCase() + i18n.t('validation.from').slice(1)}{' '}
                {checkIn && fmtDate(checkIn)}{' '}
                {i18n.t('validation.to')}{' '}
                {checkOut && fmtDate(checkOut)}
              </Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 300, color: tk.primary, whiteSpace: 'nowrap', ml: 1 }}>
                {fmt((item.property.nightlyPrice || 0) * item.nights, defaultCurrency)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} sx={{
              position: 'absolute', top: 0, right: 0, color: tk.textLabel, p: 0.25,
            }}>
              <Delete size={14} strokeWidth={1.75} />
            </IconButton>
            {idx < cart.length - 1 && <Divider sx={{ mt: 2, borderColor: tk.border }} />}
          </Box>
        ))}

        {showCleaningFee && cleaningTotal > 0 && (
          <>
            <Divider sx={{ my: 1.5, borderColor: tk.border }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 12, color: tk.textLabel }}>{i18n.t('validation.cleaningFee')}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tk.text }}>{fmt(cleaningTotal, defaultCurrency)}</Typography>
            </Box>
          </>
        )}
      </>
    )}

    <Box onClick={() => { if (cart.length > 0) setPage('cart'); }} sx={{
      ...btnSx, py: 1.25, borderRadius: tk.radiusSm, textAlign: 'center',
      fontSize: 12, fontWeight: 700, textTransform: tk.btnTransform,
      cursor: cart.length > 0 ? 'pointer' : 'default',
      opacity: cart.length > 0 ? 1 : 0.5,
    }}>
      {i18n.t('cart.addStay')}
    </Box>
  </Box>
);

export default BookingResultsPage;
