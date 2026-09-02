import { guestPhotoSrc } from '../../services/api/guestsApi';
import React, { useState } from 'react';
import { Tooltip, TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui';
import { cn } from '../../utils/cn';
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
import { getEventDisplayColor, getEventInkColor, hasDarkInk } from './utils/colorUtils';
import { getSourceLogo } from './utils/sourceLogos';
import { daysBetween } from './utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import { Money } from '../../components/Money';
import GuestAvatar from '../../components/GuestAvatar';
import './planningUrgency.css';

// Les trois @keyframes de la brique vivaient dans le `sx` MUI, qui les injectait
// lui-meme dans le document. Sans MUI il faut une vraie feuille de style : on la
// pose une seule fois au chargement du module (idempotent), les classes
// `animate-[nom_…]` peuvent alors s'y referer.
const BAR_KEYFRAMES_ID = 'planning-bar-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(BAR_KEYFRAMES_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = BAR_KEYFRAMES_ID;
  styleEl.textContent = [
    '@keyframes radar-pulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.6);opacity:0}}',
    '@keyframes select-pop{0%{transform:scale(1) translateY(0)}40%{transform:scale(1.05) translateY(-2px)}100%{transform:scale(1) translateY(-1px)}}',
    '@keyframes pulse-conflict{0%,100%{box-shadow:0 0 0 2px var(--err)}50%{box-shadow:0 0 0 2px color-mix(in srgb, var(--err) 50%, transparent)}}',
  ].join('\n');
  document.head.appendChild(styleEl);
}

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
  <TooltipRoot>
    <TooltipTrigger asChild>
      <div className="absolute top-[-3px] w-[10px] h-[10px] z-[12]" style={{ right }}>
        {/* Anneau 1 (pulse continu) */}
        <div
          className="absolute inset-0 rounded-[50%] pointer-events-none animate-[radar-pulse_1.6s_cubic-bezier(0,0,0.2,1)_infinite] motion-reduce:animate-none motion-reduce:opacity-0"
          style={{ backgroundColor: color }}
        />
        {/* Anneau 2 (decale de 0.8s pour un effet continu) */}
        <div
          className="absolute inset-0 rounded-[50%] pointer-events-none animate-[radar-pulse_1.6s_cubic-bezier(0,0,0.2,1)_0.8s_infinite] motion-reduce:animate-none motion-reduce:opacity-0"
          style={{ backgroundColor: color }}
        />
        {/* Point central solide */}
        <div className="absolute inset-0 rounded-[50%] border-[1.5px] border-solid border-[var(--card)]" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </TooltipRoot>
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

// Pendant en classes de l'ancien BAR_BADGE_SX (21x21, r7, fond blanc, ombre douce).
const BAR_BADGE_CLS =
  'w-[21px] h-[21px] rounded-[7px] bg-[#fff] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,.14)]';

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
    <div
      ref={setNodeRef}
      {...attributes}
      onPointerDown={handlePointerDown}
      className="absolute right-0 top-0 w-[8px] h-full cursor-col-resize z-10 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
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
      // Branche intervention : elle sort avant le provider de la brique et ne
      // porte qu'UNE infobulle. Le `Tooltip` auto-enveloppant du kit est ici le
      // bon choix — mutualiser un provider pour un seul root n'economise rien.
      <Tooltip>
        <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          data-planning-bar
          {...(!isDragDisabled ? listeners : {})}
          {...(!isDragDisabled ? attributes : {})}
          onClick={(e) => {
            if (isDragActive) return;
            e.stopPropagation();
            onClick(event);
          }}
          // left/top et la couleur du type (lookup dans un Record) sont des
          // valeurs d'execution : aucune classe Tailwind ne peut les porter.
          style={{
            left: left + 2,
            top: top + (height - BAR_BADGE_SIZE) / 2,
            color: isCleaning
              ? INTERVENTION_TYPE_TOKEN_COLORS.cleaning
              : INTERVENTION_TYPE_TOKEN_COLORS.maintenance,
          }}
          className={cn(
            'absolute',
            BAR_BADGE_CLS,
            'border border-solid border-[var(--line)] cursor-pointer touch-none select-none',
            // Spec .pl-bar:hover : translateY(-1px) + shadow, z-5
            'hover:shadow-[0_7px_16px_-8px_var(--shadow-pop)] hover:-translate-y-px hover:z-[5]',
            'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
            isDragging ? 'opacity-30 transition-none' : 'opacity-100 transition-[transform,box-shadow] duration-[120ms]',
            // Spec .pl-bar.sel : z-index 7 (au-dessus de la ligne « maintenant »)
            isSelected ? 'z-[7]' : 'z-[2]',
            isSelected && 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--accent)]',
            isConflict && 'shadow-[0_0_0_2px_var(--err)]',
          )}
        >
          {isCleaning
            ? <BroomFill size={14} />
            : <WrenchFill size={13} />}
        </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipTitle}</TooltipContent>
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
  // Encre de la brique. Elle etait figee sur var(--on-accent) : la palette
  // « Terre cuite » va du beige au brun fonce, un blanc constant disparaitrait
  // sur les valeurs claires. Les briques pales portent donc une encre foncee,
  // et tout ce qui se pose PAR-DESSUS (avatar, pastille de prix) s'aligne sur
  // elle plutot que de presumer un fond sombre.
  const barInk = getEventInkColor(event);
  const darkInk = hasDarkInk(event);

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
            <div className="w-[16px] h-[16px] rounded-[5px] bg-[#fff] flex items-center justify-center">
              <img className="w-[11px] h-[11px] object-contain block" src={sourceLogo!} alt="" />
            </div>
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
    // UN provider d'infobulles par brique, et non un par infobulle.
    //
    // `Tooltip` du kit s'auto-enveloppe : pratique a l'unite, ruineux en liste.
    // La brique en compte jusqu'a sept, et le planning en monte plus de trois
    // cents d'emblee — soit pres d'un millier de contextes imbriques, tous
    // re-rendus a chaque extension du buffer. Les infobulles internes passent
    // donc par `TooltipRoot`, qui n'en cree aucun.
    //
    // Le provider reste DANS la brique plutot qu'autour de la grille : Radix
    // leve une erreur si la racine n'en trouve pas, et une brique rendue hors
    // grille (tests, apercu) planterait. On divise par sept sans rendre le
    // composant dependant de son parent. Le provider ne rend aucun DOM.
    <TooltipProvider>
    <>
    <div
      ref={setNodeRef}
      data-planning-bar
      data-reservation-id={isReservation && event.reservation ? String(event.reservation.id) : undefined}
      className={cn(
        urgencyClass,
        'absolute flex touch-none select-none overflow-visible',
        isCancelled
          ? 'bg-[var(--surface-2)] border-[1.5px] border-dashed border-[var(--line-2)]'
          : 'border-none',
        isResizing ? 'cursor-col-resize' : 'cursor-pointer',
        // Reservations en COLUMN (nuits + nom), interventions ROW.
        isReservation ? 'flex-col items-stretch justify-center gap-0' : 'flex-row items-center',
        !isReservation && (showLabel ? 'justify-start gap-[3px]' : 'justify-center gap-0'),
        // Spec .pl-bar : padding 0 7px 0 5px (avatar colle a gauche, pastilles a droite).
        isReservation ? 'p-[0_7px_0_5px]' : (showLabel ? 'px-[6px] py-0' : 'p-0'),
        // Spec .pl-bar : transition transform .12s, box-shadow .12s (+ width pour le resize).
        (isDragging || isResizing)
          ? 'transition-none'
          : 'transition-[transform,box-shadow,width] duration-[120ms] motion-reduce:transition-none',
        // Spec .pl-bar.sel : z-index 7 (au-dessus de la ligne « maintenant »).
        isSelected ? 'z-[7]' : isIntervention ? 'z-[2]' : 'z-[3]',
        // Spec .pl-bar:hover : translateY(-1px) + shadow, z-5.
        'hover:shadow-[0_7px_16px_-8px_var(--shadow-pop)] hover:-translate-y-px hover:z-[5] motion-reduce:hover:translate-y-0',
        // Brique active (popover ouvert) : anneau accent + offset blanc.
        (isPopoverActive && !isSelected) && 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--accent)]',
        isSelected && 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--accent)] -translate-y-px animate-[select-pop_0.3s_ease-out] motion-reduce:animate-none motion-reduce:translate-y-0',
        (isConflict || resizeConflict) && 'shadow-[0_0_0_2px_var(--err)] animate-[pulse-conflict_2s_ease-in-out_infinite] motion-reduce:animate-none',
        // Spec .pl-bar.cancelled:hover : brique fantome inerte (ni lift ni ombre).
        isCancelled && 'hover:translate-y-0 hover:shadow-none',
      )}
      // Geometrie, couleur de statut et opacite de drag sont resolues a
      // l'execution : aucune classe Tailwind ne peut les porter.
      style={{
        left,
        top,
        width: displayWidth,
        height,
        borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px`,
        opacity: draggedOpacity,
        ...(isCancelled
          ? { backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--muted) 22%, transparent) 0 1.5px, transparent 1.5px 8px)' }
          : { backgroundColor: barColor }),
        ...(isUrgent ? ({ '--bc': barColor } as React.CSSProperties) : {}),
      }}
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
    >
      {/* ── RESERVATION : avatar + 2 lignes (nuits + nom) + pastilles ────── */}
      {isReservation && (
        // Spec .pl-bar : gap 7px entre avatar / texte / pastilles. Le clip du
        // contenu se fait ici, l'overflow visible reste sur le parent (radar).
        <div
          className={cn(
            'flex flex-row items-center justify-between gap-[7px] w-full h-full min-w-0 overflow-hidden',
            isCancelled && 'text-[var(--muted)]',
          )}
          // L'encre depend du statut : `text-[var(--on-accent)]` etait un blanc
          // constant, invisible sur les briques pales de la palette.
          style={{ borderRadius: `${BAR_BORDER_RADIUS}px`, ...(isCancelled ? {} : { color: barInk }) }}
        >
          {/* Avatar voyageur : rond 26px (spec .pl-bar__av), bord clair,
              initiales 9.5px fw700. Pas de pastille d'alerte dessus (les
              alertes sont portées par les pastilles à droite). Cède la place
              au prix sur brique medium (priorité nom > prix > … du repli). */}
          {showAvatar && !compactRightZone && (
            <GuestAvatar
              name={event.label}
              photoUrl={guestPhotoSrc(event.reservation?.guestAvatarUrl)}
              size={26}
              sx={{
                // Voiles tires de l'ENCRE : sur une brique beige, un liseré
                // blanc translucide ne se voit pas.
                border: `1.5px solid ${darkInk ? 'rgba(43,33,26,.30)' : 'rgba(255,255,255,.55)'}`,
                backgroundColor: darkInk ? 'rgba(43,33,26,.12)' : 'rgba(255,255,255,.22)',
                fontSize: '9.5px',
                color: isCancelled ? 'var(--muted)' : barInk,
                ...(isCancelled && {
                  filter: 'grayscale(1)',
                  opacity: 0.6,
                  borderColor: 'var(--line-2)',
                }),
              }}
            />
          )}
          {/* Spec .s-brick__t : colonne centrée, line-height 1.2. */}
          <div className="min-w-0 flex-1 flex flex-col justify-center leading-[1.2]">
            {/* Ligne 1 (spec .s-brick__n) : nombre de nuits — 9.5px fw600 */}
            <span className="text-[9.5px] font-semibold opacity-85 whitespace-nowrap overflow-hidden text-ellipsis">
              {nights} {nights > 1 ? 'nuits' : 'nuit'}
            </span>
            {/* Ligne 2 (spec .pl-bar__g) : nom du voyageur — 12px fw600 */}
            {showLabel && (
              <span
                className={cn(
                  'text-[12px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis',
                  isCancelled && 'line-through',
                )}
              >
                {event.label}
              </span>
            )}
          </div>
          {/* Prix réservation (pilule .pl-price) — toujours visible quand la
              brique a la place ; couleur = état paiement. Sous PRICE_AMOUNT_MIN
              le montant se masque (icône d'état seule, .is-narrow). */}
          {priceInline && (
            <TooltipRoot>
              <TooltipTrigger asChild>
              <div
                // PILL_UNPAID / PILL_UNPAID_ICON sont des constantes locales :
                // posees en style pour ne pas dupliquer leur valeur en classe.
                style={{ fontFamily: 'var(--font-display)', ...(priceUnpaid ? { color: PILL_UNPAID } : {}) }}
                className={cn(
                  'inline-flex items-center gap-[4px] shrink-0 h-[21px] rounded-[7px] text-[11px] font-bold tabular-nums tracking-[-.01em] whitespace-nowrap',
                  priceAmountVisible ? 'px-[8px]' : 'px-[6px]',
                  // Couleur = sens : non réglé = blanc + ambre + carte ;
                  // réglé/OTA = verre translucide + check ; annulé = neutre.
                  priceUnpaid
                    ? 'bg-[#fff] shadow-[0_1px_2px_rgba(0,0,0,.14)]'
                    : isCancelled
                      ? 'bg-[var(--surface-2)] text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)]'
                      // Le verre suit l'encre de la brique. Un verre sombre +
                      // texte blanc tenait sur les fonds soutenus ; sur le
                      // beige et le taupe de la palette « Terre cuite » le
                      // blanc s'efface, on inverse donc le régime.
                      : darkInk
                        ? 'bg-[rgba(255,255,255,.55)] shadow-[inset_0_0_0_1px_rgba(43,33,26,.18)]'
                        : 'bg-[rgba(0,0,0,.20)] text-[#fff] shadow-[inset_0_0_0_1px_rgba(255,255,255,.22)]',
                )}
              >
                <span
                  className="pl-price-ic inline-flex items-center"
                  style={{ color: priceUnpaid ? PILL_UNPAID_ICON : 'inherit' }}
                >
                  {priceUnpaid ? <CreditCardFill size={13} /> : <CheckBold size={12} />}
                </span>
                {priceAmountVisible && (
                  <span>
                    <Money value={totalPrice} from={srcCurrency} compact symbolSize={11} symbolSx={{ ml: '2px' }} />
                  </span>
                )}
              </div>
              </TooltipTrigger>
              <TooltipContent>
                {priceUnpaid ? `${paymentTooltip} · ${priceFull}` : `Réglé · ${priceFull}`}
              </TooltipContent>
            </TooltipRoot>
          )}
          {/* Pastilles a droite : indicateurs (+N) + logo canal */}
          {(showBadgeGroup || (sourceLogo && displayWidth > 60)) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {showBadgeGroup && shownIndicators.map((it) => {
                // Tarif de prestation : pilule « icône + montant » quand la
                // brique est large ; sinon carré-icône d'origine (.is-narrow).
                const asFeePill = !!it.fee && displayWidth >= FEE_PILL_MIN;
                return (
                  <TooltipRoot key={it.key}>
                    <TooltipTrigger asChild>
                    <div
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
                      // it.color est resolu a l'execution (token du type d'intervention).
                      style={{ color: it.color }}
                      className={cn(
                        BAR_BADGE_CLS,
                        asFeePill && 'w-auto min-w-[21px] p-[0_7px_0_5px] gap-[4px]',
                        it.onClick && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1',
                      )}
                    >
                      {it.icon}
                      {asFeePill && (
                        <span className="text-[10.5px] font-bold tabular-nums tracking-[-.01em]" style={{ fontFamily: 'var(--font-display)', color: PILL_INK }}>
                          <Money value={it.feeRaw} from={srcCurrency} compact symbolSize={10} />
                        </span>
                      )}
                    </div>
                    </TooltipTrigger>
                    <TooltipContent>{it.tooltip}</TooltipContent>
                  </TooltipRoot>
                );
              })}
              {showBadgeGroup && overflowItems.length > 0 && (
                <TooltipRoot
                  // Contrôlé : le survol (onOpenChange) ET le clic / clavier
                  // ouvrent le même tooltip.
                  open={overflowOpen}
                  onOpenChange={setOverflowOpen}
                >
                  <TooltipTrigger asChild>
                  <div
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
                    style={{ fontFamily: 'var(--font-display)', color: PILL_INK }}
                    className={cn(
                      BAR_BADGE_CLS,
                      // Spec .s-brick__badge.combo
                      'bg-[rgba(255,255,255,.9)] text-[10px] font-bold cursor-pointer',
                      'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1',
                    )}
                  >
                    +{overflowItems.length}
                  </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="list-none m-0 p-[2px_0] flex flex-col gap-[5px]">
                      {overflowItems.map((it) => (
                        <li className="flex items-center gap-[7px]" key={it.key}>
                          <div className="flex items-center justify-center w-[16px] shrink-0" style={{ color: it.color }}>
                            {it.icon}
                          </div>
                          <span className="whitespace-nowrap">
                            {it.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </TooltipRoot>
              )}
              {sourceLogo && displayWidth > 60 && !compactRightZone && (() => {
                const logoBadge = (
                  <div className={BAR_BADGE_CLS}>
                    <img
                      src={sourceLogo}
                      alt={event.sublabel || ''}
                      className={cn(
                        'w-[13px] h-[13px] object-contain block',
                        isCancelled && 'grayscale opacity-70',
                      )}
                    />
                  </div>
                );
                // Sans libelle de canal, pas de tooltip : Radix afficherait une
                // bulle vide la ou MUI n'affichait rien.
                if (!event.sublabel) return logoBadge;
                return (
                  <TooltipRoot>
                    <TooltipTrigger asChild>{logoBadge}</TooltipTrigger>
                    <TooltipContent>{event.sublabel}</TooltipContent>
                  </TooltipRoot>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── BLOCAGE (blocked) : layout inline, icone cadenas seule.
          Menage/maintenance sont rendues en pastille (branche dediee). */}
      {!isReservation && (
        // gap 0.5 = 3px (theme.spacing = 6) ; le rayon suit une constante partagee.
        <div
          style={{ borderRadius: `${isCompactBar ? 3 : BAR_BORDER_RADIUS}px` }}
          className="flex flex-row items-center justify-center gap-[3px] w-full h-full text-[var(--on-accent)] min-w-0 overflow-hidden"
        >
          {icon && (
            <div className="text-[var(--on-accent)] shrink-0 flex items-center opacity-95">
              {icon}
            </div>
          )}
        </div>
      )}

      {/* Hide button for cancelled reservations — always visible, badge-style top-right */}
      {isReservation && event.status === 'cancelled' && onHide && (
        <TooltipRoot>
          <TooltipTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              aria-label="Masquer du planning"
              onClick={(e) => {
                e.stopPropagation();
                onHide(event);
              }}
              className={
                'absolute top-[-6px] right-[-6px] w-[16px] h-[16px] rounded-[50%] bg-[var(--muted)] flex items-center justify-center cursor-pointer z-[12] '
                + 'shadow-[0_1px_3px_color-mix(in_srgb,var(--ink)_30%,transparent)] border-[1.5px] border-solid border-[var(--card)] text-[var(--on-accent)] '
                + 'transition-[transform,background-color] duration-150 ease-[ease] hover:bg-[var(--body)] hover:scale-110 '
                + 'motion-reduce:transition-none motion-reduce:hover:scale-100'
              }
            >
              <Close size={10} strokeWidth={1.75} />
            </div>
          </TooltipTrigger>
          <TooltipContent>Masquer du planning</TooltipContent>
        </TooltipRoot>
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
    </div>

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
    </TooltipProvider>
  );
});

PlanningBar.displayName = 'PlanningBar';
export default PlanningBar;
