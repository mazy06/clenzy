import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Chip,
  CircularProgress,
  Divider,
  Avatar,
  Skeleton
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  AttachFile as AttachFileIcon,
  InsertDriveFile as FileIcon,
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { contactApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import ContactTemplates from './ContactTemplates';
import PhotoLightbox from '../../components/PhotoLightbox';

export interface ContactMessageUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ContactMessageAttachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  contentType: string;
  storagePath?: string | null;
}

export interface ContactMessageItem {
  id: string;
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'GENERAL' | 'TECHNICAL' | 'MAINTENANCE' | 'CLEANING' | 'EMERGENCY';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED';
  sender: ContactMessageUser;
  recipient: ContactMessageUser;
  createdAt: string;
  readAt?: string;
  repliedAt?: string;
  attachments: ContactMessageAttachment[];
}

interface ContactMessageThreadProps {
  message: ContactMessageItem;
  onReply: (message: string, attachments?: File[]) => void;
  onClose: () => void;
  loading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

function isImageAttachment(att: { contentType?: string; originalName?: string }): boolean {
  if (att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.toLowerCase())) return true;
  const ext = att.originalName?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

const ContactMessageThread: React.FC<ContactMessageThreadProps> = ({
  message,
  onReply,
  onClose,
  loading = false
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image preview state
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const blobUrlsRef = useRef<string[]>([]);

  // Load image blob URLs for the message
  useEffect(() => {
    blobUrlsRef.current.forEach(url => window.URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    setImageUrls({});

    const imageAtts = (message.attachments || []).filter(isImageAttachment);
    if (imageAtts.length === 0) return;

    let active = true;
    imageAtts.forEach(att => {
      contactApi.getAttachmentBlobUrl(Number(message.id), att.id)
        .then(url => {
          if (!active) { window.URL.revokeObjectURL(url); return; }
          blobUrlsRef.current.push(url);
          setImageUrls(prev => ({ ...prev, [att.id]: url }));
        })
        .catch(() => {});
    });

    return () => { active = false; };
  }, [message.id]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => window.URL.revokeObjectURL(url));
    };
  }, []);

  // Computed lightbox data
  const lightboxPhotos = (() => {
    const photos: string[] = [];
    (message.attachments || []).filter(isImageAttachment).forEach(a => {
      const url = imageUrls[a.id];
      if (url) photos.push(url);
    });
    return photos;
  })();

  const lightboxIdxMap: Record<string, number> = {};
  (message.attachments || []).filter(isImageAttachment).forEach(a => {
    const url = imageUrls[a.id];
    if (url) { lightboxIdxMap[a.id] = Object.keys(lightboxIdxMap).length; }
  });

  // Build a thread from the single message (the API returns one message;
  // in a real implementation this would be a list of messages in the conversation).
  // For now we display the selected message as the thread.
  const threadMessages: ContactMessageItem[] = [message];

  useEffect(() => {
    // Auto-scroll to newest message
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadMessages.length]);

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim(), replyAttachments.length > 0 ? replyAttachments : undefined);
    setReplyText('');
    setReplyAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setReplyAttachments(prev => [...prev, ...Array.from(files)]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeReplyAttachment = (index: number) => {
    setReplyAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectTemplate = (text: string) => {
    setReplyText(prev => prev ? `${prev}\n${text}` : text);
  };

  const isCurrentUserSender = (msg: ContactMessageItem): boolean => {
    return msg.sender.id === user?.id;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper'
        }}
      >
        <IconButton onClick={onClose} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {message.subject}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {t('contact.thread')} - {message.sender.firstName} {message.sender.lastName} &amp; {message.recipient.firstName} {message.recipient.lastName}
          </Typography>
        </Box>
        <Chip
          label={message.priority}
          size="small"
          variant="outlined"
          sx={{ borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
          color={
            message.priority === 'URGENT' ? 'error' :
            message.priority === 'HIGH' ? 'warning' :
            message.priority === 'MEDIUM' ? 'info' : 'success'
          }
        />
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'background.default',
          minHeight: 0
        }}
      >
        {threadMessages.map((msg) => {
          const isSender = isCurrentUserSender(msg);
          const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;

          return (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isSender ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                alignSelf: isSender ? 'flex-end' : 'flex-start'
              }}
            >
              {/* Sender info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {!isSender && (
                  <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: 'grey.500' }}>
                    {getInitials(msg.sender.firstName, msg.sender.lastName)}
                  </Avatar>
                )}
                <Typography variant="caption" color="text.secondary">
                  {senderName} - {new Date(msg.createdAt).toLocaleString()}
                </Typography>
                {isSender && (
                  <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: 'primary.main' }}>
                    {getInitials(msg.sender.firstName, msg.sender.lastName)}
                  </Avatar>
                )}
              </Box>

              {/* Message bubble */}
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: isSender ? 'primary.main' : 'action.hover',
                  color: isSender ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '100%',
                  wordBreak: 'break-word'
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.message}
                </Typography>
              </Paper>

              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (() => {
                const imgAtts = msg.attachments.filter(isImageAttachment);
                const fileAtts = msg.attachments.filter(a => !isImageAttachment(a));

                return (
                  <>
                    {/* Image attachments - inline preview */}
                    {imgAtts.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {imgAtts.map(att => {
                          const url = imageUrls[att.id];
                          if (!url) return <Skeleton key={att.id} variant="rectangular" width={120} height={90} sx={{ borderRadius: 1 }} />;
                          return (
                            <Box
                              key={att.id}
                              component="img"
                              src={url}
                              alt={att.originalName}
                              onClick={() => {
                                const idx = lightboxIdxMap[att.id];
                                if (idx !== undefined) { setLightboxIndex(idx); setLightboxOpen(true); }
                              }}
                              sx={{
                                width: 120, height: 90,
                                objectFit: 'cover', borderRadius: 1,
                                cursor: 'pointer', border: 1, borderColor: 'divider',
                                transition: 'all 0.2s',
                                '&:hover': { opacity: 0.85 },
                              }}
                            />
                          );
                        })}
                      </Box>
                    )}

                    {/* File attachments */}
                    {fileAtts.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {fileAtts.map(attachment => (
                          <Chip
                            key={attachment.id}
                            icon={<FileIcon />}
                            label={`${attachment.originalName} (${formatFileSize(attachment.size)})`}
                            size="small"
                            variant="outlined"
                            clickable
                            onClick={() => contactApi.downloadAttachment(Number(msg.id), attachment.id, attachment.originalName)}
                            deleteIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                            onDelete={() => contactApi.downloadAttachment(Number(msg.id), attachment.id, attachment.originalName)}
                            sx={{
                              maxWidth: 250, borderWidth: 1.5,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </>
                );
              })()}
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
        <PhotoLightbox
          open={lightboxOpen}
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </Box>

      {/* Reply form */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper'
        }}
      >
        {/* Reply attachments preview */}
        {replyAttachments.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {replyAttachments.map((file, index) => (
              <Chip
                key={index}
                icon={<FileIcon />}
                label={`${file.name} (${formatFileSize(file.size)})`}
                size="small"
                variant="outlined"
                sx={{ borderWidth: 1.5 }}
                onDelete={() => removeReplyAttachment(index)}
              />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <ContactTemplates onSelectTemplate={handleSelectTemplate} />

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="thread-file-input"
          />
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{ mb: 0.5 }}
          >
            <AttachFileIcon />
          </IconButton>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder={t('contact.replyPlaceholder')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <Button
            variant="contained"
            endIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleSendReply}
            disabled={!replyText.trim() || loading}
            sx={{ mb: 0.5, minWidth: 'auto', px: 2 }}
          >
            {t('contact.send')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ContactMessageThread;
