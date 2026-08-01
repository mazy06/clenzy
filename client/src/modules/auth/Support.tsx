import React, { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Textarea } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Stack, ThemeProvider, CssBaseline } from '@mui/material';
import { ArrowBack, CheckCircle } from '../../icons';
import { createBaitlyTheme } from '../../theme/createBaitlyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient from '../../services/apiClient';

export default function Support() {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createBaitlyTheme({ isRtl }), [isRtl]);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = useMemo(
    () => [
      { value: 'access', label: t('auth.support.subjects.access', "Problème d'accès / connexion") },
      { value: 'technical', label: t('auth.support.subjects.technical', 'Problème technique') },
      { value: 'billing', label: t('auth.support.subjects.billing', 'Facturation / abonnement') },
      { value: 'feature', label: t('auth.support.subjects.feature', 'Demande de fonctionnalité') },
      { value: 'other', label: t('auth.support.subjects.other', 'Autre') },
    ],
    [t],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post('/public/support', {
        name,
        email,
        phone,
        subject,
        message,
      }, { skipAuth: true });

      setSubmitted(true);
    } catch {
      setError(t('auth.support.submitError', "Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous contacter à info@clenzy.fr."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
    <div className="min-h-[100vh] flex items-center justify-center p-3" style={{ background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)' }}>
      <Card className="gap-0 py-0 p-3.5 w-full max-w-[440px] bg-[var(--card)] border-border">
        {/* Header avec logo */}
        <div className="text-center mb-3">
          <div className="flex justify-center mb-2">
            <BaitlyMarkLogo variant="full" size={42} />
          </div>
          <p className="cn-text-body2 font-medium text-[var(--mui-secondary)] text-[0.85rem]">
            {t('auth.support.headerSubtitle', 'Contactez notre support')}
          </p>
        </div>

        {submitted ? (
          /* Message de confirmation */
          <div className="text-center py-4">
            <span className="inline-flex text-[var(--bui-success-ink)] mb-2"><CheckCircle size={56} strokeWidth={1.75} /></span>
            <h6 className="cn-text-h6 font-semibold mb-1.5 text-[1rem]">
              {t('auth.support.submittedTitle', 'Message envoyé !')}
            </h6>
            <p className="cn-text-body2 text-muted-foreground mb-3.5 text-[0.85rem]">
              {t('auth.support.submittedBody', 'Notre équipe vous contactera dans les 24 heures.')}
            </p>
            <Button
              variant="contained"
              size="medium"
              onClick={() => navigate('/login')}
              sx={{
                py: 1,
                fontSize: '0.9rem',
                fontWeight: 600,
                backgroundColor: 'secondary.main',
                '&:hover': { backgroundColor: 'secondary.dark' },
                borderRadius: 1.5,
                boxShadow: 'none',
              }}
            >
              {t('auth.support.backToLogin', 'Retour à la connexion')}
            </Button>
          </div>
        ) : (
          /* Formulaire de contact */
          <form onSubmit={handleSubmit}>
            <Stack spacing={1.5}>
              <Field>
                <FieldLabel htmlFor="support-name">{t('auth.support.fields.nameLabel', 'Nom complet')}</FieldLabel>
                <Input
                  id="support-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-email">{t('auth.support.fields.emailLabel', 'Email')}</FieldLabel>
                <Input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-phone">{t('auth.support.fields.phoneLabel', 'Téléphone (optionnel)')}</FieldLabel>
                <Input
                  id="support-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-subject">{t('auth.support.fields.subjectLabel', 'Sujet')}</FieldLabel>
                <NativeSelect
                  id="support-subject"
                  className="w-full"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  disabled={loading}
                >
                  {/* Option vide obligatoire : un select natif sans valeur vide
                      selectionnerait le 1er sujet a l'affichage alors que l'etat
                      reste '', et `required` ne bloquerait plus l'envoi. */}
                  <NativeSelectOption value="">
                    {t('auth.support.fields.subjectPlaceholder', 'Choisissez un sujet')}
                  </NativeSelectOption>
                  {subjects.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel htmlFor="support-message">{t('auth.support.fields.messageLabel', 'Votre message')}</FieldLabel>
                <Textarea
                  id="support-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={t('auth.support.fields.messagePlaceholder', 'Décrivez votre problème ou votre demande...')}
                />
              </Field>

              {error && (
                <Alert variant="destructive" className="py-1">
                  <TriangleAlert />
                  <AlertDescription><p className="cn-text-body2 text-[0.85rem]">{error}</p></AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="medium"
                disabled={loading}
                sx={{
                  py: 1,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  backgroundColor: 'secondary.main',
                  '&:hover': { backgroundColor: 'secondary.dark' },
                  '&:active': { backgroundColor: 'primary.main' },
                  '&:disabled': { backgroundColor: 'secondary.light' },
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {loading ? (
                  <Spinner className="size-5" />
                ) : (
                  t('auth.support.submit', 'Envoyer')
                )}
              </Button>
            </Stack>
          </form>
        )}

        {/* Lien retour */}
        {!submitted && (
          <div className="mt-3 text-center">
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowBack size={'0.9rem'} strokeWidth={1.75} />}
              onClick={() => navigate('/login')}
              sx={{
                color: 'secondary.main',
                fontWeight: 500,
                fontSize: '0.75rem',
                textTransform: 'none',
                '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
              }}
            >
              {t('auth.support.backToLogin', 'Retour à la connexion')}
            </Button>
          </div>
        )}
      </Card>
    </div>
    </ThemeProvider>
  );
}
