import React from 'react';
import { Box, Typography, IconButton, Divider } from '@mui/material';
import { Search, ChevronLeft } from '@mui/icons-material';
import type { ResolvedTokens, PanelType, PreviewPropertyType, PreviewAvailabilityDay } from '../types/bookingEngine';
import { fmtDate, fmtDateShort } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import GuestSelector from './GuestSelector';
import PropertyTypeFilter from './PropertyTypeFilter';
import BookingCalendar from './BookingCalendar';

interface BookingSearchBarProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  isCompact: boolean;
  // Panel state
  activePanel: PanelType;
  togglePanel: (panel: PanelType) => void;
  panelDirection: 'up' | 'down';
  // Guest data
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
  // Types data
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  propertyTypes?: PreviewPropertyType[];
  // Calendar data
  checkIn: string | null;
  checkOut: string | null;
  calMonth: { year: number; month: number };
  setCalMonth: (val: { year: number; month: number }) => void;
  hoverDate: string | null;
  setHoverDate: (d: string | null) => void;
  handleDayClick: (dateStr: string) => void;
  availabilityDays?: Map<string, PreviewAvailabilityDay>;
  availabilityLoading?: boolean;
  defaultCurrency: string;
  defaultLanguage: string;
  // Actions
  handleSearch: () => void;
  // Branding
  logoUrl?: string | null;
  // Min bookable date (YYYY-MM-DD)
  minBookableDate?: string;
}

const BookingSearchBar: React.FC<BookingSearchBarProps> = ({
  tk, i18n, btnSx, isCompact,
  activePanel, togglePanel, panelDirection,
  adults, setAdults, children, setChildren,
  selectedTypes, setSelectedTypes, propertyTypes,
  checkIn, checkOut, calMonth, setCalMonth,
  hoverDate, setHoverDate, handleDayClick,
  availabilityDays, availabilityLoading, defaultCurrency, defaultLanguage,
  handleSearch, logoUrl, minBookableDate,
}) => {
  const sectionLabelSx = {
    fontSize: '10px', fontWeight: 500, color: tk.textLabel,
    textTransform: 'uppercase' as const, letterSpacing: '0.52px', lineHeight: '13px',
  };

  const panelTitle = activePanel === 'guests'
    ? i18n.t('searchBar.travelers')
    : activePanel === 'types'
      ? i18n.t('searchBar.accommodations')
      : activePanel === 'dates'
        ? i18n.t('searchBar.stayDates')
        : '';

  const renderPanelContent = () => (
    <>
      {activePanel === 'guests' && (
        <GuestSelector tk={tk} i18n={i18n} adults={adults} setAdults={setAdults}
          children={children} setChildren={setChildren} isCompact={isCompact} />
      )}
      {activePanel === 'types' && propertyTypes && propertyTypes.length > 0 && (
        <PropertyTypeFilter tk={tk} i18n={i18n} propertyTypes={propertyTypes}
          selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes} isCompact={isCompact} />
      )}
      {activePanel === 'dates' && (
        <BookingCalendar tk={tk} i18n={i18n} calMonth={calMonth} setCalMonth={setCalMonth}
          checkIn={checkIn} checkOut={checkOut} hoverDate={hoverDate} setHoverDate={setHoverDate}
          handleDayClick={handleDayClick} selectedTypes={selectedTypes}
          availabilityDays={availabilityDays} availabilityLoading={availabilityLoading}
          defaultCurrency={defaultCurrency} isCompact={isCompact}
          minBookableDate={minBookableDate} />
      )}
    </>
  );

  return (
    <Box sx={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      px: { xs: 2, sm: 4, md: 6 },
      py: 2,
      zIndex: 11,
    }}>
      {/* Logo */}
      {logoUrl && (
        <Box component="img" src={logoUrl} alt="Logo"
          sx={{ maxHeight: 40, maxWidth: 160, mb: 1.5, objectFit: 'contain' }} />
      )}

      {/* Mobile panel */}
      {isCompact && activePanel && (
        <MobilePanel tk={tk} i18n={i18n} panelTitle={panelTitle} btnSx={btnSx}
          defaultLanguage={defaultLanguage} togglePanel={togglePanel}>
          {renderPanelContent()}
        </MobilePanel>
      )}

      {/* Desktop search bar wrapper */}
      <Box sx={{
        position: 'relative', width: '100%', maxWidth: 900,
        bgcolor: tk.surface, borderRadius: tk.cardRadius, p: '6px',
        boxShadow: tk.shadow, zIndex: 1,
        display: isCompact && activePanel ? 'none' : 'block',
      }}>
        <SearchBarItems
          tk={tk} i18n={i18n} btnSx={btnSx} sectionLabelSx={sectionLabelSx}
          isCompact={isCompact} togglePanel={togglePanel}
          adults={adults} children={children}
          selectedTypes={selectedTypes} propertyTypes={propertyTypes}
          checkIn={checkIn} checkOut={checkOut}
          handleSearch={handleSearch} defaultLanguage={defaultLanguage}
        />

        {/* Desktop dropdown panel */}
        {!isCompact && activePanel && (
          <DesktopPanel tk={tk} panelTitle={panelTitle} panelDirection={panelDirection} togglePanel={togglePanel}>
            {renderPanelContent()}
          </DesktopPanel>
        )}
      </Box>
    </Box>
  );
};

// ─── SearchBarItems (the clickable sections) ────────────────────────────────

interface SearchBarItemsProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  btnSx: Record<string, unknown>;
  sectionLabelSx: Record<string, unknown>;
  isCompact: boolean;
  togglePanel: (panel: PanelType) => void;
  adults: number;
  children: number;
  selectedTypes: string[];
  propertyTypes?: PreviewPropertyType[];
  checkIn: string | null;
  checkOut: string | null;
  handleSearch: () => void;
  defaultLanguage: string;
}

const SearchBarItems: React.FC<SearchBarItemsProps> = ({
  tk, i18n, btnSx, sectionLabelSx, isCompact, togglePanel,
  adults, children, selectedTypes, propertyTypes, checkIn, checkOut, handleSearch, defaultLanguage,
}) => (
  <Box sx={{
    display: 'flex', alignItems: 'stretch',
    flexDirection: isCompact ? 'column' : 'row',
    height: isCompact ? 'auto' : 36,
    position: 'relative', zIndex: 2,
  }}>
    {/* Travelers */}
    <Box onClick={() => togglePanel('guests')} sx={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      px: '12px', py: isCompact ? '8px' : 0, cursor: 'pointer',
      borderRight: isCompact ? 'none' : `1px solid ${tk.border}`,
      borderBottom: isCompact ? `1px solid ${tk.border}` : 'none',
    }}>
      <Typography sx={sectionLabelSx}>{i18n.t('searchBar.travelers')}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 400, color: tk.primary, lineHeight: '16px' }}>
        {adults} {i18n.t('guests.adult')}{children > 0 ? `, ${children} ${i18n.t('guests.child')}` : ''}
      </Typography>
    </Box>

    {/* Accommodations */}
    <Box onClick={() => togglePanel('types')} sx={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      px: '12px', py: isCompact ? '8px' : 0, cursor: 'pointer',
      borderRight: isCompact ? 'none' : `1px solid ${tk.border}`,
      borderBottom: isCompact ? `1px solid ${tk.border}` : 'none',
    }}>
      <Typography sx={sectionLabelSx}>{i18n.t('searchBar.accommodations')}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 400, color: tk.primary, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {selectedTypes.length === 0 || (propertyTypes && selectedTypes.length === propertyTypes.length)
          ? i18n.t('searchBar.allTypes')
          : selectedTypes.map(t => i18n.tObject('propertyTypes')[t] || t).join(', ')}
      </Typography>
    </Box>

    {/* Dates */}
    <Box onClick={() => togglePanel('dates')} sx={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      px: '12px', py: isCompact ? '8px' : 0, cursor: 'pointer',
      borderBottom: isCompact ? `1px solid ${tk.border}` : 'none',
    }}>
      <Typography sx={sectionLabelSx}>{i18n.t('searchBar.stayDates')}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 400, color: checkIn ? tk.primary : tk.textPlaceholder, lineHeight: '16px' }}>
        {checkIn && checkOut
          ? `${i18n.t('validation.from')} ${fmtDateShort(checkIn, defaultLanguage)} ${i18n.t('validation.to')} ${fmtDate(checkOut, defaultLanguage)}`
          : i18n.t('searchBar.select')}
      </Typography>
    </Box>

    {/* Search button */}
    <IconButton onClick={handleSearch} sx={{
      ...btnSx, borderRadius: isCompact ? tk.radiusSm : tk.cardRadius,
      width: isCompact ? '100%' : 36, height: 36, flexShrink: 0,
      opacity: checkIn && checkOut ? 1 : 0.5,
    }}>
      <Search sx={{ fontSize: 16 }} />
    </IconButton>
  </Box>
);

// ─── MobilePanel ────────────────────────────────────────────────────────────

interface MobilePanelProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  panelTitle: string;
  btnSx: Record<string, unknown>;
  defaultLanguage: string;
  togglePanel: (panel: PanelType) => void;
  children: React.ReactNode;
}

const MobilePanel: React.FC<MobilePanelProps> = ({
  tk, i18n, panelTitle, btnSx, defaultLanguage, togglePanel, children,
}) => (
  <Box sx={{
    width: '100%', maxWidth: 900, mx: 'auto',
    bgcolor: tk.surface, borderRadius: tk.cardRadius,
    boxShadow: tk.shadow, zIndex: 20,
  }}>
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      px: 2, pt: 1.5, pb: 1,
    }}>
      <Typography sx={{
        fontFamily: tk.headingFont, fontWeight: 600, fontSize: 14,
        color: tk.text, textTransform: 'uppercase', letterSpacing: '0.52px',
      }}>
        {panelTitle}
      </Typography>
      <IconButton size="small" onClick={() => togglePanel(null)} sx={{ color: tk.textLabel }}>
        <ChevronLeft sx={{ fontSize: 18, transform: 'rotate(-90deg)' }} />
      </IconButton>
    </Box>
    <Divider sx={{ borderColor: tk.border, mx: 2 }} />
    <Box sx={{ px: 2, py: 2 }}>{children}</Box>
    <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
      <Box onClick={() => togglePanel(null)} sx={{
        ...btnSx, py: 1, borderRadius: tk.radiusSm,
        cursor: 'pointer', textAlign: 'center',
        fontSize: 12, fontWeight: 700, textTransform: tk.btnTransform,
      }}>
        {i18n.t('common.confirm')}
      </Box>
    </Box>
  </Box>
);

// ─── DesktopPanel ───────────────────────────────────────────────────────────

interface DesktopPanelProps {
  tk: ResolvedTokens;
  panelTitle: string;
  panelDirection: 'up' | 'down';
  togglePanel: (panel: PanelType) => void;
  children: React.ReactNode;
}

const DesktopPanel: React.FC<DesktopPanelProps> = ({
  tk, panelTitle, panelDirection, togglePanel, children,
}) => (
  <Box sx={{
    position: 'absolute',
    ...(panelDirection === 'down'
      ? { top: -8, left: -8 }
      : { bottom: -8, left: -8 }),
    width: 'calc(100% + 16px)',
    bgcolor: tk.surfaceMuted,
    borderRadius: tk.cardRadius,
    zIndex: -1,
    p: '8px',
    ...(panelDirection === 'down' ? { pt: '60px' } : { pb: '60px' }),
  }}>
    <Box sx={{
      bgcolor: tk.surface, borderRadius: tk.cardRadius,
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        px: '24px', pt: 2, pb: 1.5, flexShrink: 0,
      }}>
        <Typography sx={{
          fontFamily: tk.headingFont, fontWeight: 500, fontSize: 15,
          color: tk.text, textTransform: 'uppercase', letterSpacing: '0.52px',
        }}>
          {panelTitle}
        </Typography>
        <IconButton size="small" onClick={() => togglePanel(null)} sx={{ color: tk.textLabel }}>
          <ChevronLeft sx={{ fontSize: 18, transform: 'rotate(-90deg)' }} />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: tk.border, mx: '24px' }} />
      <Box sx={{ px: '24px', py: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 310 }}>
        {children}
      </Box>
    </Box>
  </Box>
);

export default BookingSearchBar;
