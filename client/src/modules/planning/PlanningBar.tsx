import React from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { Lock as LockIcon, Close } from '../../icons';
import { INTERVENTION_TYPE_LABELS } from '../../services/api/reservationsApi';
import type { PlanningInterventionType } from '../../services/api';
import type { BarLayout, PlanningEvent, ZoomLevel, DragBarData } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { hexToRgba } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';
import { daysBetween } from './utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';

/** Compte le nombre de nuits d'une reservation (endDate - startDate). */
function getNights(startDate: string, endDate: string): number {
  try {
    return Math.max(1, daysBetween(new Date(startDate), new Date(endDate)));
  } catch {
    return 1;
  }
}

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

/** Icone des interventions. Menage/maintenance affichent leur type en
 *  texte (pas d'icone), seul "blocked" garde son cadenas. */
function getEventIcon(type: PlanningEvent['type'], compact: boolean) {
  const size = compact ? 9 : 12;
  switch (type) {
    case 'blocked': return <LockIcon size={size} strokeWidth={1.75} />;
    default: return null;
  }
}

/** Texte du type pour les interventions (Ménage / Maintenance).
 *  Null pour les autres types. */
function getInterventionTypeLabel(event: PlanningEvent): string | null {
  if (event.type === 'cleaning' || event.type === 'maintenance') {
    return INTERVENTION_TYPE_LABELS[event.type as PlanningInterventionType];
  }
  return null;
}

// ─── Radar Pastille (pulsing badge indicator) ───────────────────────────────
//
// Petite pastille avec effet "radar" : un point solide entoure de 2 anneaux
// qui pulsent vers l'exterieur (decales de 0.8s pour un effet continu).
// La couleur de la pastille encode le type de souci :
//   - orange (#ED6C02) : info manquante (ex: email voyageur)
//   - rouge  (#E53935) : paiement en attente
//   - rouge fonce (#C62828) : paiement echoue
const RadarPastille: React.FC<{
  color: string;
  tooltip: string;
  right?: number;
  isDark: boolean;
}> = ({ color, tooltip, right = -4, isDark }) => (
  <Tooltip title={tooltip} arrow>
    <Box
      sx={{
        position: 'absolute',
        top: -3,
        right,
        width: 10,
        height: 10,
        zIndex: 12,
      }}
    >
      {/* Anneau 1 (pulse continu) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: color,
          pointerEvents: 'none',
          animation: 'radar-pulse 1.6s cubic-bezier(0,0,0.2,1) infinite',
          '@keyframes radar-pulse': {
            '0%':   { transform: 'scale(1)', opacity: 0.55 },
            '100%': { transform: 'scale(2.6)', opacity: 0 },
          },
        }}
      />
      {/* Anneau 2 (decale de 0.8s pour un effet continu) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: color,
          pointerEvents: 'none',
          animation: 'radar-pulse 1.6s cubic-bezier(0,0,0.2,1) 0.8s infinite',
        }}
      />
      {/* Point central solide */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: color,
          border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </Box>
  </Tooltip>
);

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

  // Reservations ET interventions : fond OPAQUE saturé (couleur du status
  // / type). Plus de transparence rgba, plus de border ni liseré (les
  // side-stripes >1px sont un anti-pattern Impeccable). Cards pleines,
  // lisibles d'un coup d'oeil, harmonieuses avec le reste du planning.
  const bgColor = event.color;

  // Note : pas de pattern strié pour "paiement en attente". L'info est
  // deja transmise par la pastille radar rouge (RadarPastille) → grillage
  // redondant et bruyant. Le fond reste un aplat uniforme.
  const isAwaitingPayment = !!event.isAwaitingPayment;

  // Nuits pour la 1ere ligne (uniquement reservations)
  const nights = isReservation ? getNights(event.startDate, event.endDate) : 0;
  const sourceLogo = isReservation ? getSourceLogo(event.reservation?.source) : null;

  // Texte du type pour menage/maintenance (remplace l'icone)
  const interventionTypeLabel = isIntervention ? getInterventionTypeLabel(event) : null;

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
        backgroundColor: bgColor,
        // Aucune border ni liseré : fond opaque uniforme pour tous les types
        // (reservation, menage, maintenance, blocked). Conforme aux règles
        // Impeccable (anti-pattern side-stripe).
        border: 'none',
        borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
        cursor: isResizing ? 'col-resize' : isDragDisabled ? 'pointer' : 'grab',
        touchAction: 'none',
        // visible : laisse les pastilles (warning, payment, hide) deborder
        // de -6px. Le clipping du texte est fait sur le wrapper interne.
        overflow: 'visible',
        display: 'flex',
        // Layout : reservations en COLUMN (nuits + nom), interventions ROW.
        flexDirection: isReservation ? 'column' : 'row',
        alignItems: isReservation ? 'stretch' : 'center',
        justifyContent: isReservation
          ? 'center'
          : showLabel ? 'flex-start' : 'center',
        gap: isReservation ? 0 : (showLabel ? 0.5 : 0),
        px: isReservation ? 0.875 : (showLabel ? 0.75 : 0),
        py: isReservation ? 0.5 : 0,
        transition: (isDragging || isResizing) ? 'none' : 'box-shadow 0.15s ease, transform 0.1s ease, width 0.1s ease',
        userSelect: 'none',
        opacity: draggedOpacity,
        zIndex: isSelected ? 5 : isIntervention ? 2 : 3,
        '&:hover': {
          boxShadow: `0 4px 12px ${hexToRgba(event.color, 0.45)}`,
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
          boxShadow: `0 0 0 2px ${theme.palette.error.main}`,
          animation: 'pulse-conflict 2s ease-in-out infinite',
          '@keyframes pulse-conflict': {
            '0%, 100%': { boxShadow: `0 0 0 2px ${theme.palette.error.main}` },
            '50%': { boxShadow: `0 0 0 2px ${hexToRgba(theme.palette.error.main, 0.5)}` },
          },
        }),
        ...(event.status === 'cancelled' && !isConflict && !resizeConflict && {
          opacity: draggedOpacity * 0.6,
          animation: 'pulse-cancelled 2s ease-in-out infinite',
          '@keyframes pulse-cancelled': {
            '0%, 100%': { opacity: draggedOpacity * 0.6 },
            '50%': { opacity: draggedOpacity * 0.4 },
          },
        }),
      }}
    >
      {/* ── RESERVATION : 2 lignes (nuits + nom) + logo canal a droite ───── */}
      {isReservation && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5,
            width: '100%',
            height: '100%',
            color: '#fff',
            minWidth: 0,
            // Clip le contenu (texte + logo) au radius de la card.
            // L'overflow visible reste sur le parent pour les pastilles.
            overflow: 'hidden',
            borderRadius: `${BAR_BORDER_RADIUS}px`,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* Ligne 1 : nombre de nuits */}
            <Box
              component="span"
              sx={{
                fontSize: '0.625rem',
                fontWeight: 400,
                lineHeight: 1,
                opacity: 0.85,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nights} {nights > 1 ? 'nuits' : 'nuit'}
            </Box>
            {/* Ligne 2 : nom du voyageur */}
            {showLabel && (
              <Box
                component="span"
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.01em',
                }}
              >
                {event.label}
              </Box>
            )}
          </Box>
          {/* Logo canal a droite */}
          {sourceLogo && displayWidth > 60 && (
            <Box
              component="img"
              src={sourceLogo}
              alt={event.sublabel || ''}
              sx={{
                height: '60%',
                maxHeight: 22,
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
                // Le logo reste lisible sur le fond colore : leger backdrop
                // blanc circulaire si le logo est foncé.
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
              }}
            />
          )}
        </Box>
      )}

      {/* ── INTERVENTION (menage / maintenance / blocked) : layout inline ───
          fond opaque + icone + label + sublabel, tous en blanc.
          Padding horizontal pour respirer entre les bords. Clipping interne
          pour empecher le texte de deborder du radius. */}
      {!isReservation && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: showLabel ? 'flex-start' : 'center',
            gap: 0.5,
            width: '100%',
            height: '100%',
            color: '#fff',
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
          }}
        >
          {/* Type texte (Menage / Maintenance) en remplacement de l'icone.
              "blocked" garde son icone cadenas (LockIcon). */}
          {interventionTypeLabel ? (
            <Box
              component="span"
              sx={{
                fontSize: isCompactBar ? '0.5rem' : '0.5625rem',
                fontWeight: 700,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                flexShrink: 0,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              {interventionTypeLabel}
            </Box>
          ) : (
            icon && (
              <Box
                sx={{
                  color: '#fff',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.95,
                }}
              >
                {icon}
              </Box>
            )
          )}

          {/* Pas de label/sublabel sur les interventions : seul le type
              s'affiche dans le bar. Le titre custom et l'assigne restent
              accessibles via le panneau de detail au clic — evite l'effet
              "MENAGE M." tronque quand la place manque. */}
        </Box>
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

      {/* Pastille radar (info) — email voyageur manquant (orange) */}
      {isReservation && event.reservation && !event.reservation.guestEmail && event.status !== 'cancelled' && (
        <RadarPastille
          color="#ED6C02"
          tooltip="Email voyageur manquant — les messages automatiques ne seront pas envoyés"
          right={-4}
          isDark={isDark}
        />
      )}

      {/* Pastille radar (paiement) — en attente / en cours / echoue (rouge) */}
      {event.needsPaymentBadge && (() => {
        const hasInfoPastille = isReservation && event.reservation && !event.reservation.guestEmail && event.status !== 'cancelled';
        const tooltipText = event.paymentBadgeStatus === 'FAILED'
          ? 'Paiement echoue'
          : event.paymentBadgeStatus === 'PROCESSING'
            ? 'Paiement en cours de traitement'
            : 'Paiement en attente';
        const paymentColor = event.paymentBadgeStatus === 'FAILED' ? '#C62828' : '#E53935';
        return (
          <RadarPastille
            color={paymentColor}
            tooltip={tooltipText}
            right={hasInfoPastille ? 12 : -4}
            isDark={isDark}
          />
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
