import React, { useEffect, useMemo, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
} from '../../../icons';
import { type ThreadMessage, dayLabel, formatMsgTime } from './unified';

// ─── Styles partagés (référence .mg-ico / .mg-ctool / .mg-send) ──────────────

// Les anciennes constantes `mgIcoSx` / `composeToolSx` sont supprimees : leurs
// deux consommateurs (ChannelThread, InternalThread) sont deja passes aux
// classes equivalentes, plus personne ne les importait.

/** Boutons d'icone de l'entete (reference .mg-ico). */
const MG_ICO_CLS =
  'flex items-center justify-center shrink-0 p-0 rounded-[11px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] cursor-pointer [transition:color_.14s,border-color_.14s] hover:text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-[.45] disabled:cursor-default';

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
  /** Actions .mg-ico de l'entête (Rattacher, Template…). */
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
  /** Boutons .mg-ctool dans la boîte (trombone, étincelles IA). */
  composeTools?: React.ReactNode;
  /** Retour mobile (master-detail). */
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Fil de conversation « Signature » (référence .mg-thread) : entête 62px,
 * messages avec séparateurs de jour, bulles in/out, boîte de composition.
 * Purement présentational — les données viennent des containers
 * (ChannelThread / InternalThread).
 */
export default function ThreadView({
  title,
  subtitle,
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
  showBack = false,
  onBack,
}: ThreadViewProps) {
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
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[var(--bg)]">
      {/* ── Entête 62px ─────────────────────────────────────────────────── */}
      <div className="h-[62px] shrink-0 flex items-center gap-2 px-3.5 bg-[var(--card)] border-b border-[var(--line)]">
        {showBack && (
          <button onClick={onBack} aria-label="Retour" className={cn(MG_ICO_CLS, 'w-8 h-8')}>
            <ArrowBackIcon size={16} strokeWidth={1.75} />
          </button>
        )}
        <div className="min-w-0">
          <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[16px] font-semibold text-[var(--ink)] leading-[1.25] whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </p>
          <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1">
            {subtitle}
          </div>
        </div>
        <div className="ms-auto flex gap-1.5 items-center">
          {actions.map((action) => (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <button type="button" onClick={action.onClick} aria-label={action.title} className={cn(MG_ICO_CLS, 'w-9 h-9')}>
                  {action.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent>{action.title}</TooltipContent>
            </Tooltip>
          ))}
          {menuItems.length > 0 && (
            // Le menu flottant devient un DropdownMenu : il s'ancre lui-meme sur
            // son declencheur, l'etat `menuAnchor` n'a plus lieu d'etre.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Plus d'actions"
                  className={cn(MG_ICO_CLS, 'w-9 h-9')}
                >
                  <MoreHorizIcon size={16} strokeWidth={1.75} />
                </button>
              </DropdownMenuTrigger>
              {/* `w-auto` : le gabarit cale sinon la largeur du menu sur celle du
                  declencheur, ici un bouton de 36 px. */}
              <DropdownMenuContent align="end" className="w-auto min-w-[180px]">
                {menuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    disabled={item.disabled}
                    onSelect={() => item.onClick()}
                    className="text-[12.5px] font-semibold gap-1.5"
                  >
                    {item.icon && (
                      <span className="inline-flex min-w-[28px] items-center text-[var(--muted)]">{item.icon}</span>
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
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2 min-h-0" ref={scrollRef}>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] text-center py-6">
            Aucun message dans cette conversation
          </p>
        ) : (
          grouped.map((group) => (
            <React.Fragment key={group.day}>
              <div className="self-center text-[10.5px] font-semibold text-[var(--faint)] bg-[var(--card)] border border-solid border-[var(--line)] p-[4px 13px] rounded-[20px]">
                {group.day}
              </div>
              {group.msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[74%] px-[14px] py-[11px] rounded-[15px] text-[13px] leading-[1.5] whitespace-pre-wrap break-words',
                    msg.out
                      ? 'self-end bg-[var(--accent)] text-[#fff] rounded-br-[5px]'
                      : 'self-start bg-[var(--card)] border border-solid border-[var(--line)] text-[var(--body)] rounded-bl-[5px]',
                  )}
                >
                  {msg.text}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {msg.attachments.map((name) => (
                        <div className="flex items-center gap-0.5 text-[11px] opacity-85" key={name}>
                          <AttachFileIcon size={11} strokeWidth={1.75} />
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* mt: 0.5 = 3px (theme.spacing vaut 6 dans ce projet, pas 8). */}
                  <div className={cn('text-[9.5px] mt-[3px] opacity-70 tabular-nums', msg.out && 'text-right')}>
                    {formatMsgTime(msg.at)}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))
        )}
      </div>

      {/* ── Compose ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[var(--card)] border-t border-[var(--line)]">
        {composeNotice}
        <div className="p-[14px 20px]">
          {composeExtra}
          <div className="flex items-end gap-[7.5px] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[13px] p-[8px 8px 8px 14px]">
            {/* `textarea` nu plutot que le primitif Textarea : la boite .mg-cbox
                porte deja le cadre, le fond et le padding 8/8/8/14 — le gabarit
                du primitif les doublerait. InputBase etait deja l'input MUI SANS
                habillage, la transposition est donc a l'identique.
                `field-sizing-content` + `max-h` reproduisent `maxRows={4}`. */}
            <textarea
              rows={1}
              placeholder={composePlaceholder}
              value={draft}
              disabled={composeDisabled}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 min-w-0 p-0 border-none bg-transparent outline-none resize-none field-sizing-content max-h-[80px] text-[12.5px] leading-[1.5] text-[var(--body)] placeholder:text-[var(--faint)] disabled:opacity-50"
            />
            {composeTools}
            <button
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Envoyer"
              className="flex items-center justify-center shrink-0 w-9 h-9 rounded-[11px] border-0 bg-[var(--accent)] text-[#fff] cursor-pointer [transition:transform_.12s,background_.14s] hover:bg-[var(--accent-deep)] active:scale-[.97] disabled:opacity-[.45] disabled:cursor-default"
            >
              {sending ? <Spinner className="size-[15px] text-[#fff]" /> : <SendIcon size={15} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
