import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogContent,
  TextField,
  FormControl,
  Select,
  Grid,
  Checkbox,
  Toolbar,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Reply as ReplyIcon,
  Delete as DeleteIcon,
  MarkAsUnread as MarkAsReadIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { contactApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import ContactMessageThread from './ContactMessageThread';
import type { ContactMessageItem } from './ContactMessageThread';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface ContactMessagesProps {
  type: 'sent' | 'received' | 'archived';
  onUnreadCountChange?: (count: number) => void;
}

const ContactMessages: React.FC<ContactMessagesProps> = ({ type, onUnreadCountChange }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let endpoint: 'inbox' | 'sent' | 'archived';
      if (type === 'archived') {
        endpoint = 'archived';
      } else if (type === 'sent') {
        endpoint = 'sent';
      } else {
        endpoint = 'inbox';
      }

      const data = await contactApi.getMessages(endpoint, { page: page - 1, size: pageSize });
      const paginatedData = data as any;
      const content: ContactMessageItem[] = paginatedData.content || [];
      setMessages(content);
      setTotalPages(paginatedData.totalPages || 0);

      // Compute unread count for received messages
      if (type === 'received' && onUnreadCountChange) {
        const unreadCount = content.filter((m: ContactMessageItem) => m.status !== 'READ' && m.status !== 'REPLIED').length;
        onUnreadCountChange(unreadCount);
      }
    } catch (_err) {
      setError(t('contact.errors.connectionError'));
    } finally {
      setLoading(false);
    }
  }, [page, type, pageSize, onUnreadCountChange, t]);

  useEffect(() => {
    loadMessages();
    setSelectedIds(new Set());
  }, [loadMessages]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, message: ContactMessageItem) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewMessage = () => {
    setThreadDialogOpen(true);
    setAnchorEl(null);
  };

  const handleMarkAsRead = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.updateStatus(Number(selectedMessage.id), 'READ');
      loadMessages();
    } catch (_err) {
      // silent
    }
    setAnchorEl(null);
  };

  const handleReply = () => {
    // Open thread view for inline reply
    setThreadDialogOpen(true);
    setAnchorEl(null);
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

  const handleDelete = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.delete(Number(selectedMessage.id));
      loadMessages();
    } catch (_err) {
      // silent
    }
    setAnchorEl(null);
  };

  const handleArchive = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.archive(Number(selectedMessage.id));
      loadMessages();
    } catch (_err) {
      // silent
    }
    setAnchorEl(null);
  };

  const handleUnarchive = async () => {
    if (!selectedMessage) return;
    try {
      await contactApi.unarchive(Number(selectedMessage.id));
      loadMessages();
    } catch (_err) {
      // silent
    }
    setAnchorEl(null);
  };

  // Bulk actions
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
    } catch (_err) {
      // silent
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await contactApi.bulkDelete(Array.from(selectedIds).map(Number));
      setSelectedIds(new Set());
      loadMessages();
    } catch (_err) {
      // silent
    }
  };

  const getPriorityColor = (priority: string): ChipColor => {
    switch (priority) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'info';
      case 'HIGH': return 'warning';
      case 'URGENT': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'SENT': return 'info';
      case 'DELIVERED': return 'primary';
      case 'READ': return 'success';
      case 'REPLIED': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SENT': return t('contact.statuses.sent');
      case 'DELIVERED': return t('contact.statuses.delivered');
      case 'READ': return t('contact.statuses.read');
      case 'REPLIED': return t('contact.statuses.replied');
      default: return status;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'sent': return t('contact.messagesSent');
      case 'archived': return t('contact.archived');
      default: return t('contact.messagesReceived');
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || message.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
            <Typography variant="h6">
              {getTitle()}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadMessages}
              disabled={loading}
            >
              {t('contact.refresh')}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
              {error}
            </Alert>
          )}

          {/* Bulk actions toolbar */}
          {selectedIds.size > 0 && (
            <Toolbar
              variant="dense"
              sx={{
                mb: 1,
                flexShrink: 0,
                bgcolor: 'primary.light',
                borderRadius: 1,
                color: 'primary.contrastText',
                minHeight: 40,
                gap: 1
              }}
            >
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 'medium' }}>
                {selectedIds.size} {t('contact.selected')}
              </Typography>
              {type === 'received' && (
                <Button
                  size="small"
                  variant="contained"
                  color="inherit"
                  onClick={handleBulkMarkAsRead}
                  sx={{ color: 'primary.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                >
                  {t('contact.bulkMarkAsRead')}
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleBulkDelete}
              >
                {t('contact.bulkDelete')}
              </Button>
            </Toolbar>
          )}

          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 2, alignItems: 'center', flexShrink: 0 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                size="small"
                placeholder={t('contact.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ minWidth: '60px', color: 'text.secondary' }}>
                  {t('contact.statusLabel')}
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    fullWidth
                    size="small"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    sx={{ flexGrow: 1 }}
                  >
                    <MenuItem value="ALL">{t('contact.allStatuses')}</MenuItem>
                    <MenuItem value="SENT">{t('contact.statuses.sent')}</MenuItem>
                    <MenuItem value="DELIVERED">{t('contact.statuses.delivered')}</MenuItem>
                    <MenuItem value="READ">{t('contact.statuses.read')}</MenuItem>
                    <MenuItem value="REPLIED">{t('contact.statuses.replied')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grid>
          </Grid>

          {filteredMessages.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('contact.noMessages')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('contact.noMessagesDesc')}
              </Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'auto'
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedIds.size > 0 && selectedIds.size < filteredMessages.length}
                        checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
                        onChange={handleSelectAll}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{t('contact.subject')}</TableCell>
                    <TableCell>{type === 'sent' ? t('contact.recipient') : t('contact.sender')}</TableCell>
                    <TableCell>{t('contact.priority')}</TableCell>
                    <TableCell>{t('contact.category')}</TableCell>
                    <TableCell>{t('contact.status')}</TableCell>
                    <TableCell>{t('contact.date')}</TableCell>
                    <TableCell>{t('contact.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMessages.map((message) => (
                    <TableRow
                      key={message.id}
                      hover
                      selected={selectedIds.has(message.id)}
                      sx={{
                        fontWeight: type === 'received' && message.status !== 'READ' && message.status !== 'REPLIED' ? 'bold' : 'normal',
                        bgcolor: type === 'received' && message.status !== 'READ' && message.status !== 'REPLIED' ? 'action.hover' : 'inherit'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(message.id)}
                          onChange={() => handleToggleSelect(message.id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight={type === 'received' && message.status !== 'READ' && message.status !== 'REPLIED' ? 'bold' : 'medium'}
                        >
                          {message.subject}
                        </Typography>
                        {message.attachments && message.attachments.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {message.attachments.length} {t('contact.attachmentCount')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {type === 'sent'
                              ? `${message.recipient.firstName} ${message.recipient.lastName}`
                              : `${message.sender.firstName} ${message.sender.lastName}`
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {type === 'sent' ? message.recipient.email : message.sender.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={message.priority}
                          size="small"
                          color={getPriorityColor(message.priority)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={message.category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(message.status)}
                          size="small"
                          color={getStatusColor(message.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, message)}
                          size="small"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, flexShrink: 0 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Context menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewMessage}>
          <VisibilityIcon sx={{ mr: 1 }} />
          {t('contact.viewMessage')}
        </MenuItem>
        <MenuItem onClick={handleReply}>
          <ReplyIcon sx={{ mr: 1 }} />
          {t('contact.reply')}
        </MenuItem>
        {type === 'received' && selectedMessage?.status !== 'READ' && (
          <MenuItem onClick={handleMarkAsRead}>
            <MarkAsReadIcon sx={{ mr: 1 }} />
            {t('contact.markAsRead')}
          </MenuItem>
        )}
        {type !== 'archived' && (
          <MenuItem onClick={handleArchive}>
            <ArchiveIcon sx={{ mr: 1 }} />
            {t('contact.archive')}
          </MenuItem>
        )}
        {type === 'archived' && (
          <MenuItem onClick={handleUnarchive}>
            <UnarchiveIcon sx={{ mr: 1 }} />
            {t('contact.unarchive')}
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          {t('contact.delete')}
        </MenuItem>
      </Menu>

      {/* Thread dialog - replaces the old view dialog */}
      <Dialog
        open={threadDialogOpen}
        onClose={() => {
          setThreadDialogOpen(false);
          setSelectedMessage(null);
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
                setSelectedMessage(null);
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
