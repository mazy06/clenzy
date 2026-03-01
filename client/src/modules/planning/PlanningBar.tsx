import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { AutoAwesome, Handyman, Lock as LockIcon } from '@mui/icons-material';
import type { BarLayout, PlanningEvent, ZoomLevel, DragBarData } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { hexToRgba } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';

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
}

function getEventIcon(type: PlanningEvent['type'], compact: boolean) {
  const size = compact ? 9 : 12;
  switch (type) {
    case 'cleaning': return <AutoAwesome sx={{ fontSize: size }} />;
    case 'maintenance': return <Handyman sx={{ fontSize: size }} />;
    case 'blocked': return <LockIcon sx={{ fontSize: size }} />;
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
}) => {
  const theme = useTheme();
  const { event, left, top, height } = layout;
  const isDark = theme.palette.mode === 'dark';
  const isIntervention = event.type !== 'reservation';
  const isReservation = event.type === 'reservation';

  // Draggable for move (whole bar body)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { type: 'move', event, layout } satisfies DragBarData,
    disabled: !isReservation,
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
      {...(isReservation ? listeners : {})}
      {...(isReservation ? attributes : {})}
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
        backgroundColor: bgColor,
        border: `${isCompactBar ? 1 : 1.5}px solid ${borderColor}`,
        borderLeft: `${isCompactBar ? 2 : 3}px solid ${event.color}`,
        borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
        cursor: isResizing ? 'col-resize' : isReservation ? 'grab' : 'pointer',
        overflow: 'hidden',
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
        }),
        ...((isConflict || resizeConflict) && {
          animation: 'pulse-conflict 2s ease-in-out infinite',
          '@keyframes pulse-conflict': {
            '0%, 100%': { borderColor: event.color },
            '50%': { borderColor: theme.palette.error.main },
          },
        }),
      }}
    >
      {icon && (
        <Box sx={{ color: event.color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
      )}

      {showLabel && (
        <Typography
          sx={{
            fontSize: isIntervention ? '0.5625rem' : '0.6875rem',
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

      {showSublabel && event.sublabel && (() => {
        const sourceLogo = getSourceLogo(event.reservation?.source);
        return sourceLogo ? (
          <Box
            component="img"
            src={sourceLogo}
            alt={event.sublabel}
            sx={{
              height: 10,
              maxWidth: 40,
              objectFit: 'contain',
              flexShrink: 0,
              opacity: 0.85,
            }}
          />
        ) : (
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
        );
      })()}

      {/* Resize handle (right edge) — reservations only, hidden during move drag */}
      {isReservation && !isDragging && (
        <ResizeHandle eventId={event.id} event={event} layout={layout} />
      )}
    </Box>
  );
});

PlanningBar.displayName = 'PlanningBar';
export default PlanningBar;
