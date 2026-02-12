import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import keycloak from '../../keycloak';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import apiClient, { ApiError } from '../../services/apiClient';
import { saveTokens } from '../../services/storageService';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Detecter si l'utilisateur vient de finaliser son inscription (retour Stripe)
  const inscriptionSuccess = searchParams.get('inscription') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiClient.post<any>('/auth/login', { username: email, password: password }, { skipAuth: true });

      // Mettre à jour l'état de Keycloak
      keycloak.token = data.access_token;
      keycloak.refreshToken = data.refresh_token;
      keycloak.idToken = data.id_token;
      keycloak.authenticated = true;
      keycloak.tokenParsed = JSON.parse(atob(data.access_token.split('.')[1]));

      // Sauvegarder les tokens dans localStorage
      saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
      });

      // Forcer la mise à jour de l'état global via l'événement personnalisé
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
      
      // L'événement sera traité par App.tsx qui affichera automatiquement le dashboard

    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status) {
        setError(apiErr.message || 'Erreur de connexion');
      } else {
        setError('Erreur de connexion au serveur. Vérifiez votre connexion internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)', // Palette Clenzy
      p: 2 
    }}>
      <Paper elevation={8} sx={{ 
        p: 2.5, 
        width: '100%', 
        maxWidth: 400, 
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
            <img 
              src={clenzyLogo} 
              alt="Clenzy Logo" 
              style={{ 
                height: '48px', 
                width: 'auto',
                maxWidth: '200px'
              }} 
            />
          </Box>
          <Typography variant="body2" sx={{ 
            fontWeight: 500,
            color: 'secondary.main',
            fontSize: '0.85rem'
          }}>
            Connectez-vous à votre compte
          </Typography>
        </Box>
        
        {/* Message de succes apres inscription */}
        {inscriptionSuccess && (
          <Alert severity="success" sx={{ mb: 2, py: 0.75 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Votre compte a ete cree avec succes ! Connectez-vous pour acceder a votre espace.
            </Typography>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField 
              fullWidth 
              size="small"
              label="Email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'secondary.main',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'secondary.main',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'secondary.main',
                },
              }}
            />
            <TextField 
              fullWidth 
              size="small"
              label="Mot de passe" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'secondary.main',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'secondary.main',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'secondary.main',
                },
              }}
            />
            
            {error && (
              <Alert severity="error" sx={{ mt: 1, py: 0.75 }}>
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
                '&:hover': {
                  backgroundColor: 'secondary.dark',
                },
                '&:active': {
                  backgroundColor: 'primary.main',
                },
                '&:disabled': {
                  backgroundColor: 'secondary.light',
                },
                borderRadius: 1.5,
                boxShadow: '0 4px 12px rgba(166, 192, 206, 0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Se connecter'
              )}
            </Button>
          </Stack>
        </form>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ 
            color: 'secondary.main',
            fontWeight: 500,
            fontSize: '0.75rem'
          }}>
            Besoin d'aide ? Contactez le support
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}


