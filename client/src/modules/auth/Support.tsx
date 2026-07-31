import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Paper, TextField, Button, Stack, Alert, CircularProgress, MenuItem, ThemeProvider, CssBaseline } from '@mui/material';
import { ArrowBack, CheckCircle } from '../../icons';
import { createBaitlyTheme } from '../../theme/createBaitlyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient from '../../services/apiClient';

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    '&:hover fieldset': { borderColor: 'secondary.main' },
    '&.Mui-focused fieldset': { borderColor: 'secondary.main' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'secondary.main' },
};

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
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
      p: 2
    }}>
      <Paper elevation={0} sx={{
        p: 2.5,
        width: '100%',
        maxWidth: 440,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}>
        {/* Header avec logo */}
        <div className="text-center mb-3">
          <div className="flex justify-center mb-2">
            <BaitlyMarkLogo variant="full" size={42} />
          </div>
          <p className="cn-text-body2 font-medium text-[secondary.main] text-[0.85rem]">
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
              <TextField
                fullWidth
                size="small"
                label={t('auth.support.fields.nameLabel', 'Nom complet')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                sx={textFieldSx}
              />

              <TextField
                fullWidth
                size="small"
                label={t('auth.support.fields.emailLabel', 'Email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                sx={textFieldSx}
              />

              <TextField
                fullWidth
                size="small"
                label={t('auth.support.fields.phoneLabel', 'Téléphone (optionnel)')}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                sx={textFieldSx}
              />

              <TextField
                fullWidth
                size="small"
                select
                label={t('auth.support.fields.subjectLabel', 'Sujet')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                disabled={loading}
                sx={textFieldSx}
              >
                {subjects.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                size="small"
                label={t('auth.support.fields.messageLabel', 'Votre message')}
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={loading}
                placeholder={t('auth.support.fields.messagePlaceholder', 'Décrivez votre problème ou votre demande...')}
                sx={textFieldSx}
              />

              {error && (
                <Alert severity="error" sx={{ py: 0.75 }}>
                  <p className="cn-text-body2 text-[0.85rem]">{error}</p>
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
                  <CircularProgress size={20} color="inherit" />
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
      </Paper>
    </Box>
    </ThemeProvider>
  );
}
