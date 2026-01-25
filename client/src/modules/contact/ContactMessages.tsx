import React, { useState, useEffect } from 'react';
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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Divider
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Reply as ReplyIcon,
  Delete as DeleteIcon,
  MarkAsUnread as MarkAsUnreadIcon,
  MarkAsUnread as MarkAsReadIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { useTranslation } from '../../hooks/useTranslation';

interface ContactMessage {
  id: string;
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'GENERAL' | 'TECHNICAL' | 'MAINTENANCE' | 'CLEANING' | 'EMERGENCY';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED';
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  recipient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  readAt?: string;
  repliedAt?: string;
  attachments: Array<{
    id: string;
    filename: string;
    originalName: string;
    size: number;
    contentType: string;
  }>;
}

interface ContactMessagesProps {
  type: 'sent' | 'received';
}

const ContactMessages: React.FC<ContactMessagesProps> = ({ type }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = type === 'sent' ? 'sent' : 'received';
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/contact/messages/${endpoint}?page=${page - 1}&size=${pageSize}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.content || []);
        setTotalPages(data.totalPages || 0);
      } else {
        setError('Erreur lors du chargement des messages');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [page, type]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, message: ContactMessage) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessage(null);
  };

  const handleViewMessage = () => {
    setViewDialogOpen(true);
    handleMenuClose();
  };

  const handleMarkAsRead = async () => {
    if (!selectedMessage) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/contact/messages/${selectedMessage.id}/status?status=READ`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        loadMessages();
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error);
    }
  };

  const handleReply = () => {
    // Rediriger vers le formulaire de contact avec le destinataire pré-rempli
    const recipientId = type === 'sent' ? selectedMessage?.recipient.id : selectedMessage?.sender.id;
    window.location.href = `/contact/create?recipient=${recipientId}&subject=Re: ${selectedMessage?.subject}`;
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/contact/messages/${selectedMessage.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
          }
        }
      );

      if (response.ok) {
        loadMessages();
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'info';
      case 'HIGH': return 'warning';
      case 'URGENT': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
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
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              {type === 'sent' ? t('contact.messagesSent') : t('contact.messagesReceived')}
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
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Filtres */}
          <Grid container spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
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
              </Box>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
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
                  <TableRow key={message.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {message.subject}
                      </Typography>
                      {message.attachments.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          📎 {message.attachments.length} {t('contact.attachmentCount')}
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
                        color={getPriorityColor(message.priority) as any}
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
                        color={getStatusColor(message.status) as any}
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

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
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

      {/* Menu contextuel */}
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
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          {t('contact.delete')}
        </MenuItem>
      </Menu>

      {/* Dialog de visualisation */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedMessage?.subject}
        </DialogTitle>
        <DialogContent>
          {selectedMessage && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {type === 'sent' ? t('contact.recipient') : t('contact.sender')}
                  </Typography>
                  <Typography variant="body2">
                    {type === 'sent' 
                      ? `${selectedMessage.recipient.firstName} ${selectedMessage.recipient.lastName}`
                      : `${selectedMessage.sender.firstName} ${selectedMessage.sender.lastName}`
                    }
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {type === 'sent' ? selectedMessage.recipient.email : selectedMessage.sender.email}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('contact.sendDate')}
                  </Typography>
                  <Typography variant="body2">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip
                  label={selectedMessage.priority}
                  size="small"
                  color={getPriorityColor(selectedMessage.priority) as any}
                />
                <Chip
                  label={selectedMessage.category}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getStatusLabel(selectedMessage.status)}
                  size="small"
                  color={getStatusColor(selectedMessage.status) as any}
                />
              </Box>

              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedMessage.message}
              </Typography>

              {selectedMessage.attachments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('contact.attachmentsLabel')}
                  </Typography>
                  {selectedMessage.attachments.map((attachment, index) => (
                    <Chip
                      key={index}
                      label={attachment.originalName}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            {t('contact.close')}
          </Button>
          <Button onClick={handleReply} variant="contained">
            {t('contact.reply')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContactMessages;
