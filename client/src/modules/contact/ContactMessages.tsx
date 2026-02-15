import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Button,
  TablePagination,
  Dialog,
  DialogContent,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Inbox as InboxIcon,
  Visibility as VisibilityIcon,
  Reply as ReplyIcon,
  Delete as DeleteIcon,
  MarkAsUnread as MarkAsReadIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Send as SendIcon,
  Email as EmailIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { contactApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import ContactMessageThread from './ContactMessageThread';
import type { ContactMessageItem } from './ContactMessageThread';

// ─── Couleurs Clenzy ─────────────────────────────────────────────────────────
const C = {
  primary: '#6B8A9A',
  primaryLight: '#8BA3B3',
  primaryDark: '#5A7684',
  success: '#4A9B8E',
  warning: '#D4A574',
  error: '#C97A7A',
  info: '#7BA3C2',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
} as const;

// ─── Config statuts ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ALL:       { label: 'Tous',     color: C.primary,       bg: C.primary },
  SENT:      { label: 'Envoye',   color: C.info,          bg: `${C.info}14` },
  DELIVERED: { label: 'Delivre',  color: C.primary,       bg: `${C.primary}14` },
  READ:      { label: 'Lu',       color: C.success,       bg: `${C.success}14` },
  REPLIED:   { label: 'Repondu',  color: C.warning,       bg: `${C.warning}14` },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: 'Basse',   color: C.success,       bg: `${C.success}14` },
  MEDIUM: { label: 'Moyenne', color: C.info,          bg: `${C.info}14` },
  HIGH:   { label: 'Haute',   color: C.warning,       bg: `${C.warning}14` },
  URGENT: { label: 'Urgente', color: C.error,         bg: `${C.error}14` },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  GENERAL:     { label: 'General',     color: C.primary },
  TECHNICAL:   { label: 'Technique',   color: C.info },
  MAINTENANCE: { label: 'Maintenance', color: C.warning },
  CLEANING:    { label: 'Menage',      color: C.success },
  EMERGENCY:   { label: 'Urgence',     color: C.error },
};

// ─── Composant principal ─────────────────────────────────────────────────────

interface ContactMessagesProps {
  type: 'sent' | 'received' | 'archived';
  onUnreadCountChange?: (count: number) => void;
}

const ContactMessages: React.FC<ContactMessagesProps> = ({ type, onUnreadCountChange }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const rowsPerPage = 20;

  // Thread dialog
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Chargement ──────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint: 'inbox' | 'sent' | 'archived';
      if (type === 'archived') endpoint = 'archived';
      else if (type === 'sent') endpoint = 'sent';
      else endpoint = 'inbox';

      const data = await contactApi.getMessages(endpoint, { page, size: rowsPerPage });
      const paginatedData = data as any;
      const content: ContactMessageItem[] = paginatedData.content || [];
      setMessages(content);
      setTotalElements(paginatedData.totalElements || 0);

      if (type === 'received' && onUnreadCountChange) {
        const unreadCount = content.filter((m: ContactMessageItem) =>
          m.status !== 'READ' && m.status !== 'REPLIED'
        ).length;
        onUnreadCountChange(unreadCount);
      }
    } catch (_err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, type, rowsPerPage, onUnreadCountChange]);

  useEffect(() => {
    loadMessages();
    setSelectedIds(new Set());
  }, [loadMessages]);

  // ─── Filtrage client ─────────────────────────────────────────

  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchTerm.trim() ||
      message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || message.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // ─── Handlers ────────────────────────────────────────────────

  const handleSelect = (message: ContactMessageItem) => {
    setSelectedMessage(message);
    // Auto mark as read for received messages
    if (type === 'received' && message.status !== 'READ' && message.status !== 'REPLIED') {
      contactApi.updateStatus(Number(message.id), 'READ').then(() => {
        setMessages(prev => prev.map(m =>
          m.id === message.id ? { ...m, status: 'READ' as const } : m
        ));
        setSelectedMessage(prev =>
          prev && prev.id === message.id ? { ...prev, status: 'READ' as const } : prev
        );
      }).catch(() => { /* silent */ });
    }
  };

  const handleViewThread = () => {
    if (!selectedMessage) return;
    setThreadDialogOpen(true);
  };

  const handleThreadReply = async (messageText: string, attachments?: File[]) => {
    if (!selectedMessage) return;
    try {
      setReplyLoading(true);
      await contactApi.reply(Number(selectedMessage.id), { message: messageText, attachments });
      loadMessages();
      setThreadDialogOpen(false);
      setSelectedMessage(null);
    } catch (_err) {
      // silent
    } finally {
      setReplyLoading(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.updateStatus(Number(selectedMessage.id), 'READ');
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  const handleArchive = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.archive(Number(selectedMessage.id));
      setSelectedMessage(null);
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  const handleUnarchive = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.unarchive(Number(selectedMessage.id));
      setSelectedMessage(null);
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.delete(Number(selectedMessage.id));
      setSelectedMessage(null);
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  // ─── Bulk actions ────────────────────────────────────────────

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      await contactApi.bulkUpdateStatus(Array.from(selectedIds).map(Number), 'READ');
      setSelectedIds(new Set());
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await contactApi.bulkDelete(Array.from(selectedIds).map(Number));
      setSelectedIds(new Set());
      loadMessages();
    } catch (_err) { /* silent */ }
  };

  // ─── Format date ─────────────────────────────────────────────

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const formatShortDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  // ─── Statut filter chips ─────────────────────────────────────

  const statusFilters = ['ALL', 'SENT', 'DELIVERED', 'READ', 'REPLIED'];

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: `1px solid ${C.gray200}`, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, fontSize: 18, color: C.textSecondary }} /> }}
          sx={{
            minWidth: 180, flex: 1,
            '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', borderRadius: '8px' },
          }}
        />
        {statusFilters.map(s => (
          <Chip
            key={s}
            label={STATUS_CONFIG[s]?.label || s}
            size="small"
            onClick={() => { setFilterStatus(s); setPage(0); }}
            sx={{
              fontSize: '0.6875rem', height: 26, borderRadius: '6px', cursor: 'pointer',
              bgcolor: filterStatus === s ? STATUS_CONFIG[s]?.color || C.primary : C.gray100,
              color: filterStatus === s ? '#fff' : C.textSecondary,
              fontWeight: filterStatus === s ? 600 : 400,
              '&:hover': { opacity: 0.85 },
            }}
          />
        ))}
        <Tooltip title="Rafraichir">
          <IconButton size="small" onClick={loadMessages}>
            <RefreshIcon sx={{ fontSize: 18, color: C.textSecondary }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
          bgcolor: `${C.primary}0A`, borderBottom: `1px solid ${C.gray200}`,
        }}>
          <Checkbox
            size="small"
            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredMessages.length}
            checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
            onChange={handleSelectAll}
            sx={{ p: 0.25, color: C.primary, '&.Mui-checked': { color: C.primary } }}
          />
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textPrimary, fontWeight: 600, flex: 1 }}>
            {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
          </Typography>
          {type === 'received' && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleBulkMarkAsRead}
              startIcon={<MarkAsReadIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
                borderColor: C.gray200, color: C.textSecondary, borderRadius: '6px',
                '&:hover': { borderColor: C.primary, color: C.primary },
              }}
            >
              Marquer lu
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={handleBulkDelete}
            startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
              borderColor: C.error, color: C.error, borderRadius: '6px',
              '&:hover': { bgcolor: `${C.error}08` },
            }}
          >
            Supprimer
          </Button>
        </Box>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={32} sx={{ color: C.primary }} />
        </Box>
      ) : filteredMessages.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1.5 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InboxIcon sx={{ fontSize: 28, color: C.primary }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: C.textPrimary }}>
            {t('contact.noMessages')}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textSecondary }}>
            {t('contact.noMessagesDesc')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ─── Liste gauche (35%) ─── */}
          <Box sx={{ width: '35%', borderRight: `1px solid ${C.gray200}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {filteredMessages.map(message => {
                const isSelected = selectedMessage?.id === message.id;
                const isUnread = type === 'received' && message.status !== 'READ' && message.status !== 'REPLIED';
                const isChecked = selectedIds.has(message.id);
                const priorityConf = PRIORITY_CONFIG[message.priority];
                const statusConf = STATUS_CONFIG[message.status];
                const categoryConf = CATEGORY_CONFIG[message.category];

                const person = type === 'sent'
                  ? `${message.recipient.firstName} ${message.recipient.lastName}`
                  : `${message.sender.firstName} ${message.sender.lastName}`;

                return (
                  <Box
                    key={message.id}
                    onClick={() => handleSelect(message)}
                    sx={{
                      p: 1.25,
                      cursor: 'pointer',
                      borderBottom: `1px solid ${C.gray100}`,
                      bgcolor: isSelected ? `${C.primary}08` : 'transparent',
                      borderLeft: isSelected ? `3px solid ${C.primary}` : '3px solid transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: `${C.primary}04` },
                    }}
                  >
                    {/* Top row: checkbox + chips + unread dot */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={isChecked}
                        onClick={(e) => handleToggleSelect(e, message.id)}
                        sx={{ p: 0, mr: 0.5, color: C.gray200, '&.Mui-checked': { color: C.primary } }}
                      />
                      {categoryConf && (
                        <Chip
                          label={categoryConf.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, borderRadius: '4px',
                            bgcolor: `${categoryConf.color}14`, color: categoryConf.color,
                            fontWeight: 500,
                          }}
                        />
                      )}
                      {priorityConf && message.priority !== 'LOW' && (
                        <Chip
                          label={priorityConf.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 20, borderRadius: '4px',
                            bgcolor: priorityConf.bg, color: priorityConf.color,
                            fontWeight: 500,
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      {isUnread && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: C.warning, flexShrink: 0 }} />
                      )}
                    </Box>

                    {/* Person name */}
                    <Typography variant="body2" sx={{
                      fontSize: '0.8125rem', fontWeight: isUnread ? 700 : 500,
                      color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {person}
                    </Typography>

                    {/* Subject */}
                    <Typography variant="caption" sx={{
                      fontSize: '0.6875rem', color: C.textSecondary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                      fontWeight: isUnread ? 600 : 400,
                    }}>
                      {message.subject}
                    </Typography>

                    {/* Date + status chip */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.625rem', color: C.textSecondary }}>
                        {formatShortDate(message.createdAt)}
                      </Typography>
                      {statusConf && (
                        <Chip
                          label={statusConf.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 18, borderRadius: '4px', ml: 'auto',
                            bgcolor: statusConf.bg, color: statusConf.color, fontWeight: 500,
                          }}
                        />
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <AttachFileIcon sx={{ fontSize: 12, color: C.textSecondary, ml: 0.25 }} />
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[]}
              sx={{
                borderTop: `1px solid ${C.gray200}`, flexShrink: 0,
                '& .MuiTablePagination-displayedRows': { fontSize: '0.75rem', color: C.textSecondary },
              }}
            />
          </Box>

          {/* ─── Detail droite (65%) ─── */}
          <Box sx={{ width: '65%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedMessage ? (
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {/* Header */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {/* Category chip */}
                    {CATEGORY_CONFIG[selectedMessage.category] && (
                      <Chip
                        label={CATEGORY_CONFIG[selectedMessage.category].label}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderRadius: '6px',
                          bgcolor: `${CATEGORY_CONFIG[selectedMessage.category].color}14`,
                          color: CATEGORY_CONFIG[selectedMessage.category].color,
                          fontWeight: 500,
                        }}
                      />
                    )}
                    {/* Status chip */}
                    {STATUS_CONFIG[selectedMessage.status] && (
                      <Chip
                        label={STATUS_CONFIG[selectedMessage.status].label}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderRadius: '6px',
                          bgcolor: STATUS_CONFIG[selectedMessage.status].bg,
                          color: STATUS_CONFIG[selectedMessage.status].color,
                          fontWeight: 500,
                        }}
                      />
                    )}
                    {/* Priority chip */}
                    {PRIORITY_CONFIG[selectedMessage.priority] && (
                      <Chip
                        label={PRIORITY_CONFIG[selectedMessage.priority].label}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderRadius: '6px',
                          bgcolor: PRIORITY_CONFIG[selectedMessage.priority].bg,
                          color: PRIORITY_CONFIG[selectedMessage.priority].color,
                          fontWeight: 500,
                        }}
                      />
                    )}
                  </Box>

                  {/* Subject */}
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: C.textPrimary, mb: 1 }}>
                    {selectedMessage.subject}
                  </Typography>

                  {/* Infos contact */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14, color: C.textSecondary }} />
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textPrimary }}>
                        {type === 'sent'
                          ? `${selectedMessage.recipient.firstName} ${selectedMessage.recipient.lastName} (${selectedMessage.recipient.email})`
                          : `${selectedMessage.sender.firstName} ${selectedMessage.sender.lastName} (${selectedMessage.sender.email})`
                        }
                      </Typography>
                    </Box>
                    {type !== 'sent' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SendIcon sx={{ fontSize: 14, color: C.textSecondary }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textSecondary }}>
                          Vers : {selectedMessage.recipient.firstName} {selectedMessage.recipient.lastName}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Date */}
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: C.textSecondary }}>
                    {type === 'sent' ? 'Envoye le' : 'Recu le'} {formatDate(selectedMessage.createdAt)}
                    {selectedMessage.readAt && ` • Lu le ${formatDate(selectedMessage.readAt)}`}
                    {selectedMessage.repliedAt && ` • Repondu le ${formatDate(selectedMessage.repliedAt)}`}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Message body */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{
                    fontSize: '0.6875rem', color: C.textSecondary, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5,
                  }}>
                    Message
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontSize: '0.8125rem', color: C.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>
                    {selectedMessage.message}
                  </Typography>
                </Box>

                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{
                      fontSize: '0.6875rem', color: C.textSecondary, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5,
                    }}>
                      Pieces jointes ({selectedMessage.attachments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedMessage.attachments.map(att => (
                        <Chip
                          key={att.id}
                          icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                          label={att.originalName}
                          size="small"
                          sx={{
                            fontSize: '0.75rem', borderRadius: '6px',
                            bgcolor: C.gray100, color: C.textPrimary,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Actions */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {/* View thread */}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VisibilityIcon sx={{ fontSize: 16 }} />}
                    onClick={handleViewThread}
                    sx={{
                      textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600,
                      bgcolor: C.primary, borderRadius: '8px',
                      '&:hover': { bgcolor: C.primaryDark },
                    }}
                  >
                    Voir le fil
                  </Button>

                  {/* Reply */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setThreadDialogOpen(true)}
                    sx={{
                      textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                      borderColor: C.gray200, color: C.textSecondary, borderRadius: '8px',
                      '&:hover': { borderColor: C.primary, color: C.primary },
                    }}
                  >
                    Repondre
                  </Button>

                  {/* Mark as read (received only, unread only) */}
                  {type === 'received' && selectedMessage.status !== 'READ' && selectedMessage.status !== 'REPLIED' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<MarkAsReadIcon sx={{ fontSize: 16 }} />}
                      onClick={handleMarkAsRead}
                      sx={{
                        textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        borderColor: C.gray200, color: C.textSecondary, borderRadius: '8px',
                        '&:hover': { borderColor: C.success, color: C.success },
                      }}
                    >
                      Marquer lu
                    </Button>
                  )}

                  {/* Archive / Unarchive */}
                  {type !== 'archived' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ArchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={handleArchive}
                      sx={{
                        textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        borderColor: C.gray200, color: C.textSecondary, borderRadius: '8px',
                        '&:hover': { borderColor: C.primary, color: C.primary },
                      }}
                    >
                      Archiver
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UnarchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={handleUnarchive}
                      sx={{
                        textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        borderColor: C.gray200, color: C.textSecondary, borderRadius: '8px',
                        '&:hover': { borderColor: C.primary, color: C.primary },
                      }}
                    >
                      Desarchiver
                    </Button>
                  )}

                  {/* Delete */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                    onClick={handleDelete}
                    sx={{
                      textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                      borderColor: C.error, color: C.error, borderRadius: '8px',
                      '&:hover': { bgcolor: `${C.error}08` },
                    }}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                <EmailIcon sx={{ fontSize: 48, color: C.gray200 }} />
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textSecondary }}>
                  Selectionnez un message pour voir son contenu
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Thread dialog */}
      <Dialog
        open={threadDialogOpen}
        onClose={() => {
          setThreadDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '70vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {selectedMessage && (
            <ContactMessageThread
              message={selectedMessage}
              onReply={handleThreadReply}
              onClose={() => {
                setThreadDialogOpen(false);
              }}
              loading={replyLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ContactMessages;
