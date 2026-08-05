import React, { useEffect, useMemo, useRef } from 'react';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  Spinner,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { cn } from '../../../utils/cn';
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Send as SendIcon,
  Description as FileIcon,
  Note as NoteIcon,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { type ThreadMessage, dayLabel, formatMsgTime } from './unified';

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
}

interface ThreadViewProps {
  title: string;
  /** Sous-titre entête : « canal · logement » (icône canal colorée incluse par l'appelant). */
  subtitle: React.ReactNode;
  /** Pastille de statut à droite du nom (ex. « Confirmée » pour une réservation). */
  statusBadge?: React.ReactNode;
  /** Lien contextuel de l'entête (ex. « Voir la réservation »). */
  contextAction?: { label: string; onClick: () => void };
  /** Actions d'icône de l'entête (Rattacher, Template…). */
  actions?: ThreadAction[];
  /** Entrées du menu « ⋯ » (Archiver…). */
  menuItems?: ThreadMenuItem[];
  messages: ThreadMessage[];
  loading: boolean;
  /** Brouillon contrôlé par le container (pré-remplissage IA). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  composePlaceholder: string;
  composeDisabled?: boolean;
  /** Bandeau au-dessus du compose (ex : fenêtre WhatsApp 24h dépassée). */
  composeNotice?: React.ReactNode;
  /** Chips fichiers joints au-dessus du champ. */
  composeExtra?: React.ReactNode;
  /** Boutons dans la boîte de composition (trombone, étincelles IA). */
  composeTools?: React.ReactNode;
  /** Réponses suggérées, insérées dans le brouillon au clic. */
  quickReplies?: string[];
  /**
   * Bascule « note interne » : quand elle est fournie, la boîte de composition
   * s'ambre et le message part comme note d'équipe, invisible du voyageur.
   */
  internalNote?: boolean;
  onInternalNoteChange?: (value: boolean) => void;
  /** Retour mobile (master-detail). */
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Fil de conversation — reprise de la projection « Messagerie » de la galerie
 * design-system ({@code BMessagingSectionDemo}).
 *
 * <p>Carte bordée unique : entête contextuelle (avatar, nom, statut, réservation),
 * fil bâti sur les primitives {@code Message*}, réponses suggérées, puis boîte de
 * composition {@code InputGroup}.</p>
 *
 * <p><b>Fil sans bulles</b>, comme la projection : l'émetteur se lit à l'avatar
 * (présent en réception, absent en émission) et à l'alignement. Sur un fil
 * professionnel qui mélange email, SMS et WhatsApp, l'empilement de bulles
 * colorées écrasait la lisibilité de messages souvent longs.</p>
 *
 * <p>Purement présentationnel — les données viennent des containers
 * (ChannelThread / InternalThread).</p>
 */
export default function ThreadView({
  title,
  subtitle,
  statusBadge,
  contextAction,
  actions = [],
  menuItems = [],
  messages,
  loading,
  draft,
  onDraftChange,
  onSend,
  sending,
  composePlaceholder,
  composeDisabled = false,
  composeNotice,
  composeExtra,
  composeTools,
  quickReplies = [],
  internalNote = false,
  onInternalNoteChange,
  showBack = false,
  onBack,
}: ThreadViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas à l'arrivée de messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length, title]);

  // Groupes par jour pour les pilules séparateurs.
  const grouped = useMemo(() => {
    const sorted = [...messages].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const groups: Array<{ day: string; msgs: ThreadMessage[] }> = [];
    for (const msg of sorted) {
      const day = dayLabel(msg.at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.msgs.push(msg);
      else groups.push({ day, msgs: [msg] });
    }
    return groups;
  }, [messages]);

  const canSend = draft.trim().length > 0 && !sending && !composeDisabled;

  const handleSend = () => {
    if (canSend) onSend();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 min-[900px]:p-4">
      {/* ── Entête contextuelle ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {showBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label={t('messagingHub.back', 'Retour')}
              className="cursor-pointer"
            >
              <ArrowBackIcon size={16} strokeWidth={1.75} />
            </Button>
          )}
          <GuestAvatar name={title} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{title}</span>
              {statusBadge}
            </div>
            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {contextAction && (
            <Button size="xs" variant="ghost" className="cursor-pointer" onClick={contextAction.onClick}>
              {contextAction.label}
            </Button>
          )}
          {actions.map((action) => (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={action.onClick}
                    aria-label={action.title}
                    className="cursor-pointer"
                  >
                    {action.icon}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{action.title}</TooltipContent>
            </Tooltip>
          ))}
          {menuItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('messagingHub.moreActions', "Plus d'actions")}
                  className="cursor-pointer"
                >
                  <MoreHorizIcon size={16} strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              {/* `w-auto` : le gabarit cale sinon la largeur du menu sur celle du
                  declencheur, ici un bouton d'icone. */}
              <DropdownMenuContent align="end" className="w-auto min-w-[180px]">
                {menuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    disabled={item.disabled}
                    onSelect={() => item.onClick()}
                    className="gap-1.5 text-xs"
                  >
                    {item.icon && (
                      <span className="inline-flex min-w-[24px] items-center text-muted-foreground">{item.icon}</span>
                    )}
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t('messagingHub.noMessages', 'Aucun message dans cette conversation')}
          </p>
        ) : (
          <MessageGroup>
            {grouped.map((group) => (
              <React.Fragment key={group.day}>
                <div className="my-1 flex justify-center">
                  <Badge variant="secondary" className="text-2xs">{group.day}</Badge>
                </div>
                {group.msgs.map((msg) => (
                  <Message key={msg.id} align={msg.out ? 'end' : 'start'}>
                    {/* L'avatar marque la RECEPTION : son absence, cote emission,
                        suffit a distinguer les deux sens sans colorer de bulle. */}
                    {!msg.out && (
                      <MessageAvatar>
                        <GuestAvatar name={msg.sender || title} size={28} />
                      </MessageAvatar>
                    )}
                    <MessageContent>
                      {msg.text && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <span className="flex flex-col gap-1.5">
                          {msg.attachments.map((name) => (
                            <Attachment key={name} className="max-w-64">
                              <AttachmentMedia>
                                <FileIcon size={16} strokeWidth={1.75} />
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle>{name}</AttachmentTitle>
                                <AttachmentDescription>
                                  {t('messagingHub.attachment', 'Pièce jointe')}
                                </AttachmentDescription>
                              </AttachmentContent>
                            </Attachment>
                          ))}
                        </span>
                      )}

                      <MessageFooter className="text-2xs tabular-nums text-faint">
                        {formatMsgTime(msg.at)}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                ))}
              </React.Fragment>
            ))}
          </MessageGroup>
        )}
      </div>

      {/* ── Réponses suggérées ──────────────────────────────────────────── */}
      {quickReplies.length > 0 && !composeDisabled && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickReplies.map((reply) => (
            <Button
              key={reply}
              size="xs"
              variant="outline"
              className="shrink-0 cursor-pointer rounded-full"
              onClick={() => onDraftChange(reply)}
            >
              {reply}
            </Button>
          ))}
        </div>
      )}

      {/* ── Compose ─────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        {composeNotice}
        {composeExtra}

        {onInternalNoteChange && (
          <div className="mb-1.5 flex items-center gap-2">
            <Switch
              id="msg-internal-note"
              checked={internalNote}
              onCheckedChange={onInternalNoteChange}
              className="cursor-pointer"
            />
            <label
              htmlFor="msg-internal-note"
              className={cn(
                'flex cursor-pointer items-center gap-1 text-xs',
                internalNote ? 'text-warning-ink' : 'text-muted-foreground',
              )}
            >
              <NoteIcon size={13} strokeWidth={1.75} />
              {t('messagingHub.internalNote', 'Note interne (invisible pour le voyageur)')}
            </label>
          </div>
        )}

        {/* La teinte ambre est le SEUL rappel que le message ne partira pas au
            voyageur : sans elle, rien ne distingue une note d'une reponse. */}
        <InputGroup className={cn(internalNote && 'border-warning/50 bg-warning-soft/30')}>
          <InputGroupTextarea
            rows={2}
            placeholder={
              internalNote
                ? t('messagingHub.internalNotePlaceholder', "Note pour l'équipe…")
                : composePlaceholder
            }
            value={draft}
            disabled={composeDisabled}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="max-h-[6lh]"
          />
          <InputGroupAddon align="block-end">
            {composeTools}
            <InputGroupButton
              size="icon-xs"
              onClick={handleSend}
              disabled={!canSend}
              aria-label={t('messagingHub.send', 'Envoyer')}
              className={cn(
                'ms-auto rounded-full',
                canSend && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {sending ? (
                <Spinner className="size-3.5" />
              ) : (
                <SendIcon
                  size={14}
                  strokeWidth={1.75}
                  className="translate-x-[0.5px] -translate-y-[0.5px] rtl:-translate-x-[0.5px]"
                />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
