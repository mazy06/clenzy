import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  Notifications,
  Build,
  Description,
  Payment,
  CalendarMonth,
  Groups,
  Business,
  Person,
  Shield,
  Home,
  Email,
  Save,
} from '@mui/icons-material';
import { notificationPreferencesApi, type NotificationPreferencesMap } from '../../services/api';

// ─── Constantes: groupement des cles par categorie ────────────────────────────

interface NotificationKeyInfo {
  key: string;
  title: string;
  description: string;
}

interface CategoryGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  keys: NotificationKeyInfo[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    id: 'intervention',
    label: 'Interventions',
    icon: <Build fontSize="small" />,
    color: '#6B8A9A',
    keys: [
      { key: 'INTERVENTION_CREATED', title: 'Intervention creee', description: 'Quand une nouvelle intervention est creee' },
      { key: 'INTERVENTION_UPDATED', title: 'Intervention mise a jour', description: 'Quand une intervention est modifiee' },
      { key: 'INTERVENTION_ASSIGNED_TO_USER', title: 'Assignee a un utilisateur', description: 'Quand vous etes assigne a une intervention' },
      { key: 'INTERVENTION_ASSIGNED_TO_TEAM', title: 'Assignee a une equipe', description: 'Quand votre equipe est assignee a une intervention' },
      { key: 'INTERVENTION_STARTED', title: 'Intervention demarree', description: 'Quand une intervention commence' },
      { key: 'INTERVENTION_PROGRESS_UPDATED', title: 'Progression mise a jour', description: 'Quand la progression d\'une intervention change' },
      { key: 'INTERVENTION_COMPLETED', title: 'Intervention terminee', description: 'Quand une intervention est completee a 100%' },
      { key: 'INTERVENTION_REOPENED', title: 'Intervention rouverte', description: 'Quand une intervention terminee est rouverte' },
      { key: 'INTERVENTION_STATUS_CHANGED', title: 'Statut modifie', description: 'Quand le statut d\'une intervention change' },
      { key: 'INTERVENTION_VALIDATED', title: 'Intervention validee', description: 'Quand une intervention est validee par un manager' },
      { key: 'INTERVENTION_AWAITING_VALIDATION', title: 'En attente de validation', description: 'Quand une intervention necessite une validation' },
      { key: 'INTERVENTION_AWAITING_PAYMENT', title: 'En attente de paiement', description: 'Quand un paiement est requis pour une intervention' },
      { key: 'INTERVENTION_CANCELLED', title: 'Intervention annulee', description: 'Quand une intervention est annulee' },
      { key: 'INTERVENTION_DELETED', title: 'Intervention supprimee', description: 'Quand une intervention est supprimee' },
      { key: 'INTERVENTION_PHOTOS_ADDED', title: 'Photos ajoutees', description: 'Quand des photos sont ajoutees a une intervention' },
      { key: 'INTERVENTION_NOTES_UPDATED', title: 'Notes mises a jour', description: 'Quand les notes d\'une intervention sont modifiees' },
      { key: 'INTERVENTION_OVERDUE', title: 'Intervention en retard', description: 'Quand une intervention depasse sa date prevue' },
      { key: 'INTERVENTION_REMINDER', title: 'Rappel d\'intervention', description: 'Rappel avant le debut d\'une intervention' },
    ],
  },
  {
    id: 'service_request',
    label: 'Demandes de service',
    icon: <Description fontSize="small" />,
    color: '#A6C0CE',
    keys: [
      { key: 'SERVICE_REQUEST_CREATED', title: 'Demande creee', description: 'Quand une nouvelle demande de service est soumise' },
      { key: 'SERVICE_REQUEST_UPDATED', title: 'Demande mise a jour', description: 'Quand une demande de service est modifiee' },
      { key: 'SERVICE_REQUEST_APPROVED', title: 'Demande approuvee', description: 'Quand une demande de service est acceptee' },
      { key: 'SERVICE_REQUEST_REJECTED', title: 'Demande rejetee', description: 'Quand une demande de service est refusee' },
      { key: 'SERVICE_REQUEST_INTERVENTION_CREATED', title: 'Intervention creee depuis demande', description: 'Quand une intervention est generee depuis une demande' },
      { key: 'SERVICE_REQUEST_ASSIGNED', title: 'Demande assignee', description: 'Quand une demande est assignee a un intervenant' },
      { key: 'SERVICE_REQUEST_CANCELLED', title: 'Demande annulee', description: 'Quand une demande de service est annulee' },
      { key: 'SERVICE_REQUEST_URGENT', title: 'Demande urgente', description: 'Quand une demande urgente est recue' },
    ],
  },
  {
    id: 'payment',
    label: 'Paiements',
    icon: <Payment fontSize="small" />,
    color: '#4A9B8E',
    keys: [
      { key: 'PAYMENT_SESSION_CREATED', title: 'Session de paiement creee', description: 'Quand une session de paiement est initiee' },
      { key: 'PAYMENT_CONFIRMED', title: 'Paiement confirme', description: 'Quand un paiement est confirme avec succes' },
      { key: 'PAYMENT_FAILED', title: 'Paiement echoue', description: 'Quand un paiement echoue' },
      { key: 'PAYMENT_GROUPED_SESSION_CREATED', title: 'Paiement groupe cree', description: 'Quand un paiement groupe est initie' },
      { key: 'PAYMENT_GROUPED_CONFIRMED', title: 'Paiement groupe confirme', description: 'Quand un paiement groupe est confirme' },
      { key: 'PAYMENT_GROUPED_FAILED', title: 'Paiement groupe echoue', description: 'Quand un paiement groupe echoue' },
      { key: 'PAYMENT_DEFERRED_REMINDER', title: 'Rappel paiement differe', description: 'Rappel pour un paiement differe en attente' },
      { key: 'PAYMENT_DEFERRED_OVERDUE', title: 'Paiement differe en retard', description: 'Quand un paiement differe depasse la date limite' },
      { key: 'PAYMENT_REFUND_INITIATED', title: 'Remboursement initie', description: 'Quand un remboursement est lance' },
      { key: 'PAYMENT_REFUND_COMPLETED', title: 'Remboursement effectue', description: 'Quand un remboursement est termine' },
    ],
  },
  {
    id: 'team',
    label: 'Equipes',
    icon: <Groups fontSize="small" />,
    color: '#D4A574',
    keys: [
      { key: 'TEAM_CREATED', title: 'Equipe creee', description: 'Quand une nouvelle equipe est creee' },
      { key: 'TEAM_UPDATED', title: 'Equipe modifiee', description: 'Quand une equipe est mise a jour' },
      { key: 'TEAM_DELETED', title: 'Equipe supprimee', description: 'Quand une equipe est supprimee' },
      { key: 'TEAM_MEMBER_ADDED', title: 'Membre ajoute', description: 'Quand vous etes ajoute a une equipe' },
      { key: 'TEAM_MEMBER_REMOVED', title: 'Membre retire', description: 'Quand vous etes retire d\'une equipe' },
      { key: 'TEAM_ASSIGNED_INTERVENTION', title: 'Equipe assignee a intervention', description: 'Quand votre equipe est assignee a une intervention' },
      { key: 'TEAM_ROLE_CHANGED', title: 'Role modifie', description: 'Quand votre role dans une equipe change' },
      { key: 'TEAM_MEMBER_JOINED', title: 'Nouveau membre', description: 'Quand un nouveau membre rejoint votre equipe' },
    ],
  },
  {
    id: 'ical',
    label: 'Import iCal',
    icon: <CalendarMonth fontSize="small" />,
    color: '#7BA3C2',
    keys: [
      { key: 'ICAL_IMPORT_SUCCESS', title: 'Import reussi', description: 'Quand un import iCal se termine avec succes' },
      { key: 'ICAL_IMPORT_PARTIAL', title: 'Import partiel', description: 'Quand un import iCal est partiellement reussi' },
      { key: 'ICAL_IMPORT_FAILED', title: 'Import echoue', description: 'Quand un import iCal echoue' },
      { key: 'ICAL_SYNC_COMPLETED', title: 'Synchronisation terminee', description: 'Quand la synchronisation automatique se termine' },
      { key: 'ICAL_FEED_DELETED', title: 'Feed supprime', description: 'Quand un feed iCal est supprime' },
      { key: 'ICAL_AUTO_INTERVENTIONS_TOGGLED', title: 'Auto-creation modifiee', description: 'Quand l\'auto-creation d\'interventions est activee/desactivee' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portefeuilles',
    icon: <Business fontSize="small" />,
    color: '#8B9AAB',
    keys: [
      { key: 'PORTFOLIO_CREATED', title: 'Portefeuille cree', description: 'Quand un nouveau portefeuille est cree' },
      { key: 'PORTFOLIO_CLIENT_ADDED', title: 'Client ajoute', description: 'Quand un client est ajoute a un portefeuille' },
      { key: 'PORTFOLIO_CLIENT_REMOVED', title: 'Client retire', description: 'Quand un client est retire d\'un portefeuille' },
      { key: 'PORTFOLIO_TEAM_MEMBER_ADDED', title: 'Membre equipe ajoute', description: 'Quand un membre est ajoute a un portefeuille' },
      { key: 'PORTFOLIO_TEAM_MEMBER_REMOVED', title: 'Membre equipe retire', description: 'Quand un membre est retire d\'un portefeuille' },
      { key: 'PORTFOLIO_UPDATED', title: 'Portefeuille modifie', description: 'Quand un portefeuille est mis a jour' },
    ],
  },
  {
    id: 'user',
    label: 'Utilisateurs',
    icon: <Person fontSize="small" />,
    color: '#C97A7A',
    keys: [
      { key: 'USER_CREATED', title: 'Utilisateur cree', description: 'Quand un nouvel utilisateur est cree' },
      { key: 'USER_UPDATED', title: 'Profil modifie', description: 'Quand un profil utilisateur est modifie' },
      { key: 'USER_DELETED', title: 'Utilisateur supprime', description: 'Quand un utilisateur est supprime' },
      { key: 'USER_ROLE_CHANGED', title: 'Role modifie', description: 'Quand le role d\'un utilisateur change' },
      { key: 'USER_DEACTIVATED', title: 'Compte desactive', description: 'Quand un compte est desactive' },
    ],
  },
  {
    id: 'gdpr',
    label: 'RGPD',
    icon: <Shield fontSize="small" />,
    color: '#6B8A9A',
    keys: [
      { key: 'GDPR_DATA_EXPORTED', title: 'Donnees exportees', description: 'Quand un export RGPD est genere' },
      { key: 'GDPR_USER_ANONYMIZED', title: 'Utilisateur anonymise', description: 'Quand les donnees d\'un utilisateur sont anonymisees' },
      { key: 'GDPR_CONSENTS_UPDATED', title: 'Consentements modifies', description: 'Quand les consentements RGPD sont mis a jour' },
    ],
  },
  {
    id: 'permission',
    label: 'Permissions',
    icon: <Shield fontSize="small" />,
    color: '#A6C0CE',
    keys: [
      { key: 'PERMISSION_ROLE_UPDATED', title: 'Permissions modifiees', description: 'Quand les permissions d\'un role changent' },
      { key: 'PERMISSION_CACHE_INVALIDATED', title: 'Cache invalide', description: 'Quand le cache des permissions est reinitialise' },
    ],
  },
  {
    id: 'property',
    label: 'Proprietes',
    icon: <Home fontSize="small" />,
    color: '#4A9B8E',
    keys: [
      { key: 'PROPERTY_CREATED', title: 'Propriete creee', description: 'Quand une nouvelle propriete est ajoutee' },
      { key: 'PROPERTY_UPDATED', title: 'Propriete modifiee', description: 'Quand une propriete est mise a jour' },
      { key: 'PROPERTY_DELETED', title: 'Propriete supprimee', description: 'Quand une propriete est supprimee' },
      { key: 'PROPERTY_STATUS_CHANGED', title: 'Statut modifie', description: 'Quand le statut d\'une propriete change' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact & Messagerie',
    icon: <Email fontSize="small" />,
    color: '#e91e63',
    keys: [
      { key: 'CONTACT_MESSAGE_RECEIVED', title: 'Message recu', description: 'Quand vous recevez un nouveau message' },
      { key: 'CONTACT_MESSAGE_SENT', title: 'Message envoye', description: 'Confirmation quand un message est envoye' },
      { key: 'CONTACT_MESSAGE_REPLIED', title: 'Reponse recue', description: 'Quand quelqu\'un repond a votre message' },
      { key: 'CONTACT_MESSAGE_ARCHIVED', title: 'Message archive', description: 'Quand un message est archive' },
      { key: 'CONTACT_FORM_RECEIVED', title: 'Formulaire recu', description: 'Quand un formulaire (devis, maintenance, support) est soumis' },
      { key: 'CONTACT_FORM_STATUS_CHANGED', title: 'Statut formulaire modifie', description: 'Quand le statut d\'un formulaire change' },
    ],
  },
  {
    id: 'document',
    label: 'Documents',
    icon: <Description sx={{ color: '#f57c00' }} />,
    color: '#f57c00',
    keys: [
      { key: 'DOCUMENT_GENERATED', title: 'Document genere', description: 'Quand un document PDF est genere avec succes' },
      { key: 'DOCUMENT_GENERATION_FAILED', title: 'Echec de generation', description: 'Quand la generation d\'un document echoue' },
      { key: 'DOCUMENT_TEMPLATE_UPLOADED', title: 'Template uploade', description: 'Quand un nouveau template de document est uploade' },
      { key: 'DOCUMENT_SENT_BY_EMAIL', title: 'Document envoye par email', description: 'Quand un document est envoye par email au destinataire' },
    ],
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function NotificationPreferencesCard() {
  const [preferences, setPreferences] = useState<NotificationPreferencesMap>({});
  const [originalPrefs, setOriginalPrefs] = useState<NotificationPreferencesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await notificationPreferencesApi.getAll();
      setPreferences(prefs);
      setOriginalPrefs(prefs);
    } catch (err) {
      console.error('Erreur chargement preferences:', err);
      setError('Impossible de charger les preferences de notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = (key: string, enabled: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: enabled }));
  };

  const handleToggleCategory = (category: CategoryGroup, enabled: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev };
      category.keys.forEach(k => {
        updated[k.key] = enabled;
      });
      return updated;
    });
  };

  const hasChanges = () => {
    return Object.keys(preferences).some(key => preferences[key] !== originalPrefs[key]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Envoyer uniquement les preferences modifiees
      const changed: NotificationPreferencesMap = {};
      Object.keys(preferences).forEach(key => {
        if (preferences[key] !== originalPrefs[key]) {
          changed[key] = preferences[key];
        }
      });

      if (Object.keys(changed).length === 0) {
        setSnackbar({ open: true, message: 'Aucune modification a sauvegarder', severity: 'success' });
        return;
      }

      const updated = await notificationPreferencesApi.update(changed);
      setPreferences(updated);
      setOriginalPrefs(updated);
      setSnackbar({ open: true, message: 'Preferences sauvegardees avec succes', severity: 'success' });
    } catch (err) {
      console.error('Erreur sauvegarde preferences:', err);
      setSnackbar({ open: true, message: 'Erreur lors de la sauvegarde', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryStats = (category: CategoryGroup) => {
    const total = category.keys.length;
    const enabled = category.keys.filter(k => preferences[k.key] !== false).length;
    return { total, enabled };
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={32} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="warning">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notifications sx={{ color: 'secondary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
            Preferences de notifications
          </Typography>
        </Box>
        {hasChanges() && (
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>
        Choisissez les notifications que vous souhaitez recevoir. Desactivez celles qui ne vous interessent pas.
      </Typography>

      {/* Categories Accordions — grille 2 colonnes */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1,
          alignItems: 'start',
        }}
      >
        {CATEGORIES.map((category) => {
          const stats = getCategoryStats(category);
          const allEnabled = stats.enabled === stats.total;
          const noneEnabled = stats.enabled === 0;

          return (
            <Accordion
              key={category.id}
              disableGutters
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px !important',
                m: 0,
                '&.Mui-expanded': { m: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{ minHeight: 48, '& .MuiAccordionSummary-content': { my: 0.5 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1 }}>
                  <Box sx={{ color: noneEnabled ? 'text.disabled' : category.color, display: 'flex', transition: 'color 0.2s' }}>
                    {category.icon}
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      flex: 1,
                      color: noneEnabled ? 'text.disabled' : 'text.primary',
                      transition: 'color 0.2s',
                    }}
                  >
                    {category.label}
                  </Typography>
                  <Chip
                    label={`${stats.enabled}/${stats.total}`}
                    size="small"
                    color={allEnabled ? 'success' : noneEnabled ? 'default' : 'warning'}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                  <Tooltip title={allEnabled ? 'Desactiver toute la section' : noneEnabled ? 'Activer toute la section' : 'Tout activer'}>
                    <Switch
                      size="small"
                      checked={!noneEnabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        e.stopPropagation();
                        handleToggleCategory(category, noneEnabled ? true : false);
                      }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      color={allEnabled ? 'success' : 'warning'}
                      sx={{ ml: 0.5 }}
                    />
                  </Tooltip>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1, opacity: noneEnabled ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                <List dense disablePadding>
                  {category.keys.map((nKey) => (
                    <ListItem key={nKey.key} sx={{ py: 0.25, px: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                            {nKey.title}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {nKey.description}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          edge="end"
                          size="small"
                          checked={preferences[nKey.key] !== false}
                          onChange={(_, checked) => handleToggle(nKey.key, checked)}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
