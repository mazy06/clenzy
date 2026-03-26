import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PreviewPage, PreviewProperty, PreviewPropertyType, CartItem, PanelType } from '../types/bookingEngine';

interface UseBookingNavigationProps {
  propertyTypes?: PreviewPropertyType[];
  properties?: PreviewProperty[];
  onMonthChange?: (year: number, month: number) => void;
  onTypesChange?: (types: string[]) => void;
  onGuestsChange?: (adults: number, children: number) => void;
  onPageChange?: (page: string) => void;
}

export function useBookingNavigation({
  propertyTypes,
  properties,
  onMonthChange,
  onTypesChange,
  onGuestsChange,
  onPageChange,
}: UseBookingNavigationProps) {
  // ─── Page state ───────────────────────────────────────────────────
  const [page, setPage] = useState<PreviewPage>('search');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() =>
    propertyTypes?.map(pt => pt.type) ?? []
  );
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // ─── Panel state ──────────────────────────────────────────────────
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const activePanel: PanelType = guestsOpen ? 'guests' : typesOpen ? 'types' : calendarOpen ? 'dates' : null;

  const togglePanel = useCallback((panel: PanelType) => {
    setGuestsOpen(panel === 'guests' ? !guestsOpen : false);
    setTypesOpen(panel === 'types' ? !typesOpen : false);
    setCalendarOpen(panel === 'dates' ? !calendarOpen : false);
  }, [guestsOpen, typesOpen, calendarOpen]);

  // ─── Container width detection ────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const isCompact = containerWidth < 500;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Sync effects ────────────────────────────────────────────────
  useEffect(() => { onGuestsChange?.(adults, children); }, [adults, children, onGuestsChange]);

  useEffect(() => {
    if (propertyTypes && propertyTypes.length > 0 && selectedTypes.length === 0) {
      setSelectedTypes(propertyTypes.map(pt => pt.type));
    }
  }, [propertyTypes]); // eslint-disable-line react-hooks/exhaustive-deps — intentional: only re-init on propertyTypes change

  useEffect(() => { onTypesChange?.(selectedTypes); }, [selectedTypes, onTypesChange]);
  useEffect(() => { onMonthChange?.(calMonth.year, calMonth.month + 1); }, [calMonth, onMonthChange]);
  useEffect(() => { onPageChange?.(page); }, [page, onPageChange]);

  // ─── Computed ─────────────────────────────────────────────────────
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(diff / 86400000));
  }, [checkIn, checkOut]);

  const handleDayClick = useCallback((dateStr: string) => {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateStr);
      setCheckOut(null);
    } else if (dateStr < checkIn) {
      setCheckIn(dateStr);
      setCheckOut(checkIn);
    } else if (dateStr === checkIn) {
      // Re-click on same date: reset selection
      setCheckIn(null);
      setCheckOut(null);
    } else {
      setCheckOut(dateStr);
    }
  }, [checkIn, checkOut]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (selectedTypes.length === 0) return properties;
    return properties.filter(p => selectedTypes.includes(p.type));
  }, [properties, selectedTypes]);

  const handleSearch = useCallback(() => {
    if (checkIn && checkOut) {
      setPage('results');
      setCalendarOpen(false);
      setGuestsOpen(false);
      setTypesOpen(false);
    }
  }, [checkIn, checkOut]);

  const resetBooking = useCallback(() => {
    setPage('search');
    setCart([]);
    setCheckIn(null);
    setCheckOut(null);
  }, []);

  return {
    // Page
    page, setPage,
    // Guests
    adults, setAdults, children, setChildren,
    // Types
    selectedTypes, setSelectedTypes,
    // Dates
    checkIn, checkOut, calMonth, setCalMonth, hoverDate, setHoverDate,
    handleDayClick,
    // Cart
    cart, setCart,
    // Auth
    authTab, setAuthTab,
    // Panels
    activePanel, togglePanel,
    guestsOpen, typesOpen, calendarOpen,
    // Layout
    containerRef, isCompact,
    // Computed
    nights, filteredProperties, handleSearch, resetBooking,
  };
}
