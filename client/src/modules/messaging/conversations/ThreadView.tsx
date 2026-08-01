import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Box, InputBase, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
} from '../../../icons';
import { type ThreadMessage, dayLabel, formatMsgTime } from './unified';

// ─── Styles partagés (référence .mg-ico / .mg-ctool / .mg-send) ──────────────

export const mgIcoSx: SxProps<Theme> = {
  width: 36,
  height: 36,
  borderRadius: '11px',
  border: '1px solid var(--line-2)',
  bgcolor: 'var(--card)',
  color: 'var(--muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  p: 0,
  flexShrink: 0,
  transition: 'color .14s, border-color .14s',
  '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
};

export const composeToolSx: SxProps<Theme> = {
  width: 30,
  height: 30,
  borderRadius: '8px',
  border: 0,
  bgcolor: 'transparent',
  color: 'var(--muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  p: 0,
  flexShrink: 0,
  transition: 'background .14s, color .14s',
  '&:hover': { bgcolor: 'var(--bg)', color: 'var(--accent)' },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
};

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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

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
          <Box component="button" onClick={onBack} aria-label="Retour" sx={{ ...mgIcoSx, width: 32, height: 32 }}>
            <ArrowBackIcon size={16} strokeWidth={1.75} />
          </Box>
        )}
        <div className="min-w-0">
          <p className="cn-text-body1 font-[var(--font-display)] text-[16px] font-semibold text-[var(--ink)] leading-[1.25] whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </p>
          <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1">
            {subtitle}
          </div>
        </div>
        <div className="ms-auto flex gap-1.5 items-center">
          {actions.map((action) => (
            <Tooltip key={action.key} title={action.title} arrow>
              <Box component="button" onClick={action.onClick} aria-label={action.title} sx={mgIcoSx}>
                {action.icon}
              </Box>
            </Tooltip>
          ))}
          {menuItems.length > 0 && (
            <Box
              component="button"
              onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
              aria-label="Plus d'actions"
              sx={mgIcoSx}
            >
              <MoreHorizIcon size={16} strokeWidth={1.75} />
            </Box>
          )}
        </div>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          {menuItems.map((item) => (
            <MenuItem
              key={item.key}
              disabled={item.disabled}
              onClick={() => {
                setMenuAnchor(null);
                item.onClick();
              }}
              sx={{ fontSize: '12.5px', fontWeight: 600 }}
            >
              {item.icon && <ListItemIcon sx={{ minWidth: 28, color: 'var(--muted)' }}>{item.icon}</ListItemIcon>}
              <ListItemText primaryTypographyProps={{ fontSize: '12.5px', fontWeight: 600 }}>
                {item.label}
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>
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
                <Box
                  key={msg.id}
                  sx={{
                    maxWidth: '74%',
                    p: '11px 14px',
                    borderRadius: '15px',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    ...(msg.out
                      ? {
                          alignSelf: 'flex-end',
                          bgcolor: 'var(--accent)',
                          color: '#fff',
                          borderBottomRightRadius: '5px',
                        }
                      : {
                          alignSelf: 'flex-start',
                          bgcolor: 'var(--card)',
                          border: '1px solid var(--line)',
                          color: 'var(--body)',
                          borderBottomLeftRadius: '5px',
                        }),
                  }}
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
                  <Box
                    sx={{
                      fontSize: '9.5px',
                      mt: 0.5,
                      opacity: 0.7,
                      fontVariantNumeric: 'tabular-nums',
                      ...(msg.out && { textAlign: 'right' }),
                    }}
                  >
                    {formatMsgTime(msg.at)}
                  </Box>
                </Box>
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
            <InputBase
              multiline
              maxRows={4}
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
              // Réf .mg-cbox textarea : aucun padding propre (la boîte porte le
              // padding 8/8/8/14), 12.5px lh 1.5, max-height 80.
              sx={{ flex: 1, fontSize: '12.5px', color: 'var(--body)', lineHeight: 1.5, py: 0, '& textarea': { p: 0, maxHeight: 80 } }}
            />
            {composeTools}
            <Box
              component="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Envoyer"
              sx={{
                width: 36,
                height: 36,
                borderRadius: '11px',
                bgcolor: 'var(--accent)',
                color: '#fff',
                border: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform .12s, background .14s',
                '&:hover': { bgcolor: 'var(--accent-deep)' },
                '&:active': { transform: 'scale(.97)' },
                '&:disabled': { opacity: 0.45, cursor: 'default' },
              }}
            >
              {sending ? <Spinner className="size-[15px] text-[#fff]" /> : <SendIcon size={15} strokeWidth={1.75} />}
            </Box>
          </div>
        </div>
      </div>
    </div>
  );
}
