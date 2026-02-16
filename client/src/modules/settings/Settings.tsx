import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Notifications,
  Security,
  Business,
  Person,
  Save,
  Refresh,
  Palette,
  Storage,
  TuneOutlined,
  LightMode,
  DarkMode,
  SettingsBrightness,
} from '@mui/icons-material';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useNavigate } from 'react-router-dom';
import storageService, { STORAGE_KEYS } from '../../services/storageService';
import NotificationPreferencesCard from './NotificationPreferencesCard';

// ─── TabPanel ─────────────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>{children}</Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

export default function Settings() {
  const { user, hasPermissionAsync } = useAuth();
  const { settings: workflowSettings, updateSettings: updateWorkflowSettings } = useWorkflowSettings();
  const { mode: themeMode, setMode: setThemeMode, isDark } = useThemeMode();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Vérifier les permissions pour les paramètres
  const [canViewSettings, setCanViewSettings] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  
  // TOUS les useState DOIVENT être déclarés AVANT les vérifications conditionnelles
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

  useEffect(() => {
    const saved = storageService.getJSON<typeof settings>(STORAGE_KEYS.SETTINGS);
    if (saved) {
      // Synchroniser le thème affiché avec le mode réel du thème
      setSettings({
        ...saved,
        display: {
          ...saved.display,
          theme: themeMode === 'auto' ? (isDark ? 'dark' : 'light') : themeMode,
        },
      });
    } else {
      // Synchroniser l'état par défaut avec le mode thème actuel
      setSettings(prev => ({
        ...prev,
        display: {
          ...prev.display,
          theme: themeMode === 'auto' ? (isDark ? 'dark' : 'light') : themeMode,
        },
      }));
    }
  }, [themeMode, isDark]);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkPermissions = async () => {
      const viewPermission = await hasPermissionAsync('settings:view');
      const editPermission = await hasPermissionAsync('settings:edit');
      
      setCanViewSettings(viewPermission);
      setCanEditSettings(editPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  // Attendre que l'utilisateur soit complètement chargé APRÈS tous les hooks
  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Si pas de permission, afficher un message informatif
  if (!canViewSettings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour accéder aux paramètres.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleSettingChange = (category: string, setting: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [setting]: value,
      },
    }));
  };

  const handleSave = () => {
    try {
      storageService.setJSON(STORAGE_KEYS.SETTINGS, settings);
      setSnackbarMessage('Paramètres sauvegardés avec succès');
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage('Erreur lors de la sauvegarde des paramètres');
      setSnackbarOpen(true);
    }
  };

  const handleReset = () => {
    const defaultSettings = {
      notifications: { email: true, push: false, sms: false },
      security: { twoFactorAuth: false, sessionTimeout: 30, passwordExpiry: 90 },
      business: { companyName: 'Clenzy', timezone: 'Europe/Paris', currency: 'EUR', language: 'fr' },
      display: { theme: 'light', compactMode: false, showAvatars: true },
    };
    setSettings(defaultSettings);
    storageService.setJSON(STORAGE_KEYS.SETTINGS, defaultSettings);
    setSnackbarMessage('Paramètres réinitialisés');
    setSnackbarOpen(true);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1.25rem' }}>
          Paramètres
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          Configurez votre application selon vos préférences
        </Typography>
      </Box>

      {/* Onglets */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings-tabs"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            },
          }}
        >
          <Tab
            icon={<TuneOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Général"
            {...a11yProps(0)}
          />
          <Tab
            icon={<Notifications sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Notifications"
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>

      {/* ─── Onglet Général ─────────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          {/* Sécurité */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Security sx={{ color: '#A6C0CE', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
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
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Business sx={{ color: 'secondary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
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

          {/* Workflow */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Storage sx={{ color: 'secondary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                  Workflow
                </Typography>
              </Box>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Délai d'annulation (heures)"
                    secondary="Temps limite pour annuler une demande approuvée"
                  />
                  <TextField
                    type="number"
                    value={workflowSettings.cancellationDeadlineHours}
                    onChange={(e) => updateWorkflowSettings({ cancellationDeadlineHours: parseInt(e.target.value) })}
                    sx={{ width: 80 }}
                    size="small"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText
                    primary="Attribution automatique"
                    secondary="Attribuer automatiquement les interventions"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={workflowSettings.autoAssignInterventions}
                      onChange={(e) => updateWorkflowSettings({ autoAssignInterventions: e.target.checked })}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Approbation requise"
                    secondary="Demander approbation pour les modifications"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={workflowSettings.requireApprovalForChanges}
                      onChange={(e) => updateWorkflowSettings({ requireApprovalForChanges: e.target.checked })}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Affichage */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Palette sx={{ color: 'secondary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                  Affichage
                </Typography>
              </Box>

              <List>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1.5, py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Palette sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <ListItemText
                      primary="Apparence"
                      secondary={
                        themeMode === 'auto'
                          ? `Système (${isDark ? 'sombre' : 'clair'} détecté)`
                          : themeMode === 'dark'
                            ? 'Mode sombre'
                            : 'Mode clair'
                      }
                      sx={{ m: 0 }}
                    />
                  </Box>
                  <ToggleButtonGroup
                    value={themeMode}
                    exclusive
                    onChange={(_e, newMode) => {
                      if (newMode !== null) {
                        handleSettingChange('display', 'theme', newMode);
                        setThemeMode(newMode);
                      }
                    }}
                    size="small"
                    fullWidth
                    sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.8125rem', gap: 0.75, py: 0.75 } }}
                  >
                    <ToggleButton value="light">
                      <LightMode sx={{ fontSize: 18 }} />
                      Clair
                    </ToggleButton>
                    <ToggleButton value="dark">
                      <DarkMode sx={{ fontSize: 18 }} />
                      Sombre
                    </ToggleButton>
                    <ToggleButton value="auto">
                      <SettingsBrightness sx={{ fontSize: 18 }} />
                      Système
                    </ToggleButton>
                  </ToggleButtonGroup>
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

        {/* Actions onglet Général */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
            size="small"
          >
            Réinitialiser
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            size="small"
          >
            Sauvegarder
          </Button>
        </Box>
      </TabPanel>

      {/* ─── Onglet Notifications ───────────────────────────────────────── */}
      <TabPanel value={tabValue} index={1}>
        <NotificationPreferencesCard />
      </TabPanel>

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
