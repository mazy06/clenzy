import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { ArrowDown, ArrowLeft, Ellipsis, MessageSquare, PanelsTopLeft } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import Composer from './Composer';
import MessageBubble from './MessageBubble';
import { groupMessages } from './messagingModel';
import { type ThreadMessage, dayLabel } from './unified';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ThreadAction {
  key: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface ThreadMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Entrée qui n'existe que dans le menu étroit : l'action a un bouton d'icône au-delà de `sm`. */
  narrowOnly?: boolean;
}

interface ThreadViewProps {
  title: string;
  /** Sous-titre de l'entête : « canal · logement » (marque du canal incluse par l'appelant). */
  subtitle: React.ReactNode;
  /** Avatar de l'entête, marqué du canal ; à défaut, initiales du titre. */
  avatar?: React.ReactNode;
  /** Pastilles à droite du nom (état du séjour, urgence). */
  statusBadge?: React.ReactNode;
  /** Lien contextuel de l'entête (ex. « Voir la réservation »). */
  contextAction?: { label: string; onClick: () => void };
  /** Actions d'icône de l'entête (Rattacher, Template…). */
  actions?: ThreadAction[];
  /** Entrées du menu « ⋯ » (Archiver…). */
  menuItems?: ThreadMenuItem[];
  /** Ouvre / ferme le panneau de contexte quand il n'est pas affiché en permanence. */
  contextToggle?: { open: boolean; onToggle: () => void; label: string };
  messages: ThreadMessage[];
  loading: boolean;
  /** Brouillon contrôlé par le container (pré-remplissage IA). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  composePlaceholder: string;
  composeDisabled?: boolean;
  /** Bandeau au-dessus de la composition (fenêtre WhatsApp 24h dépassée). */
  composeNotice?: React.ReactNode;
  /** Zone du copilote IA, entre le fil et la composition. */
  copilot?: React.ReactNode;
  /** Chips de fichiers joints. */
  composeExtra?: React.ReactNode;
  /** Outils de la barre de composition (trombone, template, suggestion). */
  composeTools?: React.ReactNode;
  /**
   * Onglet « Note interne ». Fourni uniquement par les fils où le serveur sait
   * consigner une note sans la transmettre (conversations voyageur).
   */
  internalNote?: boolean;
  onInternalNoteChange?: (value: boolean) => void;
  /** Retour mobile (master-detail). */
  showBack?: boolean;
  onBack?: () => void;
}

/** Distance du bas en dessous de laquelle on considère qu'on lit « en direct ». */
const NEAR_BOTTOM_PX = 96;

/**
 * Fil de conversation : entête contextuelle, messages en séries par auteur et
 * par jour, zone du copilote IA, boîte de composition.
 *
 * <p>Purement présentationnel — les données viennent des containers
 * (ChannelThread / InternalThread).</p>
 */
export default function ThreadView({
  title,
  subtitle,
  avatar,
  statusBadge,
  contextAction,
  actions = [],
  menuItems = [],
  contextToggle,
  messages,
  loading,
  draft,
  onDraftChange,
  onSend,
  sending,
  composePlaceholder,
  composeDisabled = false,
  composeNotice,
  copilot,
  composeExtra,
  composeTools,
  internalNote = false,
  onInternalNoteChange,
  showBack = false,
  onBack,
}: ThreadViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Miroir de `atBottom` pour l'observateur de taille, qui ne doit pas être
  // recréé à chaque défilement.
  const atBottomRef = useRef(true);
  const days = useMemo(() => groupMessages(messages), [messages]);

  // Sur un écran étroit, les boutons d'icône de l'entête (template, fiche
  // voyageur…) ne laissent plus de place au nom : ils passent dans le menu « ⋯ ».
  const overflowItems: ThreadMenuItem[] = useMemo(
    () => [
      ...actions.map((action) => ({
        key: `action-${action.key}`,
        label: action.title,
        icon: action.icon,
        onClick: action.onClick,
        narrowOnly: true,
      })),
      ...menuItems,
    ],
    [actions, menuItems],
  );

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // Un nouveau message ramène en bas SEULEMENT si on lisait déjà « en direct » :
  // quelqu'un qui relit l'historique ne doit pas être arraché à sa lecture.
  useEffect(() => {
    if (atBottom) scrollToEnd();
    // `atBottom` n'est volontairement pas une dépendance : c'est l'arrivée d'un
    // message qui déclenche le défilement, pas le fait d'avoir remonté.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Quand la zone du copilote ou de la composition grandit (suggestion IA, saisie
  // multiligne), le fil rétrécit : sans ce recalage, le dernier message passerait
  // sous la carte alors qu'on le lisait.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToEnd();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  // Changer de fil repart du bas.
  useEffect(() => {
    scrollToEnd();
    atBottomRef.current = true;
    setAtBottom(true);
  }, [title, scrollToEnd]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    setAtBottom(near);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* ── Entête contextuelle ─────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 min-[900px]:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {showBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label={t('messagingHub.back', 'Retour')}
              className="cursor-pointer"
            >
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            </Button>
          )}
          {avatar ?? <GuestAvatar name={title} size={36} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 dir="auto" className="m-0 max-w-full truncate text-sm font-semibold text-foreground">{title}</h2>
              {statusBadge}
            </div>
            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {contextAction && (
            <Button size="xs" variant="ghost" className="hidden cursor-pointer sm:inline-flex" onClick={contextAction.onClick}>
              {contextAction.label}
            </Button>
          )}
          {actions.map((action) => (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <span className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon-sm" onClick={action.onClick} aria-label={action.title} className="cursor-pointer">
                    {action.icon}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{action.title}</TooltipContent>
            </Tooltip>
          ))}
          {contextToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant={contextToggle.open ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    aria-pressed={contextToggle.open}
                    aria-label={contextToggle.label}
                    onClick={contextToggle.onToggle}
                    className="cursor-pointer"
                  >
                    <PanelsTopLeft className="size-4" aria-hidden />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{contextToggle.label}</TooltipContent>
            </Tooltip>
          )}
          {overflowItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('messagingHub.moreActions', 'Plus d’actions')}
                  className={cn('cursor-pointer', menuItems.length === 0 && 'sm:hidden')}
                >
                  <Ellipsis className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              {/* `w-auto` : le gabarit cale sinon la largeur du menu sur celle du
                  déclencheur, ici un bouton d'icône. */}
              <DropdownMenuContent align="end" className="w-auto min-w-[180px]">
                {overflowItems.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    disabled={item.disabled}
                    onSelect={() => item.onClick()}
                    className={cn('gap-1.5 text-xs', item.narrowOnly && 'sm:hidden')}
                  >
                    {item.icon && <span className="inline-flex min-w-[24px] items-center text-muted-foreground">{item.icon}</span>}
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto bg-muted/40 px-3 py-4 min-[900px]:px-5"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? (
            <div className="flex flex-col gap-3" role="status" aria-label={t('messagingHub.loading', 'Chargement…')}>
              <Skeleton className="h-10 w-2/3 rounded-2xl" />
              <Skeleton className="ms-auto h-8 w-1/2 rounded-2xl" />
              <Skeleton className="h-14 w-3/4 rounded-2xl" />
            </div>
          ) : days.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <MessageSquare className="size-5" aria-hidden />
              </span>
              <p className="m-0 text-sm text-muted-foreground">
                {t('messagingHub.noMessages', 'Aucun message dans cette conversation')}
              </p>
            </div>
          ) : (
            days.map((day) => (
              <section key={day.key} aria-label={dayLabel(day.at)} className="mt-4 first:mt-0">
                <div className="sticky top-0 z-10 mb-2 flex justify-center">
                  <span className="rounded-full border border-border bg-card/90 px-2.5 py-0.5 text-2xs font-medium text-muted-foreground backdrop-blur">
                    {dayLabel(day.at)}
                  </span>
                </div>
                {day.runs.map((run) => (
                  <MessageBubble key={run.message.id} run={run} fallbackSender={title} />
                ))}
              </section>
            ))
          )}
        </div>

        {!atBottom && !loading && days.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToEnd('smooth')}
            aria-label={t('messagingHub.scrollToLatest', 'Aller au dernier message')}
            className={cn(
              'absolute bottom-3 end-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-accent motion-reduce:transition-none',
            )}
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* ── Copilote + composition ──────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card p-3 min-[900px]:px-4">
        {copilot}
        <Composer
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          sending={sending}
          placeholder={composePlaceholder}
          disabled={composeDisabled}
          notice={composeNotice}
          extra={composeExtra}
          tools={composeTools}
          internalNote={internalNote}
          onInternalNoteChange={onInternalNoteChange}
        />
      </div>
    </div>
  );
}
