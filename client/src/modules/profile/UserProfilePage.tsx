import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Avatar,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Palette as PaletteIcon,
  AccountCircle as AccountIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Group as GroupIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { ThemeMode } from '../../hooks/useThemeMode';
import PageHeader from '../../components/PageHeader';

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [profileData, setProfileData] = useState<UserProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    language: 'fr',
    theme: 'light',
    notifications: {
      email: true,
      push: true,
      sms: false
    }
  });

  const [originalData, setOriginalData] = useState<UserProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    language: 'fr',
    theme: 'light',
    notifications: {
      email: true,
      push: true,
      sms: false
    }
  });

  // Mettre à jour les données du formulaire quand l'utilisateur est disponible
  useEffect(() => {
    if (user) {
      const userData: UserProfileData = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        username: user.username || '',
        language: 'fr',
        theme: themeMode,
        notifications: {
          email: true,
          push: true,
          sms: false
        }
      };

      setProfileData(userData);
      setOriginalData(userData);
    }
  }, [user, themeMode]);

  const handleInputChange = (field: keyof UserProfileData, value: string | number | boolean) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));

    // Appliquer immédiatement le changement de thème
    if (field === 'theme') {
      setThemeMode(value as ThemeMode);
    }
  };

  const handleNotificationChange = (type: keyof UserProfileData['notifications']) => {
    setProfileData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Simulation de sauvegarde - à remplacer par l'appel API réel
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSaveSuccess(true);
      setIsEditing(false);
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      setSaveError('Erreur lors de la sauvegarde du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfileData(originalData);
    setIsEditing(false);
    setSaveError(null);
  };

  const handleLogout = () => {
    clearUser();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <Container maxWidth={false} sx={{ px: 3 }}>
      <PageHeader
        title="Profil utilisateur"
        subtitle="Gérez vos informations personnelles et préférences"
        backPath="/dashboard"
        showBackButton={true}
        actions={
          <Box display="flex" gap={2}>
            {isEditing ? (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancel}
                  disabled={isSaving}
                  startIcon={<CancelIcon />}
                  title="Annuler"
                >
                  Annuler
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  onClick={handleSave}
                  disabled={isSaving}
                  startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                  title="Sauvegarder"
                >
                  {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                size="small"
                color="primary"
                onClick={() => setIsEditing(true)}
                startIcon={<EditIcon />}
                title="Modifier"
              >
                Modifier
              </Button>
            )}
          </Box>
        }
      />

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Profil mis à jour avec succès !
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Informations principales */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 4, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={3} mb={4}>
              <Avatar 
                sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: '#A6C0CE',
                  fontSize: '2rem',
                  fontWeight: 700,
                  border: '3px solid rgba(166, 192, 206, 0.3)'
                }}
              >
                {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700} color="text.primary">
                  {user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  {user.email}
                </Typography>
                <Box display="flex" gap={1}>
                  {user.roles?.map((role, index) => (
                    <Chip
                      key={index}
                      label={role.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: '#A6C0CE',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 4 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prénom"
                  value={profileData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  disabled={!isEditing}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={profileData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={!isEditing}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom d'utilisateur"
                  value={profileData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={!isEditing}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={profileData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!isEditing}
                  variant="outlined"
                  type="email"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Préférences */}
          <Paper sx={{ p: 4, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              Préférences
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Langue</InputLabel>
                  <Select
                    value={profileData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    label="Langue"
                    disabled={!isEditing}
                  >
                    <MenuItem value="fr">Français</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="es">Español</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Thème</InputLabel>
                  <Select
                    value={profileData.theme}
                    onChange={(e) => handleInputChange('theme', e.target.value)}
                    label="Thème"
                    disabled={!isEditing}
                  >
                    <MenuItem value="light">Clair</MenuItem>
                    <MenuItem value="dark">Sombre</MenuItem>
                    <MenuItem value="auto">Automatique</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Notifications */}
          <Paper sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" />
              Notifications
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Notifications par email"
                  secondary="Recevoir des notifications par email"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.notifications.email}
                      onChange={() => handleNotificationChange('email')}
                      disabled={!isEditing}
                    />
                  }
                  label=""
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <NotificationsIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Notifications push"
                  secondary="Recevoir des notifications dans l'application"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.notifications.push}
                      onChange={() => handleNotificationChange('push')}
                      disabled={!isEditing}
                    />
                  }
                  label=""
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <BadgeIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Notifications SMS"
                  secondary="Recevoir des notifications par SMS"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.notifications.sms}
                      onChange={() => handleNotificationChange('sms')}
                      disabled={!isEditing}
                    />
                  }
                  label=""
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Sidebar - Actions rapides et informations */}
        <Grid item xs={12} md={4}>
          {/* Actions rapides */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountIcon color="primary" />
              Actions rapides
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SecurityIcon />}
                onClick={() => navigate('/permissions-test')}
              >
                Gérer les permissions
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                startIcon={<GroupIcon />}
                onClick={() => navigate('/teams')}
              >
                Gérer les équipes
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SettingsIcon />}
                onClick={() => navigate('/settings')}
              >
                Paramètres système
              </Button>
            </Box>
          </Paper>

          {/* Informations de sécurité */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              Sécurité
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<SecurityIcon />}
                onClick={() => navigate('/admin/monitoring')}
              >
                Monitoring des tokens
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                startIcon={<AccountIcon />}
                onClick={() => navigate('/users')}
              >
                Gestion des utilisateurs
              </Button>
            </Box>
          </Paper>

          {/* Déconnexion */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountIcon color="primary" />
              Session
            </Typography>
            
            <Button
              variant="outlined"
              color="error"
              fullWidth
              startIcon={<SettingsIcon />}
              onClick={handleLogout}
            >
              Se déconnecter
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UserProfilePage;
