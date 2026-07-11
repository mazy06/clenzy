/* ============================================================
   <TaskDeckQueue> — file « Attend ta validation » en PILES par type

   Refonte (handoff « Cartes empilées par type »), adaptée à MUI + tokens maison.
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
import { Box, Button, Collapse, IconButton } from '@mui/material';
import {
  Check, ChevronDown, Timer, CreditCard, Schedule, VisibilityOff, Undo, OpenInNew,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { useCountdown, type Countdown } from '../core/useCountdown';
import { AgentIcon } from '../renderers/agentIcon';
import { AGENT_META } from '../constants';
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
  action, onValidate, onEdit, onAdjustPrice, behind,
}: {
  action: AnyAction;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
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
  const tile = `${meta.color}26`; // teinte ~15 % pour la tuile d'icône

  return (
    <Box
      data-pending-action={action.id}
      sx={{
        display: 'flex', flexDirection: 'column',
        bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px',
        p: '14px', boxShadow: behind ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06))' : 'var(--shadow-md, 0 4px 14px rgba(0,0,0,.08))',
        minHeight: 128, overflow: 'hidden',
        // Contenu masqué pour les cartes derrière (seuls les bords apparaissent).
        '& > *': { opacity: behind ? 0 : 1, transition: 'opacity .25s' },
      }}
    >
      {/* En-tête : tuile d'icône + label du type + badge d'urgence */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: '10px', background: tile, color: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <AgentIcon token={meta.icon} size={16} />
        </Box>
        <Box sx={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t(meta.nameKey)}
        </Box>
        {payment || reminder || guestCard ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)' }} />
            <Box sx={{ fontSize: 10.5, fontWeight: 500, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
              {payment ? t('supervision.payment.badge', 'À régler')
                : reminder ? t('supervision.reminder.badge', 'Rappel')
                : t('supervision.guestCard.badge', 'À compléter')}
            </Box>
          </Box>
        ) : (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.35, borderRadius: '999px',
            bgcolor: cd.expired ? 'var(--err-soft)' : 'var(--warn-soft)',
            color: cd.expired ? 'var(--err)' : 'var(--warn)',
            fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            <Timer size={11} />
            {cd.expired ? t('supervision.hitl.expired') : remainingLabel(cd, t)}
          </Box>
        )}
      </Box>

      {/* Titre (2 lignes max) */}
      <Box sx={{
        fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, mt: 1, mb: 'auto',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {action.title}
      </Box>

      {/* Pied : action primaire / secondaire / chevron « Pourquoi ? » */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Button
          size="small" variant="contained" disableElevation
          onClick={priceAdjust ? () => onAdjustPrice!(action) : () => onValidate(action.id)}
          startIcon={payment ? <CreditCard size={14} /> : guestCard ? <OpenInNew size={14} /> : <Check size={14} />}
          sx={{
            flex: 1, textTransform: 'none', fontWeight: 500, fontSize: 11.5, borderRadius: '10px', boxShadow: 'none',
            bgcolor: 'var(--accent)', color: 'var(--on-accent)',
            '& .MuiButton-startIcon': { ml: 0, mr: 0.75 },
            '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' },
          }}
        >
          {priceAdjust ? (
            t('supervision.price.adjustCta', 'Ajuster les tarifs')
          ) : payment ? (
            <>{t('supervision.payment.settle', 'Régler')}{action.amountEur != null && (
              <Box component="span" sx={{ ml: 'auto', pl: 0.75 }}><Money value={action.amountEur} from="EUR" /></Box>
            )}</>
          ) : apply ? (
            <>{t('supervision.apply.action', 'Appliquer')}{action.amountEur != null && (
              <Box component="span" sx={{ ml: 'auto', pl: 0.75 }}>+<Money value={action.amountEur} from="EUR" decimals={0} /></Box>
            )}</>
          ) : guestCard ? t('supervision.guestCard.cta', 'Compléter la fiche client')
            : reminder ? t('supervision.reminder.ack', 'Info reçue') : t('supervision.hitl.validate')}
        </Button>
        <Button
          size="small" variant="outlined" color="inherit" onClick={() => onEdit(action.id)}
          startIcon={payment ? <Schedule size={13} /> : <VisibilityOff size={13} />}
          sx={{ textTransform: 'none', fontWeight: 500, fontSize: 11.5, borderRadius: '10px', color: 'var(--muted)', borderColor: 'var(--line-2)', '&:hover': { borderColor: 'var(--muted)', bgcolor: 'transparent' } }}
        >
          {/* « Ignorer » (dismiss assumé) pour toute carte non-paiement/non-rappel — jamais
              « Modifier » (aucun éditeur câblé ; laissait croire à une édition). */}
          {payment ? t('supervision.payment.later', 'Plus tard') : reminder ? t('supervision.reminder.mute', 'Ne plus afficher') : t('supervision.apply.dismiss', 'Ignorer')}
        </Button>
        <IconButton
          size="small" onClick={() => setWhy((w) => !w)} aria-expanded={why} aria-label={t('supervision.hitl.why')}
          sx={{ width: 34, borderRadius: '10px', border: '1px solid var(--line-2)', color: 'var(--accent)', '&:hover': { bgcolor: 'transparent' } }}
        >
          <ChevronDown size={16} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </IconButton>
      </Box>

      <Collapse in={why} unmountOnExit>
        <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid var(--line)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)' }}>
          {action.reasoning}
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Une pile (un type) ───────────────────────────────────────────────────────

function TaskStack({
  type, actions, open, dimmed, sort, onToggleSort, onOpen, onClose, onValidate, onEdit, onAdjustPrice, onBulk,
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
  onBulk: () => void;
}) {
  const { t } = useTranslation();
  const meta = AGENT_META[type];
  const n = actions.length;
  const total = actions.reduce((s, a) => s + (a.amountEur ?? 0), 0);
  const hasPayment = actions.some(isPayment);

  if (open) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Barre d'en-tête */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Box sx={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', flex: 1, minWidth: 0 }}>
            {t('supervision.deck.count', { count: n })}
            {total > 0 && <> · <Money value={total} from="EUR" /></>}
          </Box>
          <Button
            size="small" variant="text" onClick={onToggleSort}
            sx={{ textTransform: 'none', fontSize: 11, fontWeight: 500, color: 'var(--muted)', minWidth: 0, px: 1, borderRadius: '999px', border: '1px solid var(--line-2)' }}
          >
            {sort === 'due' ? t('supervision.deck.sortDue', 'Échéance') : t('supervision.deck.sortAmount', 'Montant')}
          </Button>
          {!hasPayment && (
            <Button
              size="small" variant="contained" disableElevation onClick={onBulk}
              startIcon={<AgentIcon token={meta.icon} size={13} />}
              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 500, borderRadius: '999px', boxShadow: 'none', bgcolor: 'var(--accent)', color: 'var(--on-accent)', '& .MuiButton-startIcon': { ml: 0, mr: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' } }}
            >
              {t('supervision.deck.bulk', 'Tout traiter')}
            </Button>
          )}
        </Box>
        {/* Liste (cascade) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {actions.map((a, i) => (
            <Box key={a.id} sx={{ animation: 'deckCascadeIn .42s var(--ease-out, cubic-bezier(.16,1,.3,1)) both', animationDelay: `${i * 0.05}s` }}>
              <TaskCard action={a} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // Carte seule (aucune pile) : rendu EN FLUX, hauteur ajustée au contenu — pas de
  // deck à hauteur fixe (évite l'espace vide réservé pour une pile inexistante).
  if (n === 1) {
    return (
      <Box sx={{
        filter: dimmed ? 'blur(4px)' : 'none', opacity: dimmed ? 0.45 : 1,
        transition: 'filter .35s var(--ease-out, cubic-bezier(.16,1,.3,1)), opacity .35s',
      }}>
        <TaskCard action={actions[0]} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} />
      </Box>
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
    <Box
      onClick={dimmed ? onClose : onOpen}
      sx={{
        position: 'relative', cursor: 'pointer', mb: `${behind * PEEK}px`,
        filter: dimmed ? 'blur(4px)' : 'none', opacity: dimmed ? 0.45 : 1,
        transition: 'filter .35s var(--ease-out, cubic-bezier(.16,1,.3,1)), opacity .35s',
      }}
    >
      {/* Tranches derrière : même largeur que la carte, débordent de PEEK px par niveau */}
      {Array.from({ length: behind }).map((_, i) => {
        const d = i + 1;
        return (
          <Box key={d} sx={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: -(d * PEEK),
            bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px',
            boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06))', zIndex: 3 - i,
          }} />
        );
      })}
      {/* Carte du dessus (en flux : donne sa hauteur au deck) */}
      <Box sx={{ position: 'relative', zIndex: 5 }}>
        <TaskCard action={actions[0]} onValidate={onValidate} onEdit={onEdit} onAdjustPrice={onAdjustPrice} />
      </Box>
      {/* Pastille de comptage */}
      {n > 1 && (
        <Box sx={{
          position: 'absolute', top: -10, right: -9, zIndex: 6,
          minWidth: 24, height: 24, px: 0.75, borderRadius: '999px',
          bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-md, 0 4px 14px rgba(0,0,0,.18))',
        }}>
          {n}
        </Box>
      )}
    </Box>
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
    <Box
      ref={rootRef}
      data-pending-queue
      data-vertical-scroll
      sx={{
        display: 'flex', flexDirection: 'column', gap: '14px',
        width: variant === 'floating' ? 320 : '100%',
        pt: '10px', pr: '9px', pb: '12px',
        ...(variant === 'floating'
          ? { maxHeight: 'max(220px, calc(100vh - 300px))', overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none' }
          : { overflowY: 'visible' }),
        overscrollBehavior: 'contain',
        '@keyframes deckCascadeIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
      }}
    >
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
          onBulk={() => bulk(list.map((a) => a.id), t('supervision.deck.undoBulk', { count: list.length }))}
        />
      ))}

      {/* Toast Undo */}
      {undo && (
        <Box sx={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 1400,
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderRadius: '12px',
          bgcolor: 'var(--ink)', color: '#fff', boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,.25))',
          animation: 'deckCascadeIn .3s ease both',
        }}>
          <Check size={15} style={{ color: 'var(--ok)' }} />
          <Box sx={{ fontSize: 12, fontWeight: 500 }}>{undo.label}</Box>
          <Button
            size="small" variant="text" onClick={doUndo} startIcon={<Undo size={13} />}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12, color: 'var(--accent)', minWidth: 0, '& .MuiButton-startIcon': { mr: 0.5 } }}
          >
            {t('supervision.deck.undo', 'Annuler')}
          </Button>
        </Box>
      )}
    </Box>
  );
}
