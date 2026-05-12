import React from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { AutoAwesome, Handyman, Lock as LockIcon, Close, WarningAmber, CreditCardOff } from '../../icons';
import type { BarLayout, PlanningEvent, ZoomLevel, DragBarData } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { hexToRgba } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';
import { useAuth } from '../../hooks/useAuth';

interface PlanningBarProps {
  layout: BarLayout;
  zoom: ZoomLevel;
  isSelected: boolean;
  isConflict: boolean;
  isDragActive: boolean;
  /** When this bar is being resized, pass the ghost width for live feedback */
  resizeWidth: number | null;
  resizeConflict: boolean;
  onClick: (event: PlanningEvent) => void;
  onHide?: (event: PlanningEvent) => void;
}

function getEventIcon(type: PlanningEvent['type'], compact: boolean) {
  const size = compact ? 9 : 12;
  switch (type) {
    case 'cleaning': return <AutoAwesome size={size} strokeWidth={1.75} />;
    case 'maintenance': return <Handyman size={size} strokeWidth={1.75} />;
    case 'blocked': return <LockIcon size={size} strokeWidth={1.75} />;
    default: return null;
  }
}

// ─── Resize Handle (right edge) ──────────────────────────────────────────────

const ResizeHandle: React.FC<{ eventId: string; event: PlanningEvent; layout: BarLayout }> = ({
  eventId,
  event,
  layout,
}) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize-${eventId}`,
    data: { type: 'resize', event, layout } satisfies DragBarData,
  });

  // Wrap onPointerDown to stop propagation → prevents the parent move draggable from activating
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    listeners?.onPointerDown?.(e as any);
  };

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      onPointerDown={handlePointerDown}
      sx={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: 8,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 10,
        '&:hover': {
          backgroundColor: 'rgba(0,0,0,0.08)',
        },
      }}
    />
  );
};

// ─── Main Bar ────────────────────────────────────────────────────────────────

const PlanningBar: React.FC<PlanningBarProps> = React.memo(({
  layout,
  zoom,
  isSelected,
  isConflict,
  isDragActive,
  resizeWidth,
  resizeConflict,
  onClick,
  onHide,
}) => {
  const theme = useTheme();
  const { event, left, top, height } = layout;
  const isDark = theme.palette.mode === 'dark';
  const isIntervention = event.type !== 'reservation';
  const isReservation = event.type === 'reservation';

  // Role check: only SUPER_ADMIN, SUPER_MANAGER, or org ADMIN can drag interventions
  const { user } = useAuth();
  const canEditIntervention = isReservation || (
    user?.roles?.some(r => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ||
    user?.orgRole === 'ADMIN'
  );

  // Draggable for move (whole bar body) — SR blocks are not draggable
  const isDragDisabled = event.type === 'blocked' || (isIntervention && !canEditIntervention) || !!event.isAwaitingPayment;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { type: 'move', event, layout } satisfies DragBarData,
    disabled: isDragDisabled,
  });

  // Use resizeWidth if this bar is being resized, otherwise original width
  const isResizing = resizeWidth !== null;
  const displayWidth = resizeWidth ?? layout.width;

  // When interventions are stacked (compact height), adapt display
  const isCompactBar = isIntervention && height < 18;
  const showLabel = displayWidth > 40 && height >= 12;
  const showSublabel = displayWidth > 100 && height >= 18;
  const icon = isIntervention ? getEventIcon(event.type, isCompactBar) : null;

  const bgColor = isIntervention
    ? hexToRgba(event.color, isDark ? 0.25 : 0.18)
    : hexToRgba(event.color, isDark ? 0.35 : 0.25);

  // Awaiting payment: diagonal striped pattern
  const isAwaitingPayment = !!event.isAwaitingPayment;
  const stripedBg = isAwaitingPayment
    ? `repeating-linear-gradient(-45deg, ${hexToRgba(event.color, isDark ? 0.12 : 0.08)}, ${hexToRgba(event.color, isDark ? 0.12 : 0.08)} 4px, ${hexToRgba(event.color, isDark ? 0.28 : 0.20)} 4px, ${hexToRgba(event.color, isDark ? 0.28 : 0.20)} 8px)`
    : undefined;

  const borderColor = isSelected
    ? theme.palette.primary.main
    : (isConflict || resizeConflict)
      ? theme.palette.error.main
      : event.color;

  // Only reduce opacity for move drag, not resize
  const draggedOpacity = isDragging ? 0.3 : 1;

  return (
    <Box
      ref={setNodeRef}
      data-planning-bar
      {...(!isDragDisabled ? listeners : {})}
      {...(!isDragDisabled ? attributes : {})}
      onClick={(e) => {
        // Don't trigger click if a drag just happened
        if (isDragActive) return;
        e.stopPropagation();
        onClick(event);
      }}
      sx={{
        position: 'absolute',
        left,
        top,
        width: displayWidth,
        height,
        ...(stripedBg ? { background: stripedBg } : { backgroundColor: bgColor }),
        border: `${event.status === 'cancelled' ? 2 : isCompactBar ? 1 : 1.5}px solid ${borderColor}`,
        borderStyle: isAwaitingPayment ? 'dashed' : 'solid',
        borderLeft: `${event.status === 'cancelled' ? 3 : isCompactBar ? 2 : 3}px ${isAwaitingPayment ? 'dashed' : 'solid'} ${event.color}`,
        borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
        cursor: isResizing ? 'col-resize' : isDragDisabled ? 'pointer' : 'grab',
        touchAction: 'none',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        justifyContent: showLabel ? 'flex-start' : 'center',
        gap: showLabel ? 0.5 : 0,
        px: showLabel ? 0.75 : 0,
        transition: (isDragging || isResizing) ? 'none' : 'box-shadow 0.15s ease, transform 0.1s ease, width 0.1s ease',
        userSelect: 'none',
        opacity: draggedOpacity,
        zIndex: isSelected ? 5 : isIntervention ? 2 : 3,
        '&:hover': {
          boxShadow: `0 2px 8px ${hexToRgba(event.color, 0.3)}`,
          transform: 'translateY(-1px)',
          zIndex: 6,
        },
        ...(isSelected && {
          boxShadow: `0 0 0 2px ${theme.palette.primary.main}, 0 4px 12px ${hexToRgba(theme.palette.primary.main, 0.3)}`,
          transform: 'translateY(-1px)',
          animation: 'select-pop 0.3s ease-out',
          '@keyframes select-pop': {
            '0%': { transform: 'scale(1) translateY(0)' },
            '40%': { transform: 'scale(1.05) translateY(-2px)' },
            '100%': { transform: 'scale(1) translateY(-1px)' },
          },
        }),
        ...((isConflict || resizeConflict) && {
          animation: 'pulse-conflict 2s ease-in-out infinite',
          '@keyframes pulse-conflict': {
            '0%, 100%': { borderColor: event.color },
            '50%': { borderColor: theme.palette.error.main },
          },
        }),
        ...(event.status === 'cancelled' && !isConflict && !resizeConflict && {
          animation: 'pulse-cancelled 2s ease-in-out infinite',
          '@keyframes pulse-cancelled': {
            '0%, 100%': { borderColor: event.color, opacity: 1 },
            '50%': { borderColor: theme.palette.error.dark, opacity: 0.85 },
          },
        }),
      }}
    >
      {/* Source logo — before the label */}
      {showSublabel && event.sublabel && (() => {
        const sourceLogo = getSourceLogo(event.reservation?.source);
        return sourceLogo ? (
          <Box
            component="img"
            src={sourceLogo}
            alt={event.sublabel}
            sx={{
              height: '80%',
              objectFit: 'contain',
              flexShrink: 0,
              opacity: 0.9,
            }}
          />
        ) : null;
      })()}

      {icon && (
        <Box sx={{ color: event.color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
      )}

      {showLabel && (
        <Typography
          sx={{
            fontSize: isIntervention ? '0.5rem' : '0.625rem',
            fontWeight: 600,
            color: isDark ? 'text.primary' : event.color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
            flex: 1,
            minWidth: 0,
          }}
        >
          {event.label}
        </Typography>
      )}

      {/* Sublabel text — only when no source logo */}
      {showSublabel && event.sublabel && !getSourceLogo(event.reservation?.source) && (
        <Typography
          sx={{
            fontSize: '0.5rem',
            fontWeight: 400,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 0,
          }}
        >
          {event.sublabel}
        </Typography>
      )}

      {/* Hide button for cancelled reservations — always visible, badge-style top-right */}
      {isReservation && event.status === 'cancelled' && onHide && (
        <Tooltip title="Masquer du planning" arrow>
          <Box
            onClick={(e) => {
              e.stopPropagation();
              onHide(event);
            }}
            sx={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: event.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
              '&:hover': {
                filter: 'brightness(0.85)',
                transform: 'scale(1.1)',
              },
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
          >
            <Close size={10} strokeWidth={1.75} color='#fff' />
          </Box>
        </Tooltip>
      )}

      {/* Warning badge: guest has no email → automatic emails will fail */}
      {isReservation && event.reservation && !event.reservation.guestEmail && event.status !== 'cancelled' && (
        <Tooltip title="Email voyageur manquant — les messages automatiques ne seront pas envoyés" arrow>
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#ED6C02',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
            }}
          >
            <WarningAmber size={10} strokeWidth={1.75} color='#fff' />
          </Box>
        </Tooltip>
      )}

      {/* Payment badge: reservation or intervention has unpaid payment */}
      {event.needsPaymentBadge && (() => {
        const hasWarningBadge = isReservation && event.reservation && !event.reservation.guestEmail && event.status !== 'cancelled';
        const tooltipText = event.paymentBadgeStatus === 'FAILED'
          ? 'Paiement echoue'
          : event.paymentBadgeStatus === 'PROCESSING'
            ? 'Paiement en cours de traitement'
            : 'Paiement en attente';
        return (
          <Tooltip title={tooltipText} arrow>
            <Box
              sx={{
                position: 'absolute',
                top: -6,
                right: hasWarningBadge ? 12 : -6,
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: event.paymentBadgeStatus === 'FAILED' ? '#C62828' : '#E53935',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
              }}
            >
              <CreditCardOff size={10} strokeWidth={1.75} color='#fff' />
            </Box>
          </Tooltip>
        );
      })()}

      {/* Resize handle (right edge) — hidden during move drag, respects role permissions */}
      {!isDragDisabled && !isDragging && (
        <ResizeHandle eventId={event.id} event={event} layout={layout} />
      )}
    </Box>
  );
});

PlanningBar.displayName = 'PlanningBar';
export default PlanningBar;
