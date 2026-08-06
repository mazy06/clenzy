import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldError,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui';
import { Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card as BuiCard } from '../../components/ui';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Subject as SubjectIcon,
  Message as MessageIcon,
  PriorityHigh as PriorityIcon,
  Category as CategoryIcon
} from '../../icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useAuth } from '../../hooks/useAuth';
import { contactApi } from '../../services/api/contactApi';
import apiClient from '../../services/apiClient';
import { useTranslation } from '../../hooks/useTranslation';
import { contactSchema } from '../../schemas/contactSchema';
import type { ContactFormValues } from '../../schemas';
import PageHeader from '../../components/PageHeader';
import ContactTemplates from './ContactTemplates';

type ContactFormInput = z.input<typeof contactSchema>;

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

interface ContactFormProps {
  onCancel?: () => void;
}

/** Libelle affiche pour un destinataire — sert aussi de cle de filtrage. */
const recipientLabel = (r: Recipient) => `${r.firstName} ${r.lastName} (${r.email})`;

const ContactForm: React.FC<ContactFormProps> = ({ onCancel }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isRestrictedUser = user?.roles?.includes('HOST') || user?.roles?.includes('HOUSEKEEPER') || user?.roles?.includes('TECHNICIAN') || user?.roles?.includes('SUPERVISOR') || user?.roles?.includes('LAUNDRY') || user?.roles?.includes('EXTERIOR_TECH');

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
  // Saisie libre du destinataire : le Combobox du kit n'a pas de `freeSolo`, on
  // pilote donc le texte du champ et on commet la valeur brute au blur.
  const [recipientInput, setRecipientInput] = useState('');
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
      setRecipientInput('');
      setAttachments([]);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || t('contact.errors.connectionError'));
    } finally {
      setSubmitting(false);
    }
  };

  // Generer les options avec traductions
  const priorityOptions: Array<{ value: string; label: string; tone: StatusTone }> = [
    { value: 'LOW', label: t('contact.priorities.low'), tone: 'ok' },
    { value: 'MEDIUM', label: t('contact.priorities.medium'), tone: 'info' },
    { value: 'HIGH', label: t('contact.priorities.high'), tone: 'warn' },
    { value: 'URGENT', label: t('contact.priorities.urgent'), tone: 'err' }
  ];

  const categoryOptions = [
    { value: 'GENERAL', label: t('contact.categories.general') },
    { value: 'TECHNICAL', label: t('contact.categories.technical') },
    { value: 'MAINTENANCE', label: t('contact.categories.maintenance') },
    { value: 'CLEANING', label: t('contact.categories.cleaning') },
    { value: 'EMERGENCY', label: t('contact.categories.emergency') }
  ];

  return (
    <div className="max-w-[800px] mx-auto p-4">
      <PageHeader
        title={t('contact.newMessageTitle')}
        iconBadge={<MessageIcon />}
        onBack={onCancel}
        backPath="/contact"
      />
      <BuiCard className="gap-0 py-0 p-4">
          {isRestrictedUser && (
            <Alert variant="info" className="mb-4">
              <Info />
              <AlertDescription>{t('contact.info.restrictedUser')}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-4">
              <CircleCheck />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={rhfHandleSubmit(onSubmit)}>
            <div className="grid grid-cols-12 gap-[18px]">
              {/* Destinataire - Combobox (liste des destinataires + saisie libre) */}
              <div className="col-span-12">
                <Controller
                  name="recipientId"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="contact-recipient">{t('contact.recipient')}</FieldLabel>
                      {/* `value` reste NON controle : la valeur du formulaire peut
                          etre un simple email saisi a la main, qui ne correspond a
                          aucun item de la liste. Seule la saisie est controlee, la
                          selection est consommee dans onValueChange. */}
                      <Combobox<Recipient>
                        items={usersList}
                        itemToStringLabel={recipientLabel}
                        isItemEqualToValue={(option, other) => option.id === other.id}
                        inputValue={recipientInput}
                        onInputValueChange={(next, details) => {
                          setRecipientInput(next);
                          // `input-change` est le pendant du reason 'input' de MUI :
                          // on ne remonte que la frappe utilisateur.
                          if (details.reason === 'input-change') {
                            const trimmed = next.trim();
                            if (trimmed && !usersList.some((u) => u.id === trimmed)) {
                              field.onChange(trimmed);
                            }
                          }
                        }}
                        onValueChange={(next) => {
                          if (next) {
                            field.onChange(next.id);
                            setRecipientInput(recipientLabel(next));
                          } else {
                            field.onChange('');
                          }
                        }}
                      >
                        <ComboboxInput
                          id="contact-recipient"
                          className="w-full"
                          disabled={loading}
                          placeholder={t('contact.recipientPlaceholder', 'Sélectionner un utilisateur ou saisir un email')}
                          aria-invalid={!!errors.recipientId}
                          onBlur={() => {
                            // Commettre la saisie libre quand le champ perd le focus
                            const typed = recipientInput.trim();
                            if (typed) {
                              const matchedUser = usersList.find((u) => recipientLabel(u) === typed);
                              field.onChange(matchedUser ? matchedUser.id : typed);
                            }
                            field.onBlur();
                          }}
                        >
                          <InputGroupAddon>
                            <span className="inline-flex text-muted-foreground"><EmailIcon /></span>
                          </InputGroupAddon>
                        </ComboboxInput>
                        <ComboboxContent>
                          <ComboboxEmpty>
                            {loading
                              ? t('common.loading', 'Chargement…')
                              : t('contact.noRecipientFound', 'Aucun destinataire')}
                          </ComboboxEmpty>
                          <ComboboxList>
                            {(option: Recipient) => (
                              <ComboboxItem key={option.id} value={option}>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex text-muted-foreground"><PersonIcon size={16} strokeWidth={1.75} /></span>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {option.firstName} {option.lastName}
                                    </p>
                                    <span className="text-xs text-muted-foreground">
                                      {option.email} - {option.role}
                                    </span>
                                  </div>
                                </div>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {errors.recipientId && <FieldError>{errors.recipientId.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              {/* Sujet */}
              <div className="col-span-12">
                <Controller
                  name="subject"
                  control={control}
                  render={({ field }) => (
                    // field.ref n'est pas transmis : les primitives du kit sont des
                    // composants fonction sans forwardRef (React 18).
                    <Field>
                      <FieldLabel htmlFor="contact-subject">{t('contact.subject')}</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <span className="inline-flex text-muted-foreground"><SubjectIcon /></span>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="contact-subject"
                          name={field.name}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.subject}
                        />
                      </InputGroup>
                      {errors.subject && <FieldError>{errors.subject.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              {/* Priorite et Categorie */}
              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    // Select « riche » et non NativeSelect : les options portent un
                    // StatusChip, qu'une <option> native ne peut pas afficher.
                    <Field>
                      <FieldLabel htmlFor="contact-priority">{t('contact.priority')}</FieldLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger id="contact-priority" className="w-full" aria-invalid={!!errors.priority}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <StatusChip
                                label={option.label}
                                tone={option.tone}
                                className="me-1.5"
                              />
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.priority && <FieldError>{errors.priority.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="contact-category">{t('contact.category')}</FieldLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger id="contact-category" className="w-full" aria-invalid={!!errors.category}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="inline-flex me-1.5"><CategoryIcon size={16} strokeWidth={1.75} /></span>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.category && <FieldError>{errors.category.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              {/* Message with template button */}
              <div className="col-span-12">
                <div className="flex justify-end mb-1.5">
                  <ContactTemplates onSelectTemplate={handleSelectTemplate} />
                </div>
                <Controller
                  name="message"
                  control={control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="contact-message">{t('contact.message')}</FieldLabel>
                      <InputGroup>
                        {/* block-start : sur un textarea de 6 lignes, un addon inline
                            centrerait l'icone a mi-hauteur du champ. */}
                        <InputGroupAddon align="block-start">
                          <span className="inline-flex text-muted-foreground"><MessageIcon /></span>
                        </InputGroupAddon>
                        <InputGroupTextarea
                          id="contact-message"
                          rows={6}
                          name={field.name}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.message}
                        />
                      </InputGroup>
                      {errors.message && <FieldError>{errors.message.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              {/* Pieces jointes */}
              <div className="col-span-12">
                <BuiCard className="gap-0 py-0 p-3">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <h6 className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="inline-flex text-muted-foreground [&>svg]:size-3.5"><AttachFileIcon /></span>
                      {t('contact.attachments')}
                    </h6>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Max {MAX_FILE_SIZE_MB} MB / {t('contact.attachmentCount')}
                    </span>
                  </div>

                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                  />
                  <label htmlFor="file-input">
                    {/* `component="span"` MUI : le declencheur doit rester un span pour
                        que le label pilote l'input file -> asChild sur un span. */}
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <AttachFileIcon />
                        {t('contact.addFiles')}
                      </span>
                    </Button>
                  </label>

                  {attachments.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t('contact.selectedFiles')}
                      </p>
                      {attachments.map((file, index) => (
                        <StatusChip
                          key={index}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => removeAttachment(index)}
                          className="me-1.5 mb-1.5"
                        />
                      ))}
                    </div>
                  )}
                </BuiCard>
              </div>

              {/* Boutons */}
              <div className="col-span-12">
                <div className="flex gap-3 justify-end">
                  {/* `type="button"` explicite : le bouton natif du kit vaut `submit`
                      par defaut dans un <form>, la ou MUI posait `button`. */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (onCancel) {
                        onCancel();
                      } else {
                        reset();
                        setRecipientInput('');
                        setAttachments([]);
                      }
                    }}
                    disabled={submitting}
                  >
                    {t('contact.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || loading}
                  >
                    {submitting ? <Spinner className="size-5" /> : <SendIcon />}
                    {submitting ? t('contact.sending') : t('contact.send')}
                  </Button>
                </div>
              </div>
            </div>
          </form>
      </BuiCard>
    </div>
  );
};

export default ContactForm;
