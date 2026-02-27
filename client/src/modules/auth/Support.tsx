import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  MenuItem,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { ArrowBack, CheckCircle } from '@mui/icons-material';
import lightTheme from '../../theme/theme';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import apiClient from '../../services/apiClient';

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    '&:hover fieldset': { borderColor: 'secondary.main' },
    '&.Mui-focused fieldset': { borderColor: 'secondary.main' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'secondary.main' },
};

export default function Support() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = [
    { value: 'access', label: "Problème d'accès / connexion" },
    { value: 'technical', label: 'Problème technique' },
    { value: 'billing', label: 'Facturation / abonnement' },
    { value: 'feature', label: 'Demande de fonctionnalité' },
    { value: 'other', label: 'Autre' },
  ];

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
      setError("Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous contacter à info@clenzy.fr.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
      p: 2
    }}>
      <Paper elevation={8} sx={{
        p: 2.5,
        width: '100%',
        maxWidth: 440,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Header avec logo */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
            <img
              src={clenzyLogo}
              alt="Clenzy Logo"
              style={{ height: '48px', width: 'auto', maxWidth: '200px' }}
            />
          </Box>
          <Typography variant="body2" sx={{
            fontWeight: 500,
            color: 'secondary.main',
            fontSize: '0.85rem'
          }}>
            Contactez notre support
          </Typography>
        </Box>

        {submitted ? (
          /* Message de confirmation */
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '1rem' }}>
              Message envoy&eacute; !
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, fontSize: '0.85rem' }}>
              Notre &eacute;quipe vous contactera dans les 24 heures.
            </Typography>
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
                boxShadow: '0 4px 12px rgba(166, 192, 206, 0.3)',
              }}
            >
              Retour à la connexion
            </Button>
          </Box>
        ) : (
          /* Formulaire de contact */
          <form onSubmit={handleSubmit}>
            <Stack spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                sx={textFieldSx}
              />

              <TextField
                fullWidth
                size="small"
                label="Email"
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
                label="Téléphone (optionnel)"
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
                label="Sujet"
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
                label="Votre message"
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={loading}
                placeholder="Décrivez votre problème ou votre demande..."
                sx={textFieldSx}
              />

              {error && (
                <Alert severity="error" sx={{ py: 0.75 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{error}</Typography>
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
                  boxShadow: '0 4px 12px rgba(166, 192, 206, 0.3)',
                  transition: 'all 0.3s ease',
                }}
              >
                {loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  'Envoyer'
                )}
              </Button>
            </Stack>
          </form>
        )}

        {/* Lien retour */}
        {!submitted && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowBack sx={{ fontSize: '0.9rem' }} />}
              onClick={() => navigate('/login')}
              sx={{
                color: 'secondary.main',
                fontWeight: 500,
                fontSize: '0.75rem',
                textTransform: 'none',
                '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
              }}
            >
              Retour à la connexion
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
    </ThemeProvider>
  );
}
