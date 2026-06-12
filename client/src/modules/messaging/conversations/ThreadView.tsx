import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
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
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: 'var(--bg)' }}>
      {/* ── Entête 62px ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          height: 62,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          bgcolor: 'var(--card)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {showBack && (
          <Box component="button" onClick={onBack} aria-label="Retour" sx={{ ...mgIcoSx, width: 32, height: 32 }}>
            <ArrowBackIcon size={16} strokeWidth={1.75} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--ink)',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </Typography>
          <Box sx={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {subtitle}
          </Box>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
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
        </Box>
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
      </Box>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <Box
        ref={scrollRef}
        sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={20} />
          </Box>
        ) : grouped.length === 0 ? (
          <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center', py: 4 }}>
            Aucun message dans cette conversation
          </Typography>
        ) : (
          grouped.map((group) => (
            <React.Fragment key={group.day}>
              <Box
                sx={{
                  alignSelf: 'center',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'var(--faint)',
                  bgcolor: 'var(--card)',
                  border: '1px solid var(--line)',
                  p: '4px 13px',
                  borderRadius: '20px',
                }}
              >
                {group.day}
              </Box>
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
                    <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {msg.attachments.map((name) => (
                        <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '11px', opacity: 0.85 }}>
                          <AttachFileIcon size={11} strokeWidth={1.75} />
                          {name}
                        </Box>
                      ))}
                    </Box>
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
      </Box>

      {/* ── Compose ─────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, bgcolor: 'var(--card)', borderTop: '1px solid var(--line)' }}>
        {composeNotice}
        <Box sx={{ p: '14px 20px' }}>
          {composeExtra}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1.25,
              bgcolor: 'var(--field)',
              border: '1px solid var(--field-line)',
              borderRadius: '13px',
              p: '8px 8px 8px 14px',
            }}
          >
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
              sx={{ flex: 1, fontSize: '12.5px', color: 'var(--body)', lineHeight: 1.5, py: 0.5, '& textarea': { p: 0 } }}
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
              {sending ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : <SendIcon size={15} strokeWidth={1.75} />}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
