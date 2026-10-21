import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from '../../icons/glyphs';
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover';
import StatTile from '../../components/baitly/StatTile';
import { useTranslation } from '../../hooks/useTranslation';
import { HEADER_FLYOUT_CLASS } from '../../hooks/useHeaderSeam';
import { dashboardKpiPlacement } from './dashboardKpiPlacement';

interface Props {
  label: string;
  shortLabel?: string;
  value: ReactNode;
  unit?: ReactNode;
  artwork: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  children: ReactNode;
}

/** One disclosure shared by mouse, touch and keyboard. Details stay outside the dashboard scroll containers. */
export default function DashboardKpiDetail({ label, shortLabel, value, unit, artwork, open, onOpenChange, loading, children }: Props) {
  const { t, currentLanguage } = useTranslation();
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mode = useRef<'hover' | 'click'>('hover');
  const pointerType = useRef('mouse');
  const pointerInAnchor = useRef(false);
  const dismissed = useRef(false);
  const restoreFocus = useRef(false);
  const rtl = currentLanguage.startsWith('ar');
  const [placement, setPlacement] = useState<ReturnType<typeof dashboardKpiPlacement> | null>(null);
  const measure = useCallback(() => {
    const tile = anchor.current;
    const strip = tile?.closest('.bui-stat-overview');
    if (!tile || !strip) return;
    const bounds = strip.getBoundingClientRect();
    if (!bounds.width) return;
    const next = dashboardKpiPlacement(tile.getBoundingClientRect(), bounds, window.innerWidth, rtl);
    setPlacement((current) => current?.width === next.width && current.alignOffset === next.alignOffset
      && current.flushLeft === next.flushLeft && current.flushRight === next.flushRight ? current : next);
  }, [rtl]);
  const cancelTimer = () => clearTimeout(timer.current);
  useEffect(() => cancelTimer, []);
  useEffect(() => { if (!open) cancelTimer(); }, [open]);
  // Measure after the selected grid track expands, before painting the portal.
  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);
  useEffect(() => {
    if (!open) return;
    // Only the open drawer observes responsive layout changes.
    const observer = new ResizeObserver(measure);
    if (anchor.current) observer.observe(anchor.current);
    const strip = anchor.current?.closest('.bui-stat-overview');
    if (strip) observer.observe(strip);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [open, measure]);

  const close = () => { cancelTimer(); dismissed.current = pointerInAnchor.current; onOpenChange(false); };
  const leave = () => {
    cancelTimer();
    // Mouse focus (for example after opening the level explanation) must not pin a hover drawer.
    // Keyboard navigation explicitly switches to click mode below.
    if (mode.current === 'hover') timer.current = setTimeout(close, 220);
  };

  return <Popover open={open && !loading} onOpenChange={(next) => { if (next) onOpenChange(true); else close(); }}>
    <PopoverAnchor asChild>
      <div ref={anchor} className="bui-stat-overview__item" data-expanded={open && !loading}
        data-flush-left={placement?.flushLeft} data-flush-right={placement?.flushRight}
        onPointerDown={(event) => { pointerType.current = event.pointerType; }}
        onKeyDown={(event) => {
          if (open && event.key !== 'Escape') { cancelTimer(); mode.current = 'click'; }
        }}
        onPointerEnter={(event) => {
          pointerInAnchor.current = true;
          cancelTimer();
          // Tablets (including those with a mouse) and touch pointers use deliberate clicks.
          if (loading || open || dismissed.current || event.pointerType !== 'mouse'
            || !window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)').matches) return;
          timer.current = setTimeout(() => {
            measure();
            mode.current = 'hover';
            restoreFocus.current = false;
            onOpenChange(true);
          }, 180);
        }}
        onPointerLeave={() => { pointerInAnchor.current = false; dismissed.current = false; leave(); }}>
        <StatTile icon={null} artwork={artwork} label={shortLabel ?? label} value={value} unit={unit} loading={loading}
          expanded={open && !loading} controls={id} onClick={(event) => {
            cancelTimer();
            const next = !open;
            if (next) measure();
            const mouseClick = event.detail > 0 && pointerType.current === 'mouse'
              && window.matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)').matches;
            mode.current = mouseClick ? 'hover' : 'click';
            // Restore only for an explicit dismissal, never while another KPI takes over.
            restoreFocus.current = !next;
            if (next) { dismissed.current = false; onOpenChange(true); } else close();
          }} />
      </div>
    </PopoverAnchor>
    {/* The tile ends at the inner edge of the strip's 1px border (or the next row's divider).
        The concave stroke is already centred 0.5px beyond that edge; no extra overlap is needed. */}
    <PopoverContent id={id} className={`${HEADER_FLYOUT_CLASS} db-kpis__drawer`} side="bottom" align="start" sideOffset={0}
      data-flush-left={placement?.flushLeft} data-flush-right={placement?.flushRight}
      alignOffset={placement?.alignOffset ?? 14}
      style={placement ? { '--db-kpi-drawer-width': `${placement.width}px` } as CSSProperties : undefined}
      collisionPadding={{ top: 16, bottom: 16, left: 0, right: 0 }} aria-labelledby={`${id}-title`} aria-describedby={undefined}
      dir={rtl ? 'rtl' : 'ltr'}
      onPointerEnter={cancelTimer} onPointerLeave={leave}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') { cancelTimer(); mode.current = 'click'; }
      }}
      onBlur={(event) => {
        if (mode.current === 'hover' && !event.currentTarget.contains(event.relatedTarget as Node | null)) leave();
      }}
      onOpenAutoFocus={(event) => { if (mode.current === 'hover') event.preventDefault(); }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (restoreFocus.current) anchor.current?.querySelector('button')?.focus();
      }}
      onEscapeKeyDown={() => { restoreFocus.current = true; }}
      onInteractOutside={(event) => {
        // The tile itself toggles the panel; don't also dismiss it on pointerdown.
        if (anchor.current?.contains(event.target as Node)) event.preventDefault();
        else restoreFocus.current = false;
      }}>
      <div className="db-kpis__drawer-scroll">
        <header className="db-kpis__drawer-header">
          <h3 id={`${id}-title`}>{label}</h3>
          <button type="button" className="db-kpis__close" aria-label={t('dashboardKpis.close')}
            onClick={() => { restoreFocus.current = true; close(); }}><X size={17} aria-hidden="true" /></button>
        </header>
        {children}
      </div>
    </PopoverContent>
  </Popover>;
}
