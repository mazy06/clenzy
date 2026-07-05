import React, { useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { Lock as LockIcon, Close, Warning, BroomFill, WrenchFill, CreditCardFill, CheckBold } from '../../icons';
import { INTERVENTION_TYPE_LABELS } from '../../services/api/reservationsApi';
import type { PlanningInterventionType } from '../../services/api';
import ReservationPopover from './ReservationPopover';
import SendMessageDialog from '../messaging/SendMessageDialog';
import type { BarLayout, PlanningEvent, ZoomLevel, DragBarData } from './types';
import {
  BAR_BORDER_RADIUS,
  INTERVENTION_TYPE_TOKEN_COLORS,
  BAR_PRICE_AMOUNT_MIN as PRICE_AMOUNT_MIN,
  BAR_PRICE_INLINE_MIN as PRICE_INLINE_MIN,
  BAR_FEE_PILL_MIN as FEE_PILL_MIN,
} from './constants';
import { getEventDisplayColor } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';
import { daysBetween } from './utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import { Money } from '../../components/Money';
import GuestAvatar from '../../components/GuestAvatar';
import './planningUrgency.css';

/** Montant compact pour la brique : sans décimales, « ~ » si converti
 *  (même normalisation que les prix par cellule dans PlanningRow). */
function compactMoney(formatted: string): string {
  return formatted.replace(/[.,]\d+/g, '').replace(/^≈\s*/, '~');
}

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
  /** Interventions (menage/maintenance) rattachees a cette reservation —
   *  affichees en pastilles blanches dans la brique (maquette). */
  linkedInterventions?: PlanningEvent[];
  /** Devise SOURCE des montants de la propriété (prix réservation + tarifs
   *  prestation), convertie vers la devise d'affichage. Défaut EUR. */
  currency?: string;
}

/** Icone des interventions. Menage/maintenance sont rendues en pastille
 *  icone (voir branche dediee), seul "blocked" garde son cadenas en bar. */
function getEventIcon(type: PlanningEvent['type'], compact: boolean) {
  const size = compact ? 9 : 12;
  switch (type) {
    case 'blocked': return <LockIcon size={size} strokeWidth={1.75} />;
    default: return null;
  }
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
// (spec .pl-badge — brique 36px, padding 0 7px 0 5px) avec icone coloree 13px
// (paiement, info manquante) ou logo canal.
// Tooltip au survol. Variante "combo" : repli « +N ».
const BAR_BADGE_SIZE = 21;

// Couleurs FIXES (indépendantes du thème) pour le texte/icônes posés sur les
// pastilles TOUJOURS blanches du langage Signature (badges, prix, tarif, « +N »).
// En thème sombre, var(--ink) / var(--unpaid*) s'éclaircissent → texte clair sur
// blanc = illisible. On fige donc les valeurs claires (contraste garanti sur blanc).
const PILL_INK = '#15242D';         // texte neutre (montant prestation, « +N »)
const PILL_UNPAID = '#B25A2A';      // montant non réglé (ambre foncé)
const PILL_UNPAID_ICON = '#C9803F'; // icône carte (non réglé)

const BAR_BADGE_SX = {
  width: BAR_BADGE_SIZE,
  height: BAR_BADGE_SIZE,
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
  currency,
}) => {
  const { event, left, top, height } = layout;
  const isIntervention = event.type !== 'reservation';
  const isReservation = event.type === 'reservation';
  const isCancelled = isReservation && event.status === 'cancelled';

  // Role check: only SUPER_ADMIN, SUPER_MANAGER, or org ADMIN can drag interventions
  const { user } = useAuth();
  // Devise d'affichage : convertit les montants (stockés dans la devise de la
  // propriété, défaut EUR) vers la devise de l'utilisateur. Appelé
  // inconditionnellement — avant tout early return.
  const { convertAndFormat } = useCurrency();
  const srcCurrency = currency ?? 'EUR';
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

  // ── Popover réservation (maquette) : ouvert au clic sur la brique ────────
  // « Détail » rouvre le panneau existant, « Message » la messagerie existante.
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  // Tooltip « +N » (indicateurs repliés) : ouvert au survol (Tooltip MUI)
  // ET au clic/clavier sur la pastille — état contrôlé pour combiner les deux.
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Use resizeWidth if this bar is being resized, otherwise original width
  const isResizing = resizeWidth !== null;
  const displayWidth = resizeWidth ?? layout.width;

  // ── Intervention ménage/maintenance : pastille icône seule (maquette) ────
  // Plus de chip MÉNAGE/MAINTENANCE sur la grille : seule une intervention
  // véritablement ORPHELINE (réservation liée absente des données chargées —
  // cf. règle unique dans PlanningRow) est posée à sa date sous forme de
  // pastille blanche 21×21 avec l'icône du type
  // (balai = ménage --menage, clé = maintenance --maintenance), sans
  // étiquette texte. Clic = détail intervention existant, drag conservé.
  if (event.type === 'cleaning' || event.type === 'maintenance') {
    const isCleaning = event.type === 'cleaning';
    const typeLabel = INTERVENTION_TYPE_LABELS[event.type as PlanningInterventionType];
    const tooltipTitle = [
      typeLabel,
      event.label && event.label !== typeLabel ? event.label : null,
      event.sublabel,
    ].filter(Boolean).join(' — ');
    return (
      <Tooltip title={tooltipTitle} arrow>
        <Box
          ref={setNodeRef}
          data-planning-bar
          {...(!isDragDisabled ? listeners : {})}
          {...(!isDragDisabled ? attributes : {})}
          onClick={(e) => {
            if (isDragActive) return;
            e.stopPropagation();
            onClick(event);
          }}
          sx={{
            position: 'absolute',
            left: left + 2,
            top: top + (height - BAR_BADGE_SIZE) / 2,
            ...BAR_BADGE_SX,
            border: '1px solid var(--line)',
            color: isCleaning
              ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning
              : INTERVENTION_TYPE_TOKEN_COLORS.maintenance,
            cursor: 'pointer',
            touchAction: 'none',
            userSelect: 'none',
            opacity: isDragging ? 0.3 : 1,
            // Spec .pl-bar.sel : z-index 7 (au-dessus de la ligne « maintenant »)
            zIndex: isSelected ? 7 : 2,
            transition: isDragging ? 'none' : 'transform .12s, box-shadow .12s',
            // Spec .pl-bar:hover : translateY(-1px) + shadow, z-5
            '&:hover': {
              boxShadow: '0 7px 16px -8px var(--shadow-pop)',
              transform: 'translateY(-1px)',
              zIndex: 5,
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              '&:hover': { transform: 'none' },
            },
            ...(isSelected && {
              boxShadow: '0 0 0 2px var(--card), 0 0 0 4px var(--accent)',
            }),
            ...(isConflict && {
              boxShadow: '0 0 0 2px var(--err)',
            }),
          }}
        >
          {isCleaning
            ? <BroomFill size={14} />
            : <WrenchFill size={13} />}
        </Box>
      </Tooltip>
    );
  }

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

  // Avatar voyageur (rond initiales) — affiché si la brique est assez large.
  const showAvatar = isReservation && displayWidth > 90 && height >= 32;

  const paymentTooltip = event.paymentBadgeStatus === 'FAILED'
    ? 'Paiement échoué'
    : event.paymentBadgeStatus === 'PROCESSING'
      ? 'Paiement en cours de traitement'
      : 'Paiement en attente';

  // ── Prix réservation (pilule .pl-price) — toujours affiché, couleur = état ─
  // Montant stocké en EUR, converti vers la devise d'affichage. L'état réutilise
  // needsPaymentBadge (déjà neutre pour les OTA réglés / séjours terminés) :
  // « non réglé » = blanc + montant ambre + carte ; « réglé / OTA » = verre
  // translucide + check. La pilule absorbe l'ancien badge paiement séparé.
  const totalPrice = isReservation ? event.reservation?.totalPrice ?? null : null;
  const hasPrice = totalPrice != null && totalPrice > 0;
  const priceUnpaid = !!event.needsPaymentBadge;
  const priceLabel = hasPrice ? compactMoney(convertAndFormat(totalPrice, srcCurrency)) : '';
  const priceFull = hasPrice ? convertAndFormat(totalPrice, srcCurrency) : '';
  const showPrice = hasPrice && height >= 28;
  const priceAmountVisible = showPrice && displayWidth >= PRICE_AMOUNT_MIN; // icône + montant
  const priceInline = showPrice && displayWidth >= PRICE_INLINE_MIN;        // pilule sur la ligne
  const priceFolded = showPrice && !priceInline;                           // → « +N »
  // Brique medium (PRICE_INLINE_MIN..PRICE_AMOUNT_MIN) : le prix prend la ligne,
  // tout le reste (tarif, alerte, logo canal) se replie dans un unique « +N ».
  const compactRightZone = priceInline && !priceAmountVisible;

  // ── Indicateurs (info manquante + tarif prestation) ───────────────────────
  const missingEmail = isReservation && !!event.reservation && !event.reservation.guestEmail && !isCancelled;
  const indicators: {
    key: string;
    /** Libellé pour la liste du « +N ». */
    label: string;
    tooltip: string;
    color: string;
    icon: React.ReactNode;
    /** Tarif de prestation formaté (libellé « +N ») → pilule .pl-badge--fee si présent. */
    fee?: string;
    /** Montant brut du tarif (devise propriété) — rendu en pilule via <Money>. */
    feeRaw?: number;
    onClick?: (e: React.MouseEvent) => void;
  }[] = [];
  if (missingEmail) {
    indicators.push({
      key: 'miss',
      label: 'Infos client manquantes',
      tooltip: 'Email voyageur manquant — les messages automatiques ne seront pas envoyés',
      color: 'var(--warn)',
      icon: <Warning size={13} strokeWidth={2} />,
    });
  }
  // Interventions rattachées : pastille du type (balai = ménage, clé =
  // maintenance), cliquable → détail. Avec un tarif, elle s'élargit en pilule
  // « icône + montant » (.pl-badge--fee) ; sinon elle reste le carré-icône.
  for (const linked of linkedInterventions ?? []) {
    const isCleaning = linked.type === 'cleaning';
    const typeLabel = INTERVENTION_TYPE_LABELS[(isCleaning ? 'cleaning' : 'maintenance') as PlanningInterventionType];
    const rawFee = linked.intervention?.actualCost || linked.intervention?.estimatedCost || linked.serviceRequest?.estimatedCost || 0;
    const feeLabel = rawFee > 0 ? compactMoney(convertAndFormat(rawFee, srcCurrency)) : undefined;
    indicators.push({
      key: linked.id,
      label: feeLabel ? `${typeLabel} · ${feeLabel}` : typeLabel,
      tooltip: linked.label && linked.label !== typeLabel ? `${typeLabel} — ${linked.label}` : typeLabel,
      color: isCleaning
        ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning
        : INTERVENTION_TYPE_TOKEN_COLORS.maintenance,
      icon: isCleaning
        ? <BroomFill size={14} />
        : <WrenchFill size={13} />,
      fee: feeLabel,
      feeRaw: rawFee > 0 ? rawFee : undefined,
      onClick: (e) => {
        e.stopPropagation();
        onClick(linked);
      },
    });
  }

  // Pastilles blanches inline (langage maquette). Seuil bas (56px = une
  // pastille 20px + padding) : les interventions absorbées restent TOUJOURS
  // représentées — sur brique étroite elles comptent dans le « +N ». Sur brique
  // medium (compactRightZone), tout se replie pour laisser la place au prix.
  const showBadgeGroup = isReservation && displayWidth > 56 && height >= 28;
  const indicatorSlots = compactRightZone ? 0 : (displayWidth > (priceInline ? 220 : 175) ? 2 : 1);
  const shownIndicators = indicators.length <= indicatorSlots
    ? indicators
    : indicators.slice(0, Math.max(0, indicatorSlots - 1));
  const hiddenIndicators = indicators.slice(shownIndicators.length);

  // ── Repli « +N » : prix réservation (si replié) > tarif prestation > canal ──
  // Le canal rejoint la liste si sa pastille logo n'a pas la place d'être
  // affichée (brique étroite ou medium) : « Canal : Airbnb ».
  const channelFolded = !!sourceLogo && (displayWidth <= 60 || compactRightZone);
  const overflowItems: { key: string; label: string; color?: string; icon: React.ReactNode }[] = [
    ...(priceFolded
      ? [{
          key: 'price',
          label: priceUnpaid ? `${paymentTooltip} · ${priceLabel}` : `Réglé · ${priceLabel}`,
          color: priceUnpaid ? 'var(--unpaid-strong)' : 'var(--paid)',
          icon: priceUnpaid ? <CreditCardFill size={13} /> : <CheckBold size={12} />,
        }]
      : []),
    ...hiddenIndicators.map(({ key, label, color, icon }) => ({ key, label, color, icon })),
    ...(channelFolded
      ? [{
          key: 'channel',
          label: `Canal : ${event.sublabel || '—'}`,
          icon: (
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '5px',
                backgroundColor: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                component="img"
                src={sourceLogo!}
                alt=""
                sx={{ width: 11, height: 11, objectFit: 'contain', display: 'block' }}
              />
            </Box>
          ),
        }]
      : []),
  ];

  // Only reduce opacity for move drag, not resize
  const draggedOpacity = isDragging ? 0.3 : 1;

  // ── Animation d'urgence (galerie 09b) : anneau pulsé permanent à la couleur
  // de la brique + mouvement périodique ~4s sélectionné par l'attribut racine
  // [data-wizz] sur <html> (posé par useUrgencyAnimation — le CSS fait le
  // reste, la brique ne porte que la classe .pl-urgent). Uniquement sur les
  // réservations en urgence (paiement en attente OU info voyageur manquante),
  // hors annulées. Suspendue quand la brique est sélectionnée / en conflit /
  // draggée (leurs anneaux et animations propres priment).
  const isPopoverActive = popoverAnchor !== null;
  const isUrgent = isReservation && !isCancelled && (event.needsPaymentBadge || missingEmail);
  const urgencyClass = isUrgent
    && !isSelected && !isPopoverActive && !isConflict && !resizeConflict && !isDragging && !isResizing
    ? 'pl-urgent'
    : undefined;

  return (
    <>
    <Box
      ref={setNodeRef}
      data-planning-bar
      data-reservation-id={isReservation && event.reservation ? String(event.reservation.id) : undefined}
      className={urgencyClass}
      style={isUrgent ? ({ '--bc': barColor } as React.CSSProperties) : undefined}
      {...(!isDragDisabled ? listeners : {})}
      {...(!isDragDisabled ? attributes : {})}
      onClick={(e) => {
        // Don't trigger click if a drag just happened
        if (isDragActive) return;
        e.stopPropagation();
        // Réservation : popover récap ancré à la brique (maquette). Le
        // panneau de détail existant s'ouvre via le bouton « Détail ».
        if (isReservation) {
          setPopoverAnchor(e.currentTarget as HTMLElement);
          return;
        }
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
        // Spec .pl-bar : padding 0 7px 0 5px (avatar collé à gauche,
        // pastilles collées à droite).
        padding: isReservation ? '0 7px 0 5px' : (showLabel ? '0 6px' : 0),
        // Spec .pl-bar : transition transform .12s, box-shadow .12s
        // (+ width pour le feedback resize, spécifique timeline).
        transition: (isDragging || isResizing) ? 'none' : 'transform .12s, box-shadow .12s, width .12s',
        userSelect: 'none',
        opacity: draggedOpacity,
        // Spec .pl-bar.sel : z-index 7 (au-dessus de la ligne « maintenant »)
        zIndex: isSelected ? 7 : isIntervention ? 2 : 3,
        // Spec .pl-bar:hover : translateY(-1px) + shadow, z-5.
        '&:hover': {
          boxShadow: '0 7px 16px -8px var(--shadow-pop)',
          transform: 'translateY(-1px)',
          zIndex: 5,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
        // Spec .pl-bar.cancelled:hover : brique fantôme inerte (pas de lift
        // ni d'ombre au survol).
        ...(isCancelled && {
          '&:hover': { transform: 'none', boxShadow: 'none' },
        }),
        // Brique active (popover ouvert) : anneau accent + offset blanc.
        ...(isPopoverActive && !isSelected && {
          boxShadow: '0 0 0 2px var(--card), 0 0 0 4px var(--accent)',
        }),
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
            // Spec .pl-bar : gap 7px entre avatar / texte / pastilles.
            gap: '7px',
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
          {/* Avatar voyageur : rond 26px (spec .pl-bar__av), bord clair,
              initiales 9.5px fw700. Pas de pastille d'alerte dessus (les
              alertes sont portées par les pastilles à droite). Cède la place
              au prix sur brique medium (priorité nom > prix > … du repli). */}
          {showAvatar && !compactRightZone && (
            <GuestAvatar
              name={event.label}
              photoUrl={event.reservation?.guestAvatarUrl}
              size={26}
              sx={{
                border: '1.5px solid rgba(255,255,255,.55)',
                backgroundColor: 'rgba(255,255,255,.22)',
                fontSize: '9.5px',
                color: isCancelled ? 'var(--muted)' : '#fff',
                ...(isCancelled && {
                  filter: 'grayscale(1)',
                  opacity: 0.6,
                  borderColor: 'var(--line-2)',
                }),
              }}
            />
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
            {/* Ligne 2 (spec .pl-bar__g) : nom du voyageur — 12px fw600 */}
            {showLabel && (
              <Box
                component="span"
                sx={{
                  fontSize: '12px',
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
          {/* Prix réservation (pilule .pl-price) — toujours visible quand la
              brique a la place ; couleur = état paiement. Sous PRICE_AMOUNT_MIN
              le montant se masque (icône d'état seule, .is-narrow). */}
          {priceInline && (
            <Tooltip
              arrow
              title={priceUnpaid ? `${paymentTooltip} · ${priceFull}` : `Réglé · ${priceFull}`}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                  height: 21,
                  padding: priceAmountVisible ? '0 8px' : '0 6px',
                  borderRadius: '7px',
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-.01em',
                  whiteSpace: 'nowrap',
                  // Couleur = sens : non réglé = blanc + ambre + carte ;
                  // réglé/OTA = verre translucide + check ; annulé = neutre.
                  ...(priceUnpaid
                    ? {
                        backgroundColor: '#fff',
                        color: PILL_UNPAID,
                        boxShadow: '0 1px 2px rgba(0,0,0,.14)',
                      }
                    : isCancelled
                      ? {
                          backgroundColor: 'var(--surface-2)',
                          color: 'var(--muted)',
                          boxShadow: 'inset 0 0 0 1px var(--line-2)',
                        }
                      : {
                          // Verre SOMBRE (et non clair) : un check / montant blanc
                          // reste lisible sur TOUTES les couleurs de brique, y
                          // compris les plus claires (ambre, vert) où le verre clair
                          // d'origine se confondait avec le fond.
                          backgroundColor: 'rgba(0,0,0,.20)',
                          color: '#fff',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.22)',
                        }),
                  '& > .pl-price-ic': {
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: priceUnpaid ? PILL_UNPAID_ICON : 'inherit',
                  },
                }}
              >
                <Box component="span" className="pl-price-ic">
                  {priceUnpaid ? <CreditCardFill size={13} /> : <CheckBold size={12} />}
                </Box>
                {priceAmountVisible && (
                  <Box component="span">
                    <Money value={totalPrice} from={srcCurrency} compact symbolSize={11} symbolSx={{ ml: '2px' }} />
                  </Box>
                )}
              </Box>
            </Tooltip>
          )}
          {/* Pastilles a droite : indicateurs (+N) + logo canal */}
          {(showBadgeGroup || (sourceLogo && displayWidth > 60)) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {showBadgeGroup && shownIndicators.map((it) => {
                // Tarif de prestation : pilule « icône + montant » quand la
                // brique est large ; sinon carré-icône d'origine (.is-narrow).
                const asFeePill = !!it.fee && displayWidth >= FEE_PILL_MIN;
                return (
                  <Tooltip key={it.key} title={it.tooltip} arrow>
                    <Box
                      onClick={it.onClick}
                      {...(it.onClick && {
                        role: 'button',
                        tabIndex: 0,
                        'aria-label': it.tooltip,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            it.onClick?.(e as unknown as React.MouseEvent);
                          }
                        },
                      })}
                      sx={{
                        ...BAR_BADGE_SX,
                        ...(asFeePill && {
                          width: 'auto',
                          minWidth: BAR_BADGE_SIZE,
                          padding: '0 7px 0 5px',
                          gap: '4px',
                        }),
                        color: it.color,
                        ...(it.onClick && {
                          cursor: 'pointer',
                          '&:focus-visible': {
                            outline: '2px solid var(--accent)',
                            outlineOffset: 1,
                          },
                        }),
                      }}
                    >
                      {it.icon}
                      {asFeePill && (
                        <Box
                          component="span"
                          sx={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-.01em',
                            color: PILL_INK,
                          }}
                        >
                          <Money value={it.feeRaw} from={srcCurrency} compact symbolSize={10} />
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
              {showBadgeGroup && overflowItems.length > 0 && (
                <Tooltip
                  arrow
                  // Contrôlé : le survol (onOpen/onClose MUI) ET le clic /
                  // clavier ouvrent le même tooltip thémé Signature (style
                  // MuiTooltip global : fond var(--ink), texte var(--bg), r8).
                  open={overflowOpen}
                  onOpen={() => setOverflowOpen(true)}
                  onClose={() => setOverflowOpen(false)}
                  title={
                    <Box
                      component="ul"
                      sx={{
                        listStyle: 'none',
                        m: 0,
                        p: '2px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                      }}
                    >
                      {overflowItems.map((it) => (
                        <Box
                          component="li"
                          key={it.key}
                          sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 16,
                              flexShrink: 0,
                              color: it.color,
                            }}
                          >
                            {it.icon}
                          </Box>
                          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                            {it.label}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  }
                >
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`${overflowItems.length} ${overflowItems.length > 1 ? 'indicateurs masqués' : 'indicateur masqué'} : ${overflowItems.map((it) => it.label).join(', ')}`}
                    onClick={(e) => {
                      // Ne déclenche PAS le popover réservation de la brique.
                      e.stopPropagation();
                      setOverflowOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setOverflowOpen((o) => !o);
                      }
                    }}
                    sx={{
                      ...BAR_BADGE_SX,
                      // Spec .s-brick__badge.combo
                      backgroundColor: 'rgba(255,255,255,.9)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: PILL_INK,
                      cursor: 'pointer',
                      '&:focus-visible': {
                        outline: '2px solid var(--accent)',
                        outlineOffset: 1,
                      },
                    }}
                  >
                    +{overflowItems.length}
                  </Box>
                </Tooltip>
              )}
              {sourceLogo && displayWidth > 60 && !compactRightZone && (
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

      {/* ── BLOCAGE (blocked) : layout inline, icone cadenas seule.
          Menage/maintenance sont rendues en pastille (branche dediee). */}
      {!isReservation && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            width: '100%',
            height: '100%',
            color: 'var(--on-accent)',
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
          }}
        >
          {icon && (
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
          )}
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

    {/* Popover récap réservation (portail — hors de la zone draggable) */}
    {isReservation && event.reservation && popoverAnchor && (
      <ReservationPopover
        anchorEl={popoverAnchor}
        event={event}
        linkedInterventions={linkedInterventions}
        onClose={() => setPopoverAnchor(null)}
        onDetail={() => {
          setPopoverAnchor(null);
          onClick(event);
        }}
        onMessage={() => {
          setPopoverAnchor(null);
          setMessageOpen(true);
        }}
      />
    )}

    {/* Messagerie voyageur existante (même dialog que le panneau d'actions) */}
    {isReservation && event.reservation && messageOpen && (
      <SendMessageDialog
        open
        reservationId={event.reservation.id}
        guestName={event.reservation.guestName}
        onClose={() => setMessageOpen(false)}
      />
    )}
    </>
  );
});

PlanningBar.displayName = 'PlanningBar';
export default PlanningBar;
