import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  Business,
  People,
  Person,
  CleaningServices,
  Settings,
  Visibility,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import FilterSearchBar from '../../components/FilterSearchBar';
import { organizationsApi } from '../../services/api';
import type { OrganizationDto } from '../../services/api';
import MembersList from '../organization/MembersList';

import type { ChipColor } from '../../types';

// ─── Types d'organisation ─────────────────────────────────────────────────────

const orgTypes: Array<{ value: string; label: string; icon: React.ReactElement; color: ChipColor }> = [
  { value: 'INDIVIDUAL', label: 'Particulier', icon: <Person />, color: 'info' },
  { value: 'CONCIERGE', label: 'Conciergerie', icon: <Business />, color: 'primary' },
  { value: 'CLEANING_COMPANY', label: 'Societe de menage', icon: <CleaningServices />, color: 'success' },
  { value: 'SYSTEM', label: 'Systeme', icon: <Settings />, color: 'error' },
];

const getTypeInfo = (type: string) => {
  return orgTypes.find(t => t.value === type) || orgTypes[0];
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface OrganizationsListHandle {
  create: () => void;
}

const OrganizationsList = forwardRef<OrganizationsListHandle>((_, ref) => {
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ name: '', type: 'INDIVIDUAL' });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [membersDialogOrg, setMembersDialogOrg] = useState<OrganizationDto | null>(null);
  const [membersRefresh, setMembersRefresh] = useState(0);
  const { isAdmin } = useAuth();
  const { notify } = useNotification();

  // Charger les organisations
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const data = await organizationsApi.listAll();
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, org: OrganizationDto) => {
    setAnchorEl(event.currentTarget);
    setSelectedOrg(org);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreate = () => {
    setFormMode('create');
    setFormData({ name: '', type: 'INDIVIDUAL' });
    setFormDialogOpen(true);
  };

  // Exposer les actions au parent (UsersAndOrganizations)
  useImperativeHandle(ref, () => ({
    create: handleCreate,
  }));

  const handleEdit = () => {
    if (selectedOrg) {
      setFormMode('edit');
      setFormData({ name: selectedOrg.name, type: selectedOrg.type });
      setFormDialogOpen(true);
      setAnchorEl(null);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleFormSave = async () => {
    if (!formData.name.trim()) {
      notify.warning('Le nom de l\'organisation est obligatoire');
      return;
    }

    setSaving(true);
    try {
      if (formMode === 'create') {
        const newOrg = await organizationsApi.create({
          name: formData.name.trim(),
          type: formData.type,
        });
        setOrganizations(prev => [...prev, newOrg]);
        notify.success('Organisation creee avec succes');
      } else if (selectedOrg) {
        const updatedOrg = await organizationsApi.update(selectedOrg.id, {
          name: formData.name.trim(),
          type: formData.type,
        });
        setOrganizations(prev =>
          prev.map(o => (o.id === selectedOrg.id ? updatedOrg : o))
        );
        notify.success('Organisation modifiee avec succes');
      }
      setFormDialogOpen(false);
      setFormData({ name: '', type: 'INDIVIDUAL' });
      setSelectedOrg(null);
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedOrg) {
      try {
        await organizationsApi.delete(selectedOrg.id);
        setOrganizations(prev => prev.filter(o => o.id !== selectedOrg.id));
        setDeleteDialogOpen(false);
        setSelectedOrg(null);
        notify.success('Organisation supprimee avec succes');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
        notify.error(message);
        setDeleteDialogOpen(false);
      }
    } else {
      setDeleteDialogOpen(false);
    }
  };

  // ─── Filtrage ─────────────────────────────────────────────────────────────

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      searchTerm === '' ||
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || org.type === selectedType;
    return matchesSearch && matchesType;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Statistiques */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                <Typography variant="h6" color="primary" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
                  {organizations.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Total organisations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {orgTypes.map((typeInfo) => (
            <Grid item xs={6} sm={4} md key={typeInfo.value}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                  <Typography
                    variant="h6"
                    color={`${typeInfo.color}.main`}
                    fontWeight={700}
                    sx={{ fontSize: '1.5rem' }}
                  >
                    {organizations.filter(o => o.type === typeInfo.value).length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {typeInfo.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher une organisation..."
        filters={{
          type: {
            value: selectedType,
            options: [
              { value: 'all', label: 'Tous les types' },
              ...orgTypes.map(t => ({ value: t.value, label: t.label })),
            ],
            onChange: setSelectedType,
            label: 'Type',
          },
        }}
        counter={{
          label: 'organisation',
          count: filteredOrgs.length,
          singular: '',
          plural: 's',
        }}
      />

      {/* Liste des organisations */}
      <Grid container spacing={2}>
        {filteredOrgs.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2.5, px: 2 }}>
                <Typography variant="h6" align="center" sx={{ fontSize: '0.95rem', mb: 1 }}>
                  {organizations.length === 0
                    ? 'Aucune organisation trouvee.'
                    : 'Aucune organisation ne correspond aux filtres.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredOrgs.map((org) => {
            const typeInfo = getTypeInfo(org.type);
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={org.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Business sx={{ fontSize: 28, color: 'primary.main' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {org.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {org.slug}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, org)}
                        sx={{ p: 0.5, ml: 0.5 }}
                      >
                        <MoreVert sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>

                    {/* Type et membres */}
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={typeInfo.icon}
                        label={typeInfo.label}
                        color={typeInfo.color}
                        size="small"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Chip
                        icon={<People sx={{ fontSize: '14px !important' }} />}
                        label={`${org.memberCount} membre${org.memberCount !== 1 ? 's' : ''}`}
                        size="small"
                        variant="outlined"
                        onClick={() => setMembersDialogOrg(org)}
                        sx={{ height: 20, fontSize: '0.7rem', cursor: 'pointer' }}
                      />
                    </Box>

                    {/* Date de creation */}
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Creee le {formatDate(org.createdAt)}
                    </Typography>
                  </CardContent>

                  {/* Actions */}
                  <CardActions sx={{ pt: 0, p: 1, gap: 0.5 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Visibility sx={{ fontSize: 16 }} />}
                      onClick={() => setMembersDialogOrg(org)}
                      sx={{ fontSize: '0.75rem', flex: 1 }}
                    >
                      Membres
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit sx={{ fontSize: 16 }} />}
                      onClick={() => {
                        setSelectedOrg(org);
                        setFormMode('edit');
                        setFormData({ name: org.name, type: org.type });
                        setFormDialogOpen(true);
                      }}
                      sx={{ fontSize: '0.75rem', flex: 1 }}
                    >
                      Modifier
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (selectedOrg) setMembersDialogOrg(selectedOrg);
            setAnchorEl(null);
          }}
          sx={{ fontSize: '0.85rem', py: 0.75 }}
        >
          <ListItemIcon>
            <People sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Voir les membres
        </MenuItem>
        <MenuItem
          onClick={handleEdit}
          sx={{ fontSize: '0.85rem', py: 0.75 }}
        >
          <ListItemIcon>
            <Edit sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Modifier
        </MenuItem>
        {isAdmin() && (
          <MenuItem
            onClick={handleDelete}
            sx={{ color: 'error.main', fontSize: '0.85rem', py: 0.75 }}
          >
            <ListItemIcon>
              <Delete sx={{ fontSize: 18, color: 'error.main' }} />
            </ListItemIcon>
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de creation/modification */}
      <Dialog
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setSelectedOrg(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {formMode === 'create' ? 'Nouvelle organisation' : 'Modifier l\'organisation'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Nom de l'organisation *"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                autoFocus
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  label="Type"
                >
                  {orgTypes.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ fontSize: 18 }}>{t.icon}</Box>
                        <Typography variant="body2">{t.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button
            onClick={() => {
              setFormDialogOpen(false);
              setSelectedOrg(null);
            }}
            size="small"
          >
            Annuler
          </Button>
          <Button
            onClick={handleFormSave}
            variant="contained"
            size="small"
            disabled={saving || !formData.name.trim()}
          >
            {saving ? 'Sauvegarde...' : formMode === 'create' ? 'Creer' : 'Sauvegarder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>Confirmer la suppression</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            Etes-vous sur de vouloir supprimer l'organisation "{selectedOrg?.name}" ?
          </Typography>
          {selectedOrg && selectedOrg.memberCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Cette organisation contient {selectedOrg.memberCount} membre(s).
              Vous devez retirer tous les membres avant de pouvoir la supprimer.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">
            Annuler
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog des membres de l'organisation */}
      <Dialog
        open={!!membersDialogOrg}
        onClose={() => {
          setMembersDialogOrg(null);
          // Rafraichir la liste des orgas pour mettre a jour le memberCount
          loadOrganizations();
        }}
        maxWidth="md"
        fullWidth
      >
        {membersDialogOrg && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <People sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Membres de {membersDialogOrg.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    <Chip
                      label={getTypeInfo(membersDialogOrg.type).label}
                      color={getTypeInfo(membersDialogOrg.type).color}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={`${membersDialogOrg.memberCount} membre${membersDialogOrg.memberCount !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
              <MembersList
                organizationId={membersDialogOrg.id}
                refreshTrigger={membersRefresh}
                onMemberChanged={() => setMembersRefresh(prev => prev + 1)}
              />
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 1.5 }}>
              <Button
                onClick={() => {
                  setMembersDialogOrg(null);
                  loadOrganizations();
                }}
                size="small"
              >
                Fermer
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
});

OrganizationsList.displayName = 'OrganizationsList';

export default OrganizationsList;
