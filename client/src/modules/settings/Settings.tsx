import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Notifications,
  Security,
  Business,
  Person,
  Save,
  Refresh,
  Email,
  Phone,
  Language,
  Palette,
  Storage,
} from '@mui/icons-material';

export default function Settings() {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: 30,
      passwordExpiry: 90,
    },
    business: {
      companyName: 'Clenzy',
      timezone: 'Europe/Paris',
      currency: 'EUR',
      language: 'fr',
    },
    display: {
      theme: 'light',
      compactMode: false,
      showAvatars: true,
    },
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleSettingChange = (category: string, setting: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [setting]: value,
      },
    }));
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving settings:', settings);
    setSnackbarMessage('Paramètres sauvegardés avec succès');
    setSnackbarOpen(true);
  };

  const handleReset = () => {
    // TODO: Implement reset logic
    console.log('Resetting settings');
    setSnackbarMessage('Paramètres réinitialisés');
    setSnackbarOpen(true);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Paramètres
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configurez votre application selon vos préférences
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Notifications */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Notifications sx={{ color: '#A6C0CE' }} />
              <Typography variant="h6" fontWeight={600}>
                Notifications
              </Typography>
            </Box>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <Email />
                </ListItemIcon>
                <ListItemText
                  primary="Notifications par email"
                  secondary="Recevoir les notifications importantes par email"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.email}
                    onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <Notifications />
                </ListItemIcon>
                <ListItemText
                  primary="Notifications push"
                  secondary="Recevoir les notifications sur votre navigateur"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.push}
                    onChange={(e) => handleSettingChange('notifications', 'push', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <Phone />
                </ListItemIcon>
                <ListItemText
                  primary="Notifications SMS"
                  secondary="Recevoir les notifications urgentes par SMS"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.sms}
                    onChange={(e) => handleSettingChange('notifications', 'sms', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Sécurité */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Security sx={{ color: '#A6C0CE' }} />
              <Typography variant="h6" fontWeight={600}>
                Sécurité
              </Typography>
            </Box>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <Security />
                </ListItemIcon>
                <ListItemText
                  primary="Authentification à deux facteurs"
                  secondary="Ajouter une couche de sécurité supplémentaire"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.security.twoFactorAuth}
                    onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemText
                  primary="Délai d'expiration de session (minutes)"
                  secondary="Temps avant déconnexion automatique"
                />
                <TextField
                  type="number"
                  value={settings.security.sessionTimeout}
                  onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                  sx={{ width: 80 }}
                  size="small"
                />
              </ListItem>
              
              <ListItem>
                <ListItemText
                  primary="Expiration du mot de passe (jours)"
                  secondary="Durée de validité du mot de passe"
                />
                <TextField
                  type="number"
                  value={settings.security.passwordExpiry}
                  onChange={(e) => handleSettingChange('security', 'passwordExpiry', parseInt(e.target.value))}
                  sx={{ width: 80 }}
                  size="small"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Entreprise */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Business sx={{ color: '#A6C0CE' }} />
              <Typography variant="h6" fontWeight={600}>
                Entreprise
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  value={settings.business.companyName}
                  onChange={(e) => handleSettingChange('business', 'companyName', e.target.value)}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Fuseau horaire"
                  value={settings.business.timezone}
                  onChange={(e) => handleSettingChange('business', 'timezone', e.target.value)}
                  select
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </TextField>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Devise"
                  value={settings.business.currency}
                  onChange={(e) => handleSettingChange('business', 'currency', e.target.value)}
                  select
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </TextField>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Langue"
                  value={settings.business.language}
                  onChange={(e) => handleSettingChange('business', 'language', e.target.value)}
                  select
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                </TextField>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Affichage */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Palette sx={{ color: '#A6C0CE' }} />
              <Typography variant="h6" fontWeight={600}>
                Affichage
              </Typography>
            </Box>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <Palette />
                </ListItemIcon>
                <ListItemText
                  primary="Mode sombre"
                  secondary="Utiliser le thème sombre"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.display.theme === 'dark'}
                    onChange={(e) => handleSettingChange('display', 'theme', e.target.checked ? 'dark' : 'light')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <Storage />
                </ListItemIcon>
                <ListItemText
                  primary="Mode compact"
                  secondary="Réduire l'espacement des éléments"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.display.compactMode}
                    onChange={(e) => handleSettingChange('display', 'compactMode', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <Person />
                </ListItemIcon>
                <ListItemText
                  primary="Afficher les avatars"
                  secondary="Montrer les photos de profil des utilisateurs"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.display.showAvatars}
                    onChange={(e) => handleSettingChange('display', 'showAvatars', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleReset}
        >
          Réinitialiser
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
        >
          Sauvegarder
        </Button>
      </Box>

      {/* Snackbar de confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
