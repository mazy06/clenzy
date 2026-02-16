import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  FormHelperText,
  Paper,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Subject as SubjectIcon,
  Message as MessageIcon,
  PriorityHigh as PriorityIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useAuth } from '../../hooks/useAuth';
import { contactApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';
import { contactSchema } from '../../schemas';
import type { ContactFormValues } from '../../schemas';
import ContactTemplates from './ContactTemplates';

type ContactFormInput = z.input<typeof contactSchema>;

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

import type { Recipient } from '../../services/api';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const ContactForm: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isRestrictedUser = user?.roles?.includes('HOST') || user?.roles?.includes('HOUSEKEEPER') || user?.roles?.includes('TECHNICIAN') || user?.roles?.includes('SUPERVISOR');

  const {
    control,
    handleSubmit: rhfHandleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      recipientId: '',
      subject: '',
      message: '',
      priority: 'MEDIUM',
      category: 'GENERAL',
    },
  });

  const messageValue = watch('message');

  const [attachments, setAttachments] = useState<File[]>([]);
  const [usersList, setUsersList] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Charger la liste des destinataires autorises
  useEffect(() => {
    const loadRecipients = async () => {
      try {
        setLoading(true);
        const users = await contactApi.getRecipients();
        setUsersList(users);
      } catch (_err) {
      } finally {
        setLoading(false);
      }
    };

    loadRecipients();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // Filter files that exceed the max size
      const validFiles = fileArray.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
      if (validFiles.length < fileArray.length) {
        setError(t('contact.errors.fileTooLarge', { max: `${MAX_FILE_SIZE_MB} MB` }) || `Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} MB)`);
      }
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectTemplate = (text: string) => {
    const current = messageValue || '';
    setValue('message', current ? `${current}\n${text}` : text);
  };

  const onSubmit = async (data: ContactFormValues) => {
    try {
      setSubmitting(true);
      setError(null);

      const formDataToSend = new FormData();
      formDataToSend.append('recipientId', data.recipientId);
      formDataToSend.append('subject', data.subject);
      formDataToSend.append('message', data.message);
      formDataToSend.append('priority', data.priority);
      formDataToSend.append('category', data.category);

      // Ajouter les pieces jointes
      attachments.forEach((file) => {
        formDataToSend.append('attachments', file);
      });

      await apiClient.upload('/contact/messages', formDataToSend);
      setSuccess(t('contact.success.messageSent'));
      reset();
      setAttachments([]);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || t('contact.errors.connectionError'));
    } finally {
      setSubmitting(false);
    }
  };

  // Generer les options avec traductions
  const priorityOptions: Array<{ value: string; label: string; color: ChipColor }> = [
    { value: 'LOW', label: t('contact.priorities.low'), color: 'success' },
    { value: 'MEDIUM', label: t('contact.priorities.medium'), color: 'info' },
    { value: 'HIGH', label: t('contact.priorities.high'), color: 'warning' },
    { value: 'URGENT', label: t('contact.priorities.urgent'), color: 'error' }
  ];

  const categoryOptions = [
    { value: 'GENERAL', label: t('contact.categories.general') },
    { value: 'TECHNICAL', label: t('contact.categories.technical') },
    { value: 'MAINTENANCE', label: t('contact.categories.maintenance') },
    { value: 'CLEANING', label: t('contact.categories.cleaning') },
    { value: 'EMERGENCY', label: t('contact.categories.emergency') }
  ];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageIcon color="primary" />
            {t('contact.newMessageTitle')}
          </Typography>

          {isRestrictedUser && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {t('contact.info.restrictedUser')}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={rhfHandleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* Destinataire - Autocomplete */}
              <Grid item xs={12}>
                <Controller
                  name="recipientId"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      options={usersList}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return `${option.firstName} ${option.lastName} (${option.email})`;
                      }}
                      value={usersList.find(u => u.id === field.value) || field.value || null}
                      onChange={(_, newValue) => {
                        if (typeof newValue === 'string') {
                          // Saisie libre (email)
                          field.onChange(newValue.trim());
                        } else if (newValue) {
                          // Selection d'un utilisateur dans la liste
                          field.onChange(newValue.id);
                        } else {
                          field.onChange('');
                        }
                      }}
                      onInputChange={(_, inputValue, reason) => {
                        if (reason === 'input') {
                          // Mettre a jour la valeur a chaque frappe pour les saisies libres
                          const trimmed = inputValue.trim();
                          if (trimmed && !usersList.find(u => u.id === trimmed)) {
                            field.onChange(trimmed);
                          }
                        }
                      }}
                      filterOptions={(options, { inputValue }) => {
                        const lower = inputValue.toLowerCase();
                        return options.filter(
                          (o) =>
                            o.firstName.toLowerCase().includes(lower) ||
                            o.lastName.toLowerCase().includes(lower) ||
                            o.email.toLowerCase().includes(lower)
                        );
                      }}
                      loading={loading}
                      disabled={loading}
                      isOptionEqualToValue={(option, value) => {
                        if (typeof value === 'string') return option.id === value || option.email === value;
                        return option.id === value.id;
                      }}
                      renderOption={(props, option) => (
                        <li {...props} key={typeof option === 'string' ? option : option.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon fontSize="small" />
                            <Box>
                              <Typography variant="body2">
                                {typeof option === 'string' ? option : `${option.firstName} ${option.lastName}`}
                              </Typography>
                              {typeof option !== 'string' && (
                                <Typography variant="caption" color="text.secondary">
                                  {option.email} - {option.role}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t('contact.recipient')}
                          placeholder={t('contact.recipientPlaceholder') || 'Sélectionner un utilisateur ou saisir un email'}
                          error={!!errors.recipientId}
                          helperText={errors.recipientId?.message}
                          onBlur={(e) => {
                            // Commettre la saisie libre quand le champ perd le focus
                            const inputValue = (e.target as HTMLInputElement).value?.trim();
                            if (inputValue) {
                              const matchedUser = usersList.find(u =>
                                `${u.firstName} ${u.lastName} (${u.email})` === inputValue
                              );
                              field.onChange(matchedUser ? matchedUser.id : inputValue);
                            }
                            field.onBlur();
                          }}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                {params.InputProps.startAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              {/* Sujet */}
              <Grid item xs={12}>
                <Controller
                  name="subject"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('contact.subject')}
                      error={!!errors.subject}
                      helperText={errors.subject?.message}
                      InputProps={{
                        startAdornment: <SubjectIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Priorite et Categorie */}
              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.priority}>
                      <InputLabel>{t('contact.priority')}</InputLabel>
                      <Select {...field}>
                        {priorityOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Chip
                              label={option.label}
                              size="small"
                              color={option.color}
                              sx={{ mr: 1 }}
                            />
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.priority && (
                        <FormHelperText>{errors.priority.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category}>
                      <InputLabel>{t('contact.category')}</InputLabel>
                      <Select {...field}>
                        {categoryOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <CategoryIcon sx={{ mr: 1, fontSize: 16 }} />
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.category && (
                        <FormHelperText>{errors.category.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Message with template button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <ContactTemplates onSelectTemplate={handleSelectTemplate} />
                </Box>
                <Controller
                  name="message"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('contact.message')}
                      multiline
                      rows={6}
                      error={!!errors.message}
                      helperText={errors.message?.message}
                      InputProps={{
                        startAdornment: <MessageIcon sx={{ mr: 1, color: 'text.secondary', alignSelf: 'flex-start', mt: 1 }} />
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Pieces jointes */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2">
                      <AttachFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {t('contact.attachments')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Max {MAX_FILE_SIZE_MB} MB / {t('contact.attachmentCount')}
                    </Typography>
                  </Box>

                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="file-input"
                  />
                  <label htmlFor="file-input">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<AttachFileIcon />}
                      size="small"
                    >
                      {t('contact.addFiles')}
                    </Button>
                  </label>

                  {attachments.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {t('contact.selectedFiles')}
                      </Typography>
                      {attachments.map((file, index) => (
                        <Chip
                          key={index}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => removeAttachment(index)}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Boutons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      reset();
                      setAttachments([]);
                    }}
                    disabled={submitting}
                  >
                    {t('contact.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                    disabled={submitting || loading}
                  >
                    {submitting ? t('contact.sending') : t('contact.send')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ContactForm;
