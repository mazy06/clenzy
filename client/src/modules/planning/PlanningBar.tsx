import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { Lock as LockIcon, Close, CreditCard, Warning, CleaningServices, Build } from '../../icons';
import { INTERVENTION_TYPE_LABELS } from '../../services/api/reservationsApi';
import type { PlanningInterventionType } from '../../services/api';
import type { BarLayout, PlanningEvent, ZoomLevel, DragBarData, UrgencyAnimationMode } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { getEventDisplayColor } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';
import { daysBetween } from './utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import './planningUrgency.css';

/** Compte le nombre de nuits d'une reservation (endDate - startDate). */
function getNights(startDate: string, endDate: string): number {
  try {
    return Math.max(1, daysBetween(new Date(startDate), new Date(endDate)));
  } catch {
    return 1;
  }
}

/** Initiales du voyageur pour l'avatar rond (max 2 lettres). */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
  /** Interventions (menage/maintenance) rattachees a cette reservation —
   *  affichees en pastilles blanches dans la brique (maquette). */
  linkedInterventions?: PlanningEvent[];
  /** Variante d'animation d'urgence (paiement en attente / info manquante). */
  urgencyAnimation?: UrgencyAnimationMode;
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
// Utilisee en REPLI quand la brique est trop etroite pour les pastilles
// blanches du langage Signature. Couleurs tokens :
//   - var(--warn) : info manquante (ex: email voyageur)
//   - var(--err)  : paiement en attente / echoue
const RadarPastille: React.FC<{
  color: string;
  tooltip: string;
  right?: number;
}> = ({ color, tooltip, right = -4 }) => (
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
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0 },
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
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0 },
        }}
      />
      {/* Point central solide */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: color,
          border: '1.5px solid var(--card)',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </Box>
  </Tooltip>
);

// ─── Pastille blanche (langage Signature, dans la brique) ───────────────────
//
// Indicateurs groupes a droite de la brique : carre arrondi blanc de 21px
// (spec .s-brick__badge) avec icone coloree 13px (paiement, info manquante)
// ou logo canal. Tooltip au survol. Variante "combo" : repli « +N ».
const BAR_BADGE_SX = {
  width: 21,
  height: 21,
  borderRadius: '7px',
  backgroundColor: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '0 1px 2px rgba(0,0,0,.14)',
} as const;

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
          backgroundColor: 'color-mix(in srgb, var(--ink) 8%, transparent)',
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
  linkedInterventions,
  urgencyAnimation = 'shake',
}) => {
  const { event, left, top, height } = layout;
  const isIntervention = event.type !== 'reservation';
  const isReservation = event.type === 'reservation';
  const isCancelled = isReservation && event.status === 'cancelled';

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
  const icon = isIntervention ? getEventIcon(event.type, isCompactBar) : null;

  // Brique Signature : la couleur de fond encode le STATUT (réservations)
  // ou le TYPE (interventions), via les tokens CSS. Annulée = fond hachuré
  // gris (géré plus bas). Aplat uniforme, pas de side-stripe (ban Impeccable).
  const barColor = getEventDisplayColor(event);

  // Note : pas de pattern strié pour "paiement en attente". L'info est
  // transmise par la pastille paiement (badge blanc ou radar en repli).
  const isAwaitingPayment = !!event.isAwaitingPayment;

  // Nuits pour la 1ere ligne (uniquement reservations)
  const nights = isReservation ? getNights(event.startDate, event.endDate) : 0;
  const sourceLogo = isReservation ? getSourceLogo(event.reservation?.source) : null;

  // Texte du type pour menage/maintenance (remplace l'icone)
  const interventionTypeLabel = isIntervention ? getInterventionTypeLabel(event) : null;

  // ── Indicateurs (paiement, info manquante) ────────────────────────────────
  const missingEmail = isReservation && !!event.reservation && !event.reservation.guestEmail && !isCancelled;
  const paymentTooltip = event.paymentBadgeStatus === 'FAILED'
    ? 'Paiement echoue'
    : event.paymentBadgeStatus === 'PROCESSING'
      ? 'Paiement en cours de traitement'
      : 'Paiement en attente';
  const indicators: {
    key: string;
    tooltip: string;
    color: string;
    icon: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }[] = [];
  if (event.needsPaymentBadge) {
    indicators.push({
      key: 'pay',
      tooltip: paymentTooltip,
      color: event.paymentBadgeStatus === 'FAILED'
        ? 'color-mix(in srgb, var(--err) 75%, var(--ink))'
        : 'var(--err)',
      icon: <CreditCard size={13} strokeWidth={2} />,
    });
  }
  if (missingEmail) {
    indicators.push({
      key: 'miss',
      tooltip: 'Email voyageur manquant — les messages automatiques ne seront pas envoyés',
      color: 'var(--warn)',
      icon: <Warning size={13} strokeWidth={2} />,
    });
  }
  // Interventions rattachees a la reservation : pastille blanche avec l'icone
  // du type (menage / maintenance), cliquable → ouvre le detail intervention.
  for (const linked of linkedInterventions ?? []) {
    const isCleaning = linked.type === 'cleaning';
    const typeLabel = INTERVENTION_TYPE_LABELS[(isCleaning ? 'cleaning' : 'maintenance') as PlanningInterventionType];
    indicators.push({
      key: linked.id,
      tooltip: linked.label && linked.label !== typeLabel ? `${typeLabel} — ${linked.label}` : typeLabel,
      color: isCleaning ? 'var(--info)' : 'var(--warn)',
      icon: isCleaning
        ? <CleaningServices size={13} strokeWidth={2} />
        : <Build size={13} strokeWidth={2} />,
      onClick: (e) => {
        e.stopPropagation();
        onClick(linked);
      },
    });
  }

  // Pastilles blanches inline (langage maquette) si la brique est assez
  // large, sinon repli sur les pastilles radar flottantes (élément historique).
  const showBadgeGroup = isReservation && displayWidth > 120 && height >= 28;
  const indicatorSlots = displayWidth > 175 ? 2 : 1;
  const shownIndicators = indicators.length <= indicatorSlots
    ? indicators
    : indicators.slice(0, Math.max(0, indicatorSlots - 1));
  const hiddenIndicators = indicators.slice(shownIndicators.length);

  // Avatar voyageur (rond, bord clair, 30px — spec .s-brick__av) — si la
  // place le permet. La taille ne varie PAS : variante étroite = masqué.
  const showAvatar = isReservation && displayWidth > 90 && height >= 32;
  // Pastille d'alerte sur l'avatar (spec .s-brick__alert) : err = paiement,
  // warn = info voyageur manquante. Purement visuelle (tooltips sur badges).
  const avatarAlertColor = !isCancelled
    ? (event.needsPaymentBadge ? 'var(--err)' : missingEmail ? 'var(--warn)' : null)
    : null;

  // Only reduce opacity for move drag, not resize
  const draggedOpacity = isDragging ? 0.3 : 1;

  // ── Animation d'urgence (galerie 09b) : wizz périodique ~4s + anneau pulsé
  // permanent à la couleur de la brique. Uniquement sur les réservations en
  // urgence (paiement en attente OU info voyageur manquante), hors annulées.
  // Suspendue quand la brique est sélectionnée / en conflit / draggée (leurs
  // anneaux et animations propres priment).
  const isUrgent = isReservation && !isCancelled && (event.needsPaymentBadge || missingEmail);
  const urgencyClass = isUrgent
    && urgencyAnimation !== 'none'
    && !isSelected && !isConflict && !resizeConflict && !isDragging && !isResizing
    ? `pl-urgent--${urgencyAnimation}`
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      data-planning-bar
      className={urgencyClass}
      style={isUrgent ? ({ '--bc': barColor } as React.CSSProperties) : undefined}
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
        // Couleur = statut/type (tokens). Annulée = hachuré gris (maquette).
        ...(isCancelled
          ? {
              backgroundColor: 'var(--surface-2)',
              backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--muted) 22%, transparent) 0 1.5px, transparent 1.5px 8px)',
              border: '1.5px dashed var(--line-2)',
            }
          : {
              backgroundColor: barColor,
              // Aucune border ni liseré : fond opaque uniforme (anti-pattern
              // side-stripe Impeccable).
              border: 'none',
            }),
        borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
        // Spec .s-brick : cursor pointer (le drag reste actif via dnd-kit).
        cursor: isResizing ? 'col-resize' : 'pointer',
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
        // Spec .s-brick : padding 0 8px (littéral — le spacing du thème vaut 6px).
        px: isReservation ? '8px' : (showLabel ? 0.75 : 0),
        py: 0,
        // Spec .s-brick : transition transform .12s, box-shadow .12s
        // (+ width pour le feedback resize, spécifique timeline).
        transition: (isDragging || isResizing) ? 'none' : 'transform .12s, box-shadow .12s, width .12s',
        userSelect: 'none',
        opacity: draggedOpacity,
        zIndex: isSelected ? 5 : isIntervention ? 2 : 3,
        // Spec .s-brick:hover (signature.css L208), transposée telle quelle.
        '&:hover': {
          boxShadow: '0 7px 16px -8px var(--shadow-pop)',
          transform: 'translateY(-1px)',
          zIndex: 6,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
        ...(isSelected && {
          boxShadow: '0 0 0 2px var(--card), 0 0 0 4px var(--accent)',
          transform: 'translateY(-1px)',
          animation: 'select-pop 0.3s ease-out',
          '@keyframes select-pop': {
            '0%': { transform: 'scale(1) translateY(0)' },
            '40%': { transform: 'scale(1.05) translateY(-2px)' },
            '100%': { transform: 'scale(1) translateY(-1px)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'none' },
        }),
        ...((isConflict || resizeConflict) && {
          boxShadow: '0 0 0 2px var(--err)',
          animation: 'pulse-conflict 2s ease-in-out infinite',
          '@keyframes pulse-conflict': {
            '0%, 100%': { boxShadow: '0 0 0 2px var(--err)' },
            '50%': { boxShadow: '0 0 0 2px color-mix(in srgb, var(--err) 50%, transparent)' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            boxShadow: '0 0 0 2px var(--err)',
          },
        }),
      }}
    >
      {/* ── RESERVATION : avatar + 2 lignes (nuits + nom) + pastilles ────── */}
      {isReservation && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            // Spec .s-brick : gap 9px entre avatar / texte / pastilles.
            gap: '9px',
            width: '100%',
            height: '100%',
            color: isCancelled ? 'var(--muted)' : 'var(--on-accent)',
            minWidth: 0,
            // Clip le contenu (texte + pastilles) au radius de la brique.
            // L'overflow visible reste sur le parent pour les pastilles radar.
            overflow: 'hidden',
            borderRadius: `${BAR_BORDER_RADIUS}px`,
          }}
        >
          {/* Avatar voyageur (spec .s-brick__avw + .s-brick__av) : wrapper
              relatif + rond 30px, bord clair, initiales 11px. La pastille
              d'alerte (.s-brick__alert) se pose en haut-gauche de l'avatar. */}
          {showAvatar && (
            <Box sx={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,.55)',
                  backgroundColor: 'rgba(255,255,255,.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isCancelled ? 'var(--muted)' : '#fff',
                  ...(isCancelled && {
                    filter: 'grayscale(1)',
                    opacity: 0.6,
                    borderColor: 'var(--line-2)',
                  }),
                }}
              >
                {getInitials(event.label)}
              </Box>
              {avatarAlertColor && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '3px',
                    left: '3px',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '1.6px solid #fff',
                    backgroundColor: avatarAlertColor,
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </Box>
          )}
          {/* Spec .s-brick__t : colonne centrée, line-height 1.2. */}
          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              lineHeight: 1.2,
            }}
          >
            {/* Ligne 1 (spec .s-brick__n) : nombre de nuits — 9.5px fw600 */}
            <Box
              component="span"
              sx={{
                fontSize: '9.5px',
                fontWeight: 600,
                opacity: 0.85,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nights} {nights > 1 ? 'nuits' : 'nuit'}
            </Box>
            {/* Ligne 2 (spec .s-brick__g) : nom du voyageur — 12.5px fw600 */}
            {showLabel && (
              <Box
                component="span"
                sx={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(isCancelled && { textDecoration: 'line-through' }),
                }}
              >
                {event.label}
              </Box>
            )}
          </Box>
          {/* Pastilles a droite : indicateurs (+N) + logo canal */}
          {(showBadgeGroup || (sourceLogo && displayWidth > 60)) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {showBadgeGroup && shownIndicators.map((it) => (
                <Tooltip key={it.key} title={it.tooltip} arrow>
                  <Box
                    onClick={it.onClick}
                    sx={{
                      ...BAR_BADGE_SX,
                      color: it.color,
                      ...(it.onClick && { cursor: 'pointer' }),
                    }}
                  >
                    {it.icon}
                  </Box>
                </Tooltip>
              ))}
              {showBadgeGroup && hiddenIndicators.length > 0 && (
                <Tooltip
                  arrow
                  title={hiddenIndicators.map((it) => it.tooltip).join(' · ')}
                >
                  <Box
                    sx={{
                      ...BAR_BADGE_SX,
                      // Spec .s-brick__badge.combo
                      backgroundColor: 'rgba(255,255,255,.9)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    +{hiddenIndicators.length}
                  </Box>
                </Tooltip>
              )}
              {sourceLogo && displayWidth > 60 && (
                <Tooltip title={event.sublabel || ''} arrow>
                  <Box sx={BAR_BADGE_SX}>
                    <Box
                      component="img"
                      src={sourceLogo}
                      alt={event.sublabel || ''}
                      sx={{
                        width: 13,
                        height: 13,
                        objectFit: 'contain',
                        display: 'block',
                        ...(isCancelled && { filter: 'grayscale(1)', opacity: 0.7 }),
                      }}
                    />
                  </Box>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ── INTERVENTION (menage / maintenance / blocked) : layout inline ───
          fond opaque + icone + label + sublabel, tous sur on-accent.
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
            color: 'var(--on-accent)',
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
                color: 'var(--on-accent)',
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
                  color: 'var(--on-accent)',
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
              backgroundColor: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 12,
              boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 30%, transparent)',
              border: '1.5px solid var(--card)',
              color: 'var(--on-accent)',
              '&:hover': {
                backgroundColor: 'var(--body)',
                transform: 'scale(1.1)',
              },
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '&:hover': { transform: 'none' },
              },
            }}
          >
            <Close size={10} strokeWidth={1.75} />
          </Box>
        </Tooltip>
      )}

      {/* Pastilles radar flottantes — REPLI quand la brique est trop etroite
          pour le groupe de pastilles blanches (l'info reste toujours visible). */}
      {!showBadgeGroup && missingEmail && (
        <RadarPastille
          color="var(--warn)"
          tooltip="Email voyageur manquant — les messages automatiques ne seront pas envoyés"
          right={-4}
        />
      )}
      {!showBadgeGroup && event.needsPaymentBadge && (
        <RadarPastille
          color={event.paymentBadgeStatus === 'FAILED'
            ? 'color-mix(in srgb, var(--err) 75%, var(--ink))'
            : 'var(--err)'}
          tooltip={paymentTooltip}
          right={missingEmail ? 12 : -4}
        />
      )}

      {/* Resize handle (right edge) — hidden during move drag, respects role permissions */}
      {!isDragDisabled && !isDragging && (
        <ResizeHandle eventId={event.id} event={event} layout={layout} />
      )}
    </Box>
  );
});

PlanningBar.displayName = 'PlanningBar';
export default PlanningBar;
