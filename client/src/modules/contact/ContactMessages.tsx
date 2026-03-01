import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Skeleton,
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
  Download as DownloadIcon,
} from '@mui/icons-material';
import { contactApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useContactMessages as useContactMessagesQuery,
  useUpdateMessageStatus,
  useArchiveMessage,
  useUnarchiveMessage,
  useDeleteMessage,
  useReplyMessage,
  useBulkUpdateStatus,
  useBulkDeleteMessages,
} from '../../hooks/useContactMessages';
import ContactMessageThread from './ContactMessageThread';
import type { ContactMessageItem } from './ContactMessageThread';
import PhotoLightbox from '../../components/PhotoLightbox';

// ─── Config statuts (utilise les tokens MUI palette) ─────────────────────────
const STATUS_CONFIG: Record<string, { label: string; palette: string }> = {
  ALL:       { label: 'Tous',     palette: 'primary' },
  SENT:      { label: 'Envoye',   palette: 'info' },
  DELIVERED: { label: 'Delivre',  palette: 'primary' },
  READ:      { label: 'Lu',       palette: 'success' },
  REPLIED:   { label: 'Repondu',  palette: 'warning' },
};

const PRIORITY_CONFIG: Record<string, { label: string; palette: string }> = {
  LOW:    { label: 'Basse',   palette: 'success' },
  MEDIUM: { label: 'Moyenne', palette: 'info' },
  HIGH:   { label: 'Haute',   palette: 'warning' },
  URGENT: { label: 'Urgente', palette: 'error' },
};

const CATEGORY_CONFIG: Record<string, { label: string; palette: string }> = {
  GENERAL:     { label: 'General',     palette: 'primary' },
  TECHNICAL:   { label: 'Technique',   palette: 'info' },
  MAINTENANCE: { label: 'Maintenance', palette: 'warning' },
  CLEANING:    { label: 'Menage',      palette: 'success' },
  EMERGENCY:   { label: 'Urgence',     palette: 'error' },
};

// ─── Image detection ─────────────────────────────────────────────────────────

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

function isImageAttachment(att: { contentType?: string; originalName?: string }): boolean {
  if (att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.toLowerCase())) return true;
  const ext = att.originalName?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface ContactMessagesProps {
  type: 'sent' | 'received' | 'archived';
  onUnreadCountChange?: (count: number) => void;
}

const ContactMessages: React.FC<ContactMessagesProps> = ({ type, onUnreadCountChange }) => {
  const { t } = useTranslation();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  // Thread dialog
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Image preview
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const blobUrlsRef = useRef<string[]>([]);

  // ─── React Query ───────────────────────────────────────────────

  const endpoint = useMemo<'inbox' | 'sent' | 'archived'>(() => {
    if (type === 'archived') return 'archived';
    if (type === 'sent') return 'sent';
    return 'inbox';
  }, [type]);

  const { data, isLoading, refetch } = useContactMessagesQuery(endpoint, page, rowsPerPage);

  const messages = useMemo(
    () => (data?.content || []) as unknown as ContactMessageItem[],
    [data],
  );
  const totalElements = data?.totalElements || 0;

  // Mutations
  const updateStatusMutation = useUpdateMessageStatus();
  const archiveMutation = useArchiveMessage();
  const unarchiveMutation = useUnarchiveMessage();
  const deleteMutation = useDeleteMessage();
  const replyMutation = useReplyMessage();
  const bulkUpdateStatusMutation = useBulkUpdateStatus();
  const bulkDeleteMutation = useBulkDeleteMessages();

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  // Notify parent of unread count
  useEffect(() => {
    if (type === 'received' && onUnreadCountChange && messages.length > 0) {
      const unreadCount = messages.filter(
        (m) => m.status !== 'READ' && m.status !== 'REPLIED',
      ).length;
      onUnreadCountChange(unreadCount);
    }
  }, [messages, type, onUnreadCountChange]);

  // Load image blob URLs when selected message changes
  useEffect(() => {
    blobUrlsRef.current.forEach(url => window.URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    setImageUrls({});

    if (!selectedMessage?.attachments) return;
    const imageAtts = selectedMessage.attachments.filter(isImageAttachment);
    if (imageAtts.length === 0) return;

    let active = true;
    imageAtts.forEach(att => {
      contactApi.getAttachmentBlobUrl(Number(selectedMessage.id), att.id)
        .then(url => {
          if (!active) { window.URL.revokeObjectURL(url); return; }
          blobUrlsRef.current.push(url);
          setImageUrls(prev => ({ ...prev, [att.id]: url }));
        })
        .catch(() => {});
    });

    return () => { active = false; };
  }, [selectedMessage?.id]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => window.URL.revokeObjectURL(url));
    };
  }, []);

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
      updateStatusMutation.mutate(
        { id: Number(message.id), status: 'READ' },
        {
          onSuccess: () => {
            setSelectedMessage(prev =>
              prev && prev.id === message.id ? { ...prev, status: 'READ' as const } : prev
            );
          },
        },
      );
    }
  };

  const handleViewThread = () => {
    if (!selectedMessage) return;
    setThreadDialogOpen(true);
  };

  const handleThreadReply = async (messageText: string, attachments?: File[]) => {
    if (!selectedMessage) return;
    replyMutation.mutate(
      { id: Number(selectedMessage.id), data: { message: messageText, attachments } },
      {
        onSuccess: () => {
          setThreadDialogOpen(false);
          setSelectedMessage(null);
        },
      },
    );
  };

  const handleMarkAsRead = () => {
    if (!selectedMessage) return;
    updateStatusMutation.mutate({ id: Number(selectedMessage.id), status: 'READ' });
  };

  const handleArchive = () => {
    if (!selectedMessage) return;
    archiveMutation.mutate(Number(selectedMessage.id), {
      onSuccess: () => setSelectedMessage(null),
    });
  };

  const handleUnarchive = () => {
    if (!selectedMessage) return;
    unarchiveMutation.mutate(Number(selectedMessage.id), {
      onSuccess: () => setSelectedMessage(null),
    });
  };

  const handleDelete = () => {
    if (!selectedMessage) return;
    deleteMutation.mutate(Number(selectedMessage.id), {
      onSuccess: () => setSelectedMessage(null),
    });
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

  const handleBulkMarkAsRead = () => {
    if (selectedIds.size === 0) return;
    bulkUpdateStatusMutation.mutate(
      { ids: Array.from(selectedIds).map(Number), status: 'READ' },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(
      Array.from(selectedIds).map(Number),
      { onSuccess: () => setSelectedIds(new Set()) },
    );
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
      <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} /> }}
          sx={{
            minWidth: 180, flex: 1,
            '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', borderRadius: '8px' },
          }}
        />
        {statusFilters.map(s => {
          const conf = STATUS_CONFIG[s];
          return (
            <Chip
              key={s}
              label={conf?.label || s}
              size="small"
              variant="outlined"
              color={(conf?.palette || 'primary') as 'primary' | 'info' | 'success' | 'warning' | 'error'}
              onClick={() => { setFilterStatus(s); setPage(0); }}
              sx={{
                fontSize: '0.6875rem', height: 26, borderRadius: '6px', cursor: 'pointer',
                borderWidth: 1.5, '& .MuiChip-label': { px: 1 },
                fontWeight: filterStatus === s ? 600 : 400,
                ...(filterStatus === s && {
                  bgcolor: `${conf?.palette || 'primary'}.main`,
                  color: `${conf?.palette || 'primary'}.contrastText`,
                }),
                '&:hover': { opacity: 0.85 },
              }}
            />
          );
        })}
        <Tooltip title="Rafraichir">
          <IconButton size="small" onClick={() => refetch()}>
            <RefreshIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
          bgcolor: 'action.selected', borderBottom: 1, borderColor: 'divider',
        }}>
          <Checkbox
            size="small"
            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredMessages.length}
            checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
            onChange={handleSelectAll}
            sx={{ p: 0.25, color: 'primary.main', '&.Mui-checked': { color: 'primary.main' } }}
          />
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 600, flex: 1 }}>
            {selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}
          </Typography>
          {type === 'received' && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleBulkMarkAsRead}
              disabled={bulkUpdateStatusMutation.isPending}
              startIcon={<MarkAsReadIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
                borderRadius: '6px',
              }}
            >
              Marquer lu
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
              borderRadius: '6px',
            }}
          >
            Supprimer
          </Button>
        </Box>
      )}

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={32} color="primary" />
        </Box>
      ) : filteredMessages.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1.5 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InboxIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>
            {t('contact.noMessages')}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
            {t('contact.noMessagesDesc')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ─── Liste gauche (35%) ─── */}
          <Box sx={{ width: '35%', borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                      borderBottom: 1, borderColor: 'divider',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      borderLeft: isSelected ? 3 : 3,
                      borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {/* Top row: checkbox + chips + unread dot */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={isChecked}
                        onClick={(e) => handleToggleSelect(e, message.id)}
                        sx={{ p: 0, mr: 0.5, color: 'text.disabled', '&.Mui-checked': { color: 'primary.main' } }}
                      />
                      {categoryConf && (
                        <Chip
                          label={categoryConf.label}
                          size="small"
                          variant="outlined"
                          color={categoryConf.palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                          sx={{
                            fontSize: '0.625rem', height: 22, borderWidth: 1.5,
                            fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                      {priorityConf && message.priority !== 'LOW' && (
                        <Chip
                          label={priorityConf.label}
                          size="small"
                          variant="outlined"
                          color={priorityConf.palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                          sx={{
                            fontSize: '0.625rem', height: 22, borderWidth: 1.5,
                            fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      {isUnread && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
                      )}
                    </Box>

                    {/* Person name */}
                    <Typography variant="body2" sx={{
                      fontSize: '0.8125rem', fontWeight: isUnread ? 700 : 500,
                      color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {person}
                    </Typography>

                    {/* Subject */}
                    <Typography variant="caption" sx={{
                      fontSize: '0.6875rem', color: 'text.secondary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                      fontWeight: isUnread ? 600 : 400,
                    }}>
                      {message.subject}
                    </Typography>

                    {/* Date + status chip */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                        {formatShortDate(message.createdAt)}
                      </Typography>
                      {statusConf && (
                        <Chip
                          label={statusConf.label}
                          size="small"
                          variant="outlined"
                          color={statusConf.palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                          sx={{
                            fontSize: '0.625rem', height: 22, borderWidth: 1.5, ml: 'auto',
                            fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <AttachFileIcon sx={{ fontSize: 12, color: 'text.secondary', ml: 0.25 }} />
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
                borderTop: 1, borderColor: 'divider', flexShrink: 0,
                '& .MuiTablePagination-displayedRows': { fontSize: '0.75rem', color: 'text.secondary' },
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
                        variant="outlined"
                        color={CATEGORY_CONFIG[selectedMessage.category].palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderWidth: 1.5,
                          fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                    {/* Status chip */}
                    {STATUS_CONFIG[selectedMessage.status] && (
                      <Chip
                        label={STATUS_CONFIG[selectedMessage.status].label}
                        size="small"
                        variant="outlined"
                        color={STATUS_CONFIG[selectedMessage.status].palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderWidth: 1.5,
                          fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                    {/* Priority chip */}
                    {PRIORITY_CONFIG[selectedMessage.priority] && (
                      <Chip
                        label={PRIORITY_CONFIG[selectedMessage.priority].label}
                        size="small"
                        variant="outlined"
                        color={PRIORITY_CONFIG[selectedMessage.priority].palette as 'primary' | 'info' | 'success' | 'warning' | 'error'}
                        sx={{
                          fontSize: '0.6875rem', height: 22, borderWidth: 1.5,
                          fontWeight: 500, '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                  </Box>

                  {/* Subject */}
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary', mb: 1 }}>
                    {selectedMessage.subject}
                  </Typography>

                  {/* Infos contact */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                        {type === 'sent'
                          ? `${selectedMessage.recipient.firstName} ${selectedMessage.recipient.lastName} (${selectedMessage.recipient.email})`
                          : `${selectedMessage.sender.firstName} ${selectedMessage.sender.lastName} (${selectedMessage.sender.email})`
                        }
                      </Typography>
                    </Box>
                    {type !== 'sent' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SendIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                          Vers : {selectedMessage.recipient.firstName} {selectedMessage.recipient.lastName}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Date */}
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    {type === 'sent' ? 'Envoye le' : 'Recu le'} {formatDate(selectedMessage.createdAt)}
                    {selectedMessage.readAt && ` • Lu le ${formatDate(selectedMessage.readAt)}`}
                    {selectedMessage.repliedAt && ` • Repondu le ${formatDate(selectedMessage.repliedAt)}`}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Message body */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{
                    fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5,
                  }}>
                    Message
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontSize: '0.8125rem', color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>
                    {selectedMessage.message}
                  </Typography>
                </Box>

                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (() => {
                  const imgAtts = selectedMessage.attachments.filter(isImageAttachment);
                  const fileAtts = selectedMessage.attachments.filter(a => !isImageAttachment(a));
                  const photos: string[] = [];
                  const idxMap: Record<string, number> = {};
                  imgAtts.forEach(a => {
                    const u = imageUrls[a.id];
                    if (u) { idxMap[a.id] = photos.length; photos.push(u); }
                  });

                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{
                        fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5,
                      }}>
                        Pieces jointes ({selectedMessage.attachments.length})
                      </Typography>

                      {/* Image attachments - inline preview */}
                      {imgAtts.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: fileAtts.length > 0 ? 1 : 0 }}>
                          {imgAtts.map(att => {
                            const url = imageUrls[att.id];
                            if (!url) {
                              return <Skeleton key={att.id} variant="rectangular" width={160} height={120} sx={{ borderRadius: 1 }} />;
                            }
                            return (
                              <Box
                                key={att.id}
                                component="img"
                                src={url}
                                alt={att.originalName}
                                onClick={() => {
                                  const idx = idxMap[att.id];
                                  if (idx !== undefined) { setLightboxIndex(idx); setLightboxOpen(true); }
                                }}
                                sx={{
                                  width: 160, height: 120,
                                  objectFit: 'cover', borderRadius: 1,
                                  cursor: 'pointer', border: 1, borderColor: 'divider',
                                  transition: 'all 0.2s',
                                  '&:hover': { opacity: 0.85, boxShadow: 2 },
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}

                      {/* Non-image file attachments */}
                      {fileAtts.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {fileAtts.map(att => (
                            <Chip
                              key={att.id}
                              icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                              label={att.originalName}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => contactApi.downloadAttachment(Number(selectedMessage.id), att.id, att.originalName)}
                              deleteIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                              onDelete={() => contactApi.downloadAttachment(Number(selectedMessage.id), att.id, att.originalName)}
                              sx={{
                                fontSize: '0.75rem', borderWidth: 1.5,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            />
                          ))}
                        </Box>
                      )}

                      {/* Lightbox for full-size image viewing */}
                      <PhotoLightbox
                        open={lightboxOpen}
                        photos={photos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxOpen(false)}
                      />
                    </Box>
                  );
                })()}

                {/* Actions */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {/* View thread */}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VisibilityIcon sx={{ fontSize: 16 }} />}
                    onClick={handleViewThread}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Voir le fil
                  </Button>

                  {/* Reply */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setThreadDialogOpen(true)}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                  >
                    Repondre
                  </Button>

                  {/* Mark as read (received only, unread only) */}
                  {type === 'received' && selectedMessage.status !== 'READ' && selectedMessage.status !== 'REPLIED' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      disabled={updateStatusMutation.isPending}
                      startIcon={<MarkAsReadIcon sx={{ fontSize: 16 }} />}
                      onClick={handleMarkAsRead}
                      sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                    >
                      Marquer lu
                    </Button>
                  )}

                  {/* Archive / Unarchive */}
                  {type !== 'archived' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={archiveMutation.isPending}
                      startIcon={<ArchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={handleArchive}
                      sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                    >
                      Archiver
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={unarchiveMutation.isPending}
                      startIcon={<UnarchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={handleUnarchive}
                      sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                    >
                      Desarchiver
                    </Button>
                  )}

                  {/* Delete */}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={deleteMutation.isPending}
                    startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                    onClick={handleDelete}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '8px' }}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                <EmailIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
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
              loading={replyMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ContactMessages;
