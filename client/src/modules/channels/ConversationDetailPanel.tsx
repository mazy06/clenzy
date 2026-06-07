import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Person as PersonIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Link as LinkIcon,
  Description as TemplateIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useConversationMessages,
  useSendMessage,
  useUpdateConversationStatus,
  useSendTemplate,
} from '../../hooks/useConversations';
import type { ConversationDto } from '../../services/api/conversationApi';
import { getChannelConfig, conversationTitle } from './channelConfig';
import AttachReservationDialog from './AttachReservationDialog';
import SendWhatsAppTemplateDialog from './SendWhatsAppTemplateDialog';

interface ConversationDetailPanelProps {
  conversation: ConversationDto;
  /** Conversation archivée → lecture seule (pas de réponse, action = restaurer). */
  archivedOnly?: boolean;
  /** Affiche le bouton fermer (drawer / retour mobile). */
  showClose?: boolean;
  /** Appelé au clic sur fermer. */
  onClose?: () => void;
  /** Appelé après archivage / restauration (désélection côté parent). */
  onStatusChanged?: () => void;
}

/**
 * Vue détaillée d'UNE conversation (header + fil de messages + réponse).
 *
 * Réutilisable : rendu inline dans le master-detail (Contact > Messagerie OTA)
 * ET dans un drawer latéral (futur accès rapide global, cf.
 * {@link ConversationQuickDrawer}). Prend toute la hauteur de son conteneur.
 */
export default function ConversationDetailPanel({
  conversation,
  archivedOnly = false,
  showClose = false,
  onClose,
  onStatusChanged,
}: ConversationDetailPanelProps) {
  const { t } = useTranslation();
  const [replyText, setReplyText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading } = useConversationMessages(conversation.id);
  const messages = useMemo(() => messagesData?.content ?? [], [messagesData]);

  const sendMessageMutation = useSendMessage();
  const updateStatusMutation = useUpdateConversationStatus();
  const sendTemplateMutation = useSendTemplate();

  const channelCfg = getChannelConfig(conversation.channel);
  const title = conversationTitle(conversation);

  // Auto-scroll en bas à l'arrivée de nouveaux messages / au changement de conversation.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, conversation.id]);

  // Reset du brouillon quand on change de conversation.
  useEffect(() => { setReplyText(''); }, [conversation.id]);

  // Fenêtre de service WhatsApp 24h : au-delà de 24h après le dernier message
  // ENTRANT du guest, Meta interdit la réponse libre (template approuvé requis).
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

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    sendMessageMutation.mutate(
      { conversationId: conversation.id, content: replyText.trim() },
      { onSuccess: () => setReplyText('') },
    );
  };

  const handleArchive = () => {
    updateStatusMutation.mutate(
      { conversationId: conversation.id, status: 'ARCHIVED' },
      { onSuccess: onStatusChanged },
    );
  };

  const handleRestore = () => {
    updateStatusMutation.mutate(
      { conversationId: conversation.id, status: 'OPEN' },
      { onSuccess: onStatusChanged },
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <AttachReservationDialog
        open={attachOpen}
        conversation={conversation}
        onClose={() => setAttachOpen(false)}
        onAttached={() => { setAttachOpen(false); onStatusChanged?.(); }}
      />
      <SendWhatsAppTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSend={(key) => sendTemplateMutation.mutate(
          { conversationId: conversation.id, templateKey: key },
          { onSuccess: () => setTemplateOpen(false) },
        )}
        sending={sendTemplateMutation.isPending}
        error={sendTemplateMutation.isError}
      />
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: channelCfg.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {conversation.guestName ? <PersonIcon size={18} strokeWidth={1.75} /> : channelCfg.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </Typography>
              <Chip
                label={channelCfg.label}
                size="small"
                sx={{
                  fontSize: '0.625rem',
                  height: 18,
                  fontWeight: 600,
                  bgcolor: `${channelCfg.color}18`,
                  color: channelCfg.color,
                  border: `1px solid ${channelCfg.color}40`,
                  flexShrink: 0,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
            {conversation.propertyName && (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {conversation.propertyName}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {!archivedOnly && !conversation.reservationId && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LinkIcon size={15} strokeWidth={1.75} />}
              onClick={() => setAttachOpen(true)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: '8px', mr: 0.5 }}
            >
              Rattacher
            </Button>
          )}
          {!archivedOnly && conversation.reservationId && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<TemplateIcon size={15} strokeWidth={1.75} />}
              onClick={() => setTemplateOpen(true)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: '8px', mr: 0.5 }}
            >
              Template
            </Button>
          )}
          {!archivedOnly ? (
            <Tooltip title="Archiver la conversation" arrow>
              <span>
                <IconButton
                  onClick={handleArchive}
                  size="small"
                  disabled={updateStatusMutation.isPending}
                  sx={{ color: 'text.secondary' }}
                  aria-label="Archiver"
                >
                  <ArchiveIcon size={'1.125rem'} strokeWidth={1.75} />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Restaurer la conversation" arrow>
              <span>
                <IconButton
                  onClick={handleRestore}
                  size="small"
                  disabled={updateStatusMutation.isPending}
                  sx={{ color: 'text.secondary' }}
                  aria-label="Restaurer"
                >
                  <UnarchiveIcon size={'1.125rem'} strokeWidth={1.75} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {showClose && (
            <IconButton onClick={onClose} size="small" aria-label="Fermer">
              <CloseIcon size={'1.125rem'} strokeWidth={1.75} />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* ── Fil de messages ──────────────────────────────────────────────── */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          minHeight: 0,
          bgcolor: 'background.default',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={20} />
          </Box>
        ) : messages.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', textAlign: 'center', py: 4 }}>
            {t('channelInbox.noMessages', 'Aucun message dans cette conversation')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {messages.map((msg, idx) => {
              const isInbound = msg.direction === 'INBOUND';
              const prev = messages[idx - 1];
              const grouped = !!prev && prev.direction === msg.direction;
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isInbound ? 'flex-start' : 'flex-end',
                    mt: grouped ? 0 : 0.75,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '78%',
                      bgcolor: isInbound ? 'background.paper' : 'primary.main',
                      color: isInbound ? 'text.primary' : '#fff',
                      border: isInbound ? '1px solid' : 'none',
                      borderColor: 'divider',
                      borderRadius: 2,
                      borderTopLeftRadius: isInbound && !grouped ? '4px' : undefined,
                      borderTopRightRadius: !isInbound && !grouped ? '4px' : undefined,
                      px: 1.5,
                      py: 0.875,
                      boxShadow: isInbound ? 'none' : '0 1px 2px rgba(107,138,154,0.25)',
                    }}
                  >
                    {isInbound && msg.senderName && !grouped && (
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, mb: 0.25, color: 'text.secondary' }}>
                        {msg.senderName}
                      </Typography>
                    )}
                    <Typography
                      sx={{ fontSize: '0.8125rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {msg.content}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{ fontSize: '0.5625rem', color: 'text.secondary', mt: 0.25, px: 0.5, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {new Date(msg.sentAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Réponse (masquée en lecture seule) ───────────────────────────── */}
      {!archivedOnly && (
        <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}>
          {whatsappWindowExpired && (
            <Alert
              severity="warning"
              sx={{ borderRadius: 0, fontSize: '0.72rem', py: 0.25, alignItems: 'center' }}
              action={conversation.reservationId ? (
                <Button color="inherit" size="small" onClick={() => setTemplateOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Envoyer un template
                </Button>
              ) : undefined}
            >
              Fenêtre de 24h dépassée — un template est requis pour relancer ce voyageur.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, p: 1.5, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder={
                whatsappWindowExpired
                  ? 'Réponse libre indisponible (template requis)'
                  : (t('contact.replyPlaceholder') || 'Écrire une réponse…')
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              disabled={whatsappWindowExpired}
              sx={{
                '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                '& .MuiOutlinedInput-root': { borderRadius: '20px' },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSendReply}
              disabled={!replyText.trim() || sendMessageMutation.isPending || whatsappWindowExpired}
              sx={{ mb: 0.25 }}
              aria-label="Envoyer"
            >
              <SendIcon size={'1.125rem'} strokeWidth={1.75} />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}
