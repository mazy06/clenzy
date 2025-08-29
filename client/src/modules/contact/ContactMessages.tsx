import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  Grid,
  Pagination,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  MoreVert,
  AttachFile,
  Visibility,
  CheckCircle,
  Schedule,
  Error,
  Person,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface ContactMessage {
  id: number;
  senderId: number;
  recipientId: number;
  propertyId?: number;
  messageType: string;
  priority: string;
  subject: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  senderName: string;
  recipientName: string;
  propertyName?: string;
  attachments?: Array<{
    id: number;
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
}

interface ContactMessagesProps {
  type: 'received' | 'sent';
}

const MESSAGE_TYPE_LABELS: { [key: string]: string } = {
  'QUESTION_FACTURATION': 'Question facturation',
  'DEMANDE_ADMINISTRATIVE': 'Demande administrative',
  'CLARIFICATION_CONTRAT': 'Clarification contrat',
  'QUESTION_PORTEFEUILLE': 'Question portefeuille',
  'SUGGESTION': 'Suggestion',
  'PROBLEME_COMMUNICATION': 'Problème de communication',
  'DEMANDE_RENDEZ_VOUS': 'Demande de rendez-vous',
  'REMARQUE_FEEDBACK': 'Remarque/Feedback',
  'QUESTION_GENERALE': 'Question générale',
};

const PRIORITY_COLORS: { [key: string]: any } = {
  'BASSE': 'default',
  'MOYENNE': 'primary',
  'HAUTE': 'warning',
  'URGENTE': 'error',
};

const STATUS_COLORS: { [key: string]: any } = {
  'OUVERT': 'info',
  'EN_COURS': 'warning',
  'RESOLU': 'success',
  'FERME': 'default',
};

const ContactMessages: React.FC<ContactMessagesProps> = ({ type }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const pageSize = 10;

  useEffect(() => {
    loadMessages();
  }, [type, page]);

  const loadMessages = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'received' ? 'received' : 'sent';
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/contact/messages/${endpoint}?page=${page - 1}&size=${pageSize}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.content || []);
        setTotalPages(data.totalPages || 1);
      } else {
        setError('Erreur lors du chargement des messages');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Erreur chargement messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, message: ContactMessage) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessage(null);
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedMessage) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/contact/messages/${selectedMessage.id}/status?status=${status}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        // Mettre à jour le message localement
        setMessages(prev => prev.map(msg => 
          msg.id === selectedMessage.id ? { ...msg, status } : msg
        ));
      }
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    }

    handleMenuClose();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (messages.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Aucun message {type === 'received' ? 'reçu' : 'envoyé'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {type === 'received' 
            ? 'Vous n\'avez pas encore reçu de messages'
            : 'Vous n\'avez pas encore envoyé de messages'
          }
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Messages {type === 'received' ? 'reçus' : 'envoyés'} ({messages.length})
      </Typography>

      <Grid container spacing={2}>
        {messages.map((message) => (
          <Grid item xs={12} key={message.id}>
            <Card variant="outlined">
              <CardContent>
                {/* En-tête du message */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" component="div">
                        {type === 'received' ? message.senderName : message.recipientName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {type === 'received' ? 'De' : 'À'} {type === 'received' ? message.senderName : message.recipientName}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Type de message */}
                    <Chip
                      label={MESSAGE_TYPE_LABELS[message.messageType] || message.messageType}
                      size="small"
                      variant="outlined"
                    />
                    
                    {/* Priorité */}
                    <Chip
                      label={message.priority}
                      color={PRIORITY_COLORS[message.priority] || 'default'}
                      size="small"
                    />
                    
                    {/* Statut */}
                    <Chip
                      label={message.status}
                      color={STATUS_COLORS[message.status] || 'default'}
                      size="small"
                      variant="outlined"
                    />
                    
                    {/* Menu d'actions */}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, message)}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>

                {/* Sujet et contenu */}
                <Typography variant="h6" gutterBottom>
                  {message.subject}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {message.content.length > 200 
                    ? `${message.content.substring(0, 200)}...`
                    : message.content
                  }
                </Typography>

                {/* Informations supplémentaires */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {message.propertyName && (
                    <Chip
                      icon={<LocationOn />}
                      label={message.propertyName}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  
                  {message.attachments && message.attachments.length > 0 && (
                    <Chip
                      icon={<AttachFile />}
                      label={`${message.attachments.length} pièce(s) jointe(s)`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Date de création */}
                <Typography variant="caption" color="text.secondary">
                  Créé le {formatDate(message.createdAt)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleStatusUpdate('EN_COURS')}>
          <ListItemIcon>
            <Schedule fontSize="small" />
          </ListItemIcon>
          Marquer en cours
        </MenuItem>
        <MenuItem onClick={() => handleStatusUpdate('RESOLU')}>
          <ListItemIcon>
            <CheckCircle fontSize="small" />
          </ListItemIcon>
          Marquer résolu
        </MenuItem>
        <MenuItem onClick={() => handleStatusUpdate('FERME')}>
          <ListItemIcon>
            <Error fontSize="small" />
          </ListItemIcon>
          Fermer
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ContactMessages;
