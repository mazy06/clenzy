/* ============================================================
   <TaskDeckQueue> — file « Attend ta validation » en PILES par type

   Refonte (handoff « Cartes empilées par type »), sur les primitifs Baitly UI
   et les tokens maison.
   Les cartes sont regroupées par type (Finance / Opérations / Communication /
   Revenue / Avis) et empilées en « deck » ; une pile se déplie au clic (une
   seule à la fois), les autres sont floutées. Cartes restylées + en-tête (tri,
   action groupée) + toast Undo.

   Phase 1 (cœur) : deck + dépliage/repli + focus par flou + cartes restylées +
   en-tête (compteur/total/tri) + action groupée (non-paiement) + undo.
   Phase 2 (à venir) : swipe de la carte du dessus, glisser-réordonner, épingle.

   Drop-in de <PendingQueue> (mêmes props). Réutilise onValidate/onEdit.
   ============================================================ */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Button, Collapsible, CollapsibleContent } from '../../../components/ui';
import {
  Check, ChevronDown, Edit, Timer, CreditCard, Schedule, VisibilityOff, Undo, OpenInNew,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import { useCountdown, type Countdown } from '../core/useCountdown';
import { AgentIcon } from '../renderers/agentIcon';
import { AGENT_META } from '../constants';
import { parseReviewId, parseReviewMotif, type OpenReviewPayload } from './ConstellationQueue';
import type { AgentId, PendingAction, PortfolioPendingAction } from '../types';

type AnyAction = PendingAction | PortfolioPendingAction;

// Ordre d'affichage des piles (handoff : Finance, Opérations, Communication, Revenue, Avis).
const TYPE_ORDER: AgentId[] = ['fin', 'ops', 'com', 'rev', 'rep'];

export interface TaskDeckQueueProps {
  actions: AnyAction[];
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  variant?: 'floating' | 'panel';
}

function isPayment(a: AnyAction) { return a.kind === 'payment'; }
function isReminder(a: AnyAction) { return a.kind === 'reminder'; }
function isGuestCard(a: AnyAction) { return a.opensGuestCard === true; }
function isApply(a: AnyAction) { return !isPayment(a) && !isReminder(a) && !isGuestCard(a) && Boolean(a.applyActionType); }

function remainingLabel(cd: Countdown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.expired) return t('supervision.hitl.expired');
  if (cd.hours >= 1) return `${cd.hours} ${t('supervision.hitl.unitHour')} ${String(cd.minutes).padStart(2, '0')}`;
  if (cd.minutes >= 1) return `${cd.minutes} ${t('supervision.hitl.unitMin')}`;
  return t('supervision.hitl.lessThanMin');
}

// ─── Carte individuelle restylée ──────────────────────────────────────────────

function TaskCard({
  action, onValidate, onEdit, onAdjustPrice, onOpenReview, behind,
}: {
  action: AnyAction;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  /** Carte d'avis : « Répondre » ouvre la modale de réponse (brouillon IA
   *  insérable OU réponse libre) au lieu de publier le brouillon à l'aveugle. */
  onOpenReview?: (payload: OpenReviewPayload) => void;
  behind?: boolean; // carte derrière (deck replié) : contenu masqué
}) {
  const { t } = useTranslation();
  const cd = useCountdown(action.expiresAt);
  const [why, setWhy] = useState(false);
  const meta = AGENT_META[action.agentId];
  const payment = isPayment(action);
  const reminder = isReminder(action);
  const guestCard = isGuestCard(action);
  const apply = isApply(action);
  // Baisse tarifaire multi-segment : « Ajuster » ouvre une modale (édition + prévision + apply).
  const priceAdjust = apply && action.applyActionType === 'PRICE_DROP'
    && Boolean(action.actionParams) && Boolean(onAdjustPrice);
  // Réponse à un avis : jamais de publication à l'aveugle du brouillon IA —
  // « Répondre » ouvre la modale du dashboard (brouillon insérable + saisie).
  const reviewId = apply && action.applyActionType === 'REVIEW_DRAFT_REPLY' && onOpenReview
    ? parseReviewId(action.actionParams)
    : null;
  const tile = `${meta.color}26`; // teinte ~15 % pour la tuile d'icône

  return (
    <div
      data-pending-action={action.id}
      // Ancrages de l'overlay d'attaches (SupervisionTethers) : l'agent porteur,
      // l'urgence (< 1 h), et « derrière » (carte empilée d'un deck replié —
      // pas d'attache, seule la carte du dessus en reçoit une).
      data-agent-id={action.agentId}
      data-urgent={(!payment && !reminder && !cd.expired && cd.hours < 1) || undefined}
      data-behind={behind || undefined}
      className={cn(
        'flex flex-col bg-[var(--card)] border border-solid border-[var(--line)] rounded-[16px] p-[14px] min-h-[128px] overflow-hidden',
        // Contenu masqué pour les cartes derrière (seuls les bords apparaissent).
        '[&>*]:transition-opacity [&>*]:duration-[250ms]',
        behind ? '[&>*]:opacity-0' : '[&>*]:opacity-100',
      )}
      style={{
        boxShadow: behind
          ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06))'
          : 'var(--shadow-md, 0 4px 14px rgba(0,0,0,.08))',
      }}
    >
      {/* En-tête : tuile d'icône + label du type + badge d'urgence */}
      <div className="flex items-center gap-1.5">
        <div className="w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: tile, color: meta.color }}>
          <AgentIcon token={meta.icon} size={16} />
        </div>
        <div className="text-[12px] font-medium text-[var(--ink)] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
          {t(meta.nameKey)}
        </div>
        {payment || reminder || guestCard ? (
          <div className="flex items-center gap-0.5 shrink-0">
            <div className="w-[6px] h-[6px] rounded-[50%]" style={{ background: 'var(--warn)' }} />
            <div className="text-[10.5px] font-medium text-[var(--warn)] whitespace-nowrap">
              {payment ? t('supervision.payment.badge', 'À régler')
                : reminder ? t('supervision.reminder.badge', 'Rappel')
                : t('supervision.guestCard.badge', 'À compléter')}
            </div>
          </div>
        ) : (
          <div className={cn('flex items-center gap-[3px] px-[5.4px] py-[2.0999999999999996px] rounded-[999px] text-[10px] font-medium whitespace-nowrap tabular-nums shrink-0', cd.expired ? 'bg-[var(--err-soft)]' : 'bg-[var(--warn-soft)]', cd.expired ? 'text-[var(--err)]' : 'text-[var(--warn)]')}>
            <Timer size={11} />
            {cd.expired ? t('supervision.hitl.expired') : remainingLabel(cd, t)}
          </div>
        )}
      </div>

      {/* Titre (2 lignes max) */}
      <div className="text-[12.5px] font-medium text-[var(--ink)] leading-[1.35] mt-1.5 mb-auto line-clamp-2">
        {action.title}
      </div>

      {/* Pied : action primaire / secondaire / chevron « Pourquoi ? » */}
      <div className="flex gap-1.5 mt-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={
            reviewId != null
              ? () => {
                  const review = parseReviewMotif(action.motif);
                  onOpenReview!({
                    reviewId,
                    actionId: action.id,
                    guestName: review?.meta.split(' · ')[0],
                    rating: review?.rating,
                  });
                }
              : priceAdjust
                ? () => onAdjustPrice!(action)
                : () => onValidate(action.id)
          }
        >
          {reviewId != null ? <Edit size={14} /> : payment ? <CreditCard size={14} /> : guestCard ? <OpenInNew size={14} /> : <Check size={14} />}
          {reviewId != null ? (
            t('dashboard.actionItems.reviewsAction', 'Répondre')
          ) : priceAdjust ? (
            t('supervision.price.adjustCta', 'Ajuster les tarifs')
          ) : payment ? (
            <>{t('supervision.payment.settle', 'Régler')}{action.amountEur != null && (
              <span className="ms-auto ps-1"><Money value={action.amountEur} from="EUR" /></span>
            )}</>
          ) : apply ? (
            <>{t('supervision.apply.action', 'Appliquer')}{action.amountEur != null && (
              <span className="ms-auto ps-1">+<Money value={action.amountEur} from="EUR" decimals={0} /></span>
            )}</>
          ) : guestCard ? t('supervision.guestCard.cta', 'Compléter la fiche client')
            : reminder ? t('supervision.reminder.ack', 'Info reçue') : t('supervision.hitl.validate')}
        </Button>
        {/* « Ignorer » (dismiss assumé) pour toute carte non-paiement/non-rappel — jamais
            « Modifier » (aucun éditeur câblé ; laissait croire à une édition). */}
        <Button
          variant="outline" size="sm" onClick={() => onEdit(action.id)}
        >
          {payment ? <Schedule size={13} /> : <VisibilityOff size={13} />}
          {payment ? t('supervision.payment.later', 'Plus tard') : reminder ? t('supervision.reminder.mute', 'Ne plus afficher') : t('supervision.apply.dismiss', 'Ignorer')}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWhy((w) => !w)}
          aria-expanded={why}
          aria-label={t('supervision.hitl.why')}
          className="w-[34px] rounded-[10px] border border-solid border-[var(--line-2)] text-[var(--accent)] hover:bg-transparent"
        >
          <ChevronDown size={16} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </Button>
      </div>

      {/* Collapsible pilote (pas de trigger interne) : le bouton « Pourquoi ? »
          ci-dessus porte deja l'etat `why`. */}
      <Collapsible open={why}>
        <CollapsibleContent>
          <div className="mt-2 pt-2 border-t border-solid border-t-[var(--line)] text-[11.5px] leading-[1.5] text-[var(--muted)]">
            {action.reasoning}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Une pile (un type) ───────────────────────────────────────────────────────

function TaskStack({
  type, actions, open, dimmed, sort, onToggleSort, onOpen, onClose, onValidate, onEdit, onAdjustPrice, onOpenReview, onBulk,
}: {
  type: AgentId;
  actions: AnyAction[];
  open: boolean;
  dimmed: boolean;
  sort: 'due' | 'amount';
  onToggleSort: () => void;
  onOpen: () => void;
  onClose: () => void;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  onOpenReview?: (payload: OpenReviewPayload) => void;
  onBulk: () => void;
}) {
  const { t } = useTranslation();
  const meta = AGENT_META[type];
  const n = actions.length;
  const total = actions.reduce((s, a) => s + (a.amountEur ?? 0), 0);
  const hasPayment = actions.some(isPayment);
  // Réponses à des avis : chacune mérite une relecture dans la modale —
  // « Tout traiter » publierait les brouillons IA en lot, à l'aveugle.
  const hasReview = actions.some((a) => a.applyActionType === 'REVIEW_DRAFT_REPLY');

  if (open) {
    return (
      <div className="flex flex-col">
        {/* Barre d'en-tête */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="text-[11.5px] font-medium text-[var(--muted)] flex-1 min-w-0">
            {t('supervision.deck.count', { count: n })}
            {total > 0 && <> · <Money value={total} from="EUR" /></>}
          </div>
          {/* Bascule de tri : controle repete d'une barre d'en-tete → ghost, pour
              laisser « Tout traiter » seule action pleine de la pile. */}
          <Button variant="ghost" size="sm" onClick={onToggleSort}>
            {sort === 'due' ? t('supervision.deck.sortDue', 'Échéance') : t('supervision.deck.sortAmount', 'Montant')}
          </Button>
          {!hasPayment && !hasReview && (
            <Button size="sm" onClick={onBulk}>
              <AgentIcon token={meta.icon} size={13} />
              {t('supervision.deck.bulk', 'Tout traiter')}
            </Button>
          )}
        </div>
        {/* Liste (cascade) */}
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => (
            <div key={a.id} style={{ animation: 'deckCascadeIn .42s var(--ease-out, cubic-bezier(.16,1,.3,1)) both', animationDelay: `${i * 0.05}s` }}>
              <TaskCard action={a} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} onOpenReview={onOpenReview} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Carte seule (aucune pile) : rendu EN FLUX, hauteur ajustée au contenu — pas de
  // deck à hauteur fixe (évite l'espace vide réservé pour une pile inexistante).
  if (n === 1) {
    return (
      <div className={cn(dimmed ? 'opacity-45' : 'opacity-100')} style={{ filter: dimmed ? 'blur(4px)' : 'none', transition: 'filter .35s var(--ease-out, cubic-bezier(.16,1,.3,1)), opacity .35s' }}>
        <TaskCard action={actions[0]} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} onOpenReview={onOpenReview} />
      </div>
    );
  }

  // Deck replié : carte du dessus + jusqu'à 3 tranches derrière + pastille de comptage.
  // Les tranches sont PLEINE LARGEUR (pas de rétrécissement latéral) et ne laissent
  // dépasser qu'un fin liseré de PEEK px chacune sous la carte — on les entrevoit,
  // elles ne réservent plus un bandeau vide. Ancrées sur la hauteur RÉELLE de la
  // carte (carte en flux + débord bas), plus de hauteur codée en dur.
  const behind = Math.min(n - 1, 3);
  const PEEK = 6;
  return (
    <div
      onClick={dimmed ? onClose : onOpen}
      className="relative cursor-pointer"
      style={{
        marginBottom: `${behind * PEEK}px`,
        filter: dimmed ? 'blur(4px)' : 'none',
        opacity: dimmed ? 0.45 : 1,
        transition: 'filter .35s var(--ease-out, cubic-bezier(.16,1,.3,1)), opacity .35s',
      }}
    >
      {/* Tranches derrière : même largeur que la carte, débordent de PEEK px par niveau */}
      {Array.from({ length: behind }).map((_, i) => {
        const d = i + 1;
        return (
          <div className="absolute top-0 start-0 end-0 bg-[var(--card)] border border-solid border-[var(--line)] rounded-[16px]" style={{ bottom: -(d * PEEK), boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06))', zIndex: 3 - i }} key={d} />
        );
      })}
      {/* Carte du dessus (en flux : donne sa hauteur au deck) */}
      <div className="relative z-[5]">
        <TaskCard action={actions[0]} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} onOpenReview={onOpenReview} />
      </div>
      {/* Pastille de comptage */}
      {n > 1 && (
        <div className="absolute z-[6] min-w-[24px] h-[24px] px-[4.5px] rounded-[999px] bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-semibold flex items-center justify-center" style={{ top: -10, right: -9, boxShadow: 'var(--shadow-md, 0 4px 14px rgba(0,0,0,.18))' }}>
          {n}
        </div>
      )}
    </div>
  );
}

// ─── Conteneur ────────────────────────────────────────────────────────────────

// Mémoïsé (audit perf) : ne re-rendre le deck que quand la file ou les handlers
// changent — pas à chaque re-render du panneau (report, toasts, events feed).
export const TaskDeckQueue = memo(TaskDeckQueueInner);

function TaskDeckQueueInner({ actions, onValidate, onEdit, onAdjustPrice, variant = 'floating' }: TaskDeckQueueProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [openType, setOpenType] = useState<AgentId | null>(null);
  const [sort, setSort] = useState<Record<string, 'due' | 'amount'>>({});
  // Modale de réponse à un avis (composant du dashboard, réutilisé tel quel).
  // Montée SEULEMENT ouverte : elle porte des hooks liés au Router.
  const [openReview, setOpenReview] = useState<OpenReviewPayload | null>(null);
  // Undo optimiste (action groupée) : ids masqués localement + commit différé.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);
  const commitTimer = useRef<number | null>(null);

  useEffect(() => () => { if (commitTimer.current) window.clearTimeout(commitTimer.current); }, []);

  // Échap + clic hors zone ferment la pile ouverte.
  useEffect(() => {
    if (!openType) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenType(null); };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenType(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [openType]);

  const groups = useMemo(() => {
    const visible = actions.filter((a) => !hidden.has(a.id));
    const byType = new Map<AgentId, AnyAction[]>();
    for (const a of visible) {
      const arr = byType.get(a.agentId) ?? [];
      arr.push(a);
      byType.set(a.agentId, arr);
    }
    return TYPE_ORDER
      .filter((ty) => byType.has(ty))
      .map((ty) => {
        const mode = sort[ty] ?? 'due';
        const sorted = [...byType.get(ty)!].sort((a, b) =>
          mode === 'amount'
            ? (b.amountEur ?? 0) - (a.amountEur ?? 0)
            : (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
        return { type: ty, actions: sorted };
      });
  }, [actions, hidden, sort]);

  const commitUndo = () => {
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    setUndo((u) => {
      if (u) u.ids.forEach((id) => onValidate(id));
      return null;
    });
  };

  const bulk = (ids: string[], label: string) => {
    // Masque localement, laisse 4,2 s pour annuler, puis valide côté serveur.
    setOpenType(null);
    setHidden((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setUndo({ ids, label });
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(commitUndo, 4200);
  };

  const doUndo = () => {
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    setHidden((prev) => {
      const next = new Set(prev);
      undo?.ids.forEach((id) => next.delete(id));
      return next;
    });
    setUndo(null);
  };

  if (variant === 'floating' && groups.length === 0 && !undo) return null;

  return (
    <div
      ref={rootRef}
      data-pending-queue
      data-vertical-scroll
      className={cn(
        'flex flex-col gap-[14px] pt-[10px] pe-[9px] pb-3 overscroll-contain',
        variant === 'floating'
          ? 'w-[320px] max-h-[max(220px,calc(100vh_-_300px))] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'w-full overflow-y-visible',
      )}
    >
      {/* La keyframe vivait dans le `sx` du conteneur ; elle est consommee par les
          `style` inline des cartes et du toast, donc elle doit rester declaree. */}
      <style>{'@keyframes deckCascadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>

      {groups.map(({ type, actions: list }) => (
        <TaskStack
          key={type}
          type={type}
          actions={list}
          open={openType === type}
          dimmed={openType !== null && openType !== type}
          sort={sort[type] ?? 'due'}
          onToggleSort={() => setSort((s) => ({ ...s, [type]: (s[type] ?? 'due') === 'due' ? 'amount' : 'due' }))}
          onOpen={() => setOpenType(type)}
          onClose={() => setOpenType(null)}
          onValidate={onValidate}
          onEdit={onEdit}
          onAdjustPrice={onAdjustPrice}
          onOpenReview={setOpenReview}
          onBulk={() => bulk(list.map((a) => a.id), t('supervision.deck.undoBulk', { count: list.length }))}
        />
      ))}

      {openReview && (
        <ReviewReplyDialog
          reviewId={openReview.reviewId}
          preview={{ guestName: openReview.guestName, rating: openReview.rating }}
          onClose={() => setOpenReview(null)}
          // Réponse publiée : la carte HITL est remplie, on l'écarte (dismiss
          // serveur) — surtout PAS onValidate, qui publierait le brouillon IA
          // une seconde fois par-dessus la réponse choisie.
          onPublished={() => onEdit(openReview.actionId)}
        />
      )}

      {/* Toast Undo */}
      {undo && (
        <div className="fixed bottom-[26px] start-[50%] z-[1400] flex items-center gap-[9px] px-3 py-[7.5px] rounded-[12px] bg-[var(--ink)] text-[#fff]" style={{ transform: 'translateX(-50%)', boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,.25))', animation: 'deckCascadeIn .3s ease both' }}>
          <Check size={15} style={{ color: 'var(--ok)' }} />
          <div className="text-[12px] font-medium">{undo.label}</div>
          {/* Toast a fond encre : l'encre du ghost s'y perdrait, on garde la teinte
              accent d'origine pour rester lisible sur ce fond sombre. */}
          <Button
            variant="ghost" size="sm" onClick={doUndo}
            className="text-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Undo size={13} />
            {t('supervision.deck.undo', 'Annuler')}
          </Button>
        </div>
      )}
    </div>
  );
}
