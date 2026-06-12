import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft as BackIcon,
  Person as PersonIcon,
  Link as LinkIcon,
  MoreHoriz as MoreIcon,
  Archive as ArchiveIcon,
  Description as TemplateIcon,
  Send as SendIcon,
} from '../../../../icons';
import {
  useConversationMessages,
  useSendMessage,
  useUpdateConversationStatus,
  useSendTemplate,
} from '../../../../hooks/useConversations';
import type { ConversationDto } from '../../../../services/api/conversationApi';
import { getChannelConfig, conversationTitle } from '../../../channels/channelConfig';
import AttachReservationDialog from '../../../channels/AttachReservationDialog';
import SendWhatsAppTemplateDialog from '../../../channels/SendWhatsAppTemplateDialog';
import GuestProfileDialog from '../../../channels/GuestProfileDialog';
import { getChannelDot } from './conversationVisuals';

/** Libellé de séparateur de jour : « Aujourd'hui », « Hier », sinon date longue. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Style commun des actions d'entête (.mg-ico — 36px, radius 11). */
const icoSx = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--line-2)',
  bgcolor: 'var(--card)',
  color: 'var(--muted)',
  transition: 'color var(--duration-fast), border-color var(--duration-fast)',
  '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', bgcolor: 'var(--card)' },
} as const;

interface OtaThreadProps {
  conversation: ConversationDto;
  /** Après archivage / rattachement (désélection côté parent). */
  onStatusChanged: () => void;
  /** Retour mobile vers la liste. */
  onBack: () => void;
}

/**
 * Fil de conversation OTA (volets 2-3 de la référence Signature, section D) :
 * entête 62px (nom display + sous-titre canal · logement, actions .mg-ico),
 * fil `.mg-b in/out` avec séparateurs de jour, compose `.mg-cbox`.
 *
 * Données et actions réutilisées de la messagerie OTA existante
 * (hooks useConversations + dialogs du module channels) — l'action
 * « appeler » de la référence n'a pas d'équivalent existant : omise.
 */
export default function OtaThread({ conversation, onStatusChanged, onBack }: OtaThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading } = useConversationMessages(conversation.id);
  const messages = useMemo(() => {
    const list = [...(messagesData?.content ?? [])];
    list.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    return list;
  }, [messagesData]);

  const sendMessageMutation = useSendMessage();
  const updateStatusMutation = useUpdateConversationStatus();
  const sendTemplateMutation = useSendTemplate();

  const channelCfg = getChannelConfig(conversation.channel);
  const dot = getChannelDot(conversation.channel);
  const name = conversation.guestName ?? conversationTitle(conversation);
  const subtitle = [channelCfg.label, conversation.propertyName].filter(Boolean).join(' · ');

  // Auto-scroll en bas à l'arrivée de messages / au changement de conversation.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, conversation.id]);

  // Reset du brouillon quand on change de conversation.
  useEffect(() => {
    setReplyText('');
  }, [conversation.id]);

  // Fenêtre de service WhatsApp 24h : au-delà, Meta impose un template approuvé.
  const whatsappWindowExpired = useMemo(() => {
    if (conversation.channel !== 'WHATSAPP') return false;
    let lastInboundMs = 0;
    for (const m of messages) {
      if (m.direction === 'INBOUND') {
        const ms = new Date(m.sentAt).getTime();
        if (ms > lastInboundMs) lastInboundMs = ms;
      }
    }
    if (lastInboundMs === 0) return true;
    return Date.now() - lastInboundMs > 24 * 60 * 60 * 1000;
  }, [conversation.channel, messages]);

  const handleSend = () => {
    if (!replyText.trim() || whatsappWindowExpired || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(
      { conversationId: conversation.id, content: replyText.trim() },
      { onSuccess: () => setReplyText('') },
    );
  };

  const handleArchive = () => {
    setMenuAnchor(null);
    updateStatusMutation.mutate(
      { conversationId: conversation.id, status: 'ARCHIVED' },
      { onSuccess: onStatusChanged },
    );
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg)' }}>
      <AttachReservationDialog
        open={attachOpen}
        conversation={conversation}
        onClose={() => setAttachOpen(false)}
        onAttached={() => setAttachOpen(false)}
      />
      <SendWhatsAppTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSend={(key) =>
          sendTemplateMutation.mutate(
            { conversationId: conversation.id, templateKey: key },
            { onSuccess: () => setTemplateOpen(false) },
          )
        }
        sending={sendTemplateMutation.isPending}
        error={sendTemplateMutation.isError}
      />
      <GuestProfileDialog guestId={conversation.guestId} open={guestOpen} onClose={() => setGuestOpen(false)} />

      {/* ── Entête (.mg-th__h — 62px) ──────────────────────────────────────── */}
      <Box
        sx={{
          height: 62,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          px: '20px',
          bgcolor: 'var(--card)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <IconButton
          onClick={onBack}
          size="small"
          aria-label="Retour à la liste"
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'var(--muted)', ml: '-8px' }}
        >
          <BackIcon size={18} strokeWidth={1.75} />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </Typography>
          <Box
            sx={{
              fontSize: 'var(--text-xs)',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', color: dot.color, flexShrink: 0 }}>
              {dot.icon}
            </Box>
            <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </Box>
          </Box>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
          {conversation.guestId != null && (
            <Tooltip title="Fiche voyageur" arrow>
              <IconButton onClick={() => setGuestOpen(true)} aria-label="Fiche voyageur" sx={icoSx}>
                <PersonIcon size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
          {!conversation.reservationId && (
            <Tooltip title="Rattacher à une réservation" arrow>
              <IconButton onClick={() => setAttachOpen(true)} aria-label="Rattacher à une réservation" sx={icoSx}>
                <LinkIcon size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Plus d'actions"
            sx={icoSx}
          >
            <MoreIcon size={16} strokeWidth={1.75} />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {conversation.reservationId != null && (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  setTemplateOpen(true);
                }}
              >
                <ListItemIcon>
                  <TemplateIcon size={16} strokeWidth={1.75} />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 'var(--text-md)' }}>
                  Envoyer un template
                </ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={handleArchive} disabled={updateStatusMutation.isPending}>
              <ListItemIcon>
                <ArchiveIcon size={16} strokeWidth={1.75} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 'var(--text-md)' }}>
                Archiver la conversation
              </ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* ── Fil (.mg-msgs + .mg-daysep + .mg-b) ────────────────────────────── */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          p: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={20} />
          </Box>
        ) : messages.length === 0 ? (
          <Typography sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', textAlign: 'center', py: 4 }}>
            Aucun message dans cette conversation
          </Typography>
        ) : (
          messages.map((msg, idx) => {
            const isInbound = msg.direction === 'INBOUND';
            const prev = messages[idx - 1];
            const showDaySep = !prev || dayLabel(prev.sentAt) !== dayLabel(msg.sentAt);
            return (
              <React.Fragment key={msg.id}>
                {showDaySep && (
                  <Box
                    sx={{
                      alignSelf: 'center',
                      fontSize: 'var(--text-2xs)',
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--faint)',
                      bgcolor: 'var(--card)',
                      border: '1px solid var(--line)',
                      p: '4px 13px',
                      borderRadius: '20px',
                    }}
                  >
                    {dayLabel(msg.sentAt)}
                  </Box>
                )}
                <Box
                  sx={{
                    maxWidth: '74%',
                    p: '11px 14px',
                    borderRadius: '15px',
                    fontSize: 'var(--text-md)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    ...(isInbound
                      ? {
                          alignSelf: 'flex-start',
                          bgcolor: 'var(--card)',
                          border: '1px solid var(--line)',
                          color: 'var(--body)',
                          borderBottomLeftRadius: '5px',
                        }
                      : {
                          alignSelf: 'flex-end',
                          bgcolor: 'var(--accent)',
                          color: 'var(--on-accent)',
                          borderBottomRightRadius: '5px',
                        }),
                  }}
                >
                  {msg.content}
                  <Box
                    sx={{
                      fontSize: '9.5px',
                      mt: '4px',
                      opacity: 0.7,
                      fontVariantNumeric: 'tabular-nums',
                      ...(isInbound ? {} : { textAlign: 'right' }),
                    }}
                  >
                    {new Date(msg.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Box>
                </Box>
              </React.Fragment>
            );
          })
        )}
      </Box>

      {/* ── Compose (.mg-compose + .mg-cbox) ───────────────────────────────── */}
      <Box sx={{ flexShrink: 0, p: '14px 20px', bgcolor: 'var(--card)', borderTop: '1px solid var(--line)' }}>
        {whatsappWindowExpired && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--text-xs)',
              color: 'var(--warn)',
              bgcolor: 'var(--warn-soft)',
              borderRadius: 'var(--radius-sm)',
              p: '7px 12px',
              mb: '10px',
            }}
          >
            <Box component="span" sx={{ flex: 1 }}>
              Fenêtre de 24h dépassée — un template est requis pour relancer ce voyageur.
            </Box>
            {conversation.reservationId != null && (
              <Box
                component="button"
                onClick={() => setTemplateOpen(true)}
                sx={{
                  border: 0,
                  background: 'none',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--warn)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  p: 0,
                  flexShrink: 0,
                }}
              >
                Envoyer un template
              </Box>
            )}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            bgcolor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: '13px',
            p: '8px 8px 8px 14px',
          }}
        >
          <Box
            component="textarea"
            rows={1}
            value={replyText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={whatsappWindowExpired}
            placeholder={
              whatsappWindowExpired
                ? 'Réponse libre indisponible (template requis)'
                : `Répondre${conversation.guestName ? ` à ${conversation.guestName.split(' ')[0]}` : ''}…`
            }
            sx={{
              flex: 1,
              border: 0,
              outline: 0,
              background: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 'var(--text-sm)',
              color: 'var(--body)',
              lineHeight: 1.5,
              maxHeight: 80,
              py: '7px',
              '&::placeholder': { color: 'var(--faint)' },
            }}
          />
          {conversation.reservationId != null && (
            <Tooltip title="Envoyer un template WhatsApp" arrow>
              <IconButton
                onClick={() => setTemplateOpen(true)}
                aria-label="Envoyer un template WhatsApp"
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  '&:hover': { bgcolor: 'var(--bg)', color: 'var(--accent)' },
                }}
              >
                <TemplateIcon size={15} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            onClick={handleSend}
            disabled={!replyText.trim() || sendMessageMutation.isPending || whatsappWindowExpired}
            aria-label="Envoyer"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              bgcolor: 'var(--accent)',
              color: 'var(--on-accent)',
              flexShrink: 0,
              transition: 'background var(--duration-fast), transform .12s',
              '&:hover': { bgcolor: 'var(--accent-deep)' },
              '&:active': { transform: 'scale(.97)' },
              '&.Mui-disabled': { bgcolor: 'var(--field)', color: 'var(--faint)' },
            }}
          >
            <SendIcon size={16} strokeWidth={1.75} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
