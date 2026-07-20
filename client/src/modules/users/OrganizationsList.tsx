import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
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
  Skeleton,
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
  Add,
  CorporateFare,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import { organizationsApi } from '../../services/api/organizationsApi';
import type { OrganizationDto } from '../../services/api';
import MembersList from '../organization/MembersList';

import type { ChipColor } from '../../types';
import type { LucideIcon } from 'lucide-react';

// ─── Types d'organisation ─────────────────────────────────────────────────────

const orgTypes: Array<{ value: string; label: string; Icon: LucideIcon; color: ChipColor; hex: string }> = [
  { value: 'INDIVIDUAL', label: 'Particulier', Icon: Person, color: 'info', hex: '#7BA3C2' },
  { value: 'CONCIERGE', label: 'Conciergerie', Icon: Business, color: 'primary', hex: '#6B8A9A' },
  { value: 'CLEANING_COMPANY', label: 'Societe de menage', Icon: CleaningServices, color: 'success', hex: '#4A9B8E' },
  { value: 'SYSTEM', label: 'Systeme', Icon: Settings, color: 'error', hex: '#C97A7A' },
];

const MEMBER_CHIP_COLOR = '#7BA3C2';

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

interface OrganizationsListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

const OrganizationsList = forwardRef<OrganizationsListHandle, OrganizationsListProps>(({ embedded = false, actionsContainer, filtersContainer }, ref) => {
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
      <Grid container spacing={2}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
            <Skeleton variant="rounded" height={170} sx={{ borderRadius: '14px' }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  const actionButtons = isAdmin() ? (
    <Button
      variant="contained"
      color="primary"
      size="small"
      startIcon={<Add size={18} strokeWidth={1.75} />}
      onClick={handleCreate}
      sx={{ fontSize: '0.8125rem' }}
    >
      Nouvelle organisation
    </Button>
  ) : null;

  const filtersBar = (
    <FilterSearchBar
      bare={Boolean(filtersContainer)}
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
  );

  return (
    <Box>
      {/* Portal des actions dans le header parent */}
      {embedded && actionsContainer && actionButtons && createPortal(actionButtons, actionsContainer)}

      {/* Header standalone (hors Annuaire multi-tabs) */}
      {!embedded && (
        <PageHeader
          title="Organisations"
          subtitle="Organisations clientes (multi-tenant) : informations légales, branding et configuration."
          iconBadge={<CorporateFare />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      {/* Statistiques — StatTile (carte plate hairline, valeur display) */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md>
            <StatTile
              icon={<CorporateFare />}
              label="Total organisations"
              value={organizations.length}
              color="#6B8A9A"
            />
          </Grid>
          {orgTypes.map((typeInfo) => {
            const TypeIcon = typeInfo.Icon;
            return (
              <Grid item xs={6} sm={4} md key={typeInfo.value}>
                <StatTile
                  icon={<TypeIcon />}
                  label={typeInfo.label}
                  value={organizations.filter(o => o.type === typeInfo.value).length}
                  color={typeInfo.hex}
                />
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Filtres : portales dans le PageHeader parent, sinon inline en standalone */}
      {filtersContainer
        ? createPortal(filtersBar, filtersContainer)
        : !embedded && <Box sx={{ mb: 2 }}>{filtersBar}</Box>}

      {/* Liste des organisations */}
      <Grid container spacing={2}>
        {filteredOrgs.length === 0 ? (
          <Grid item xs={12}>
            <EmptyState
              icon={<CorporateFare />}
              title={organizations.length === 0 ? 'Aucune organisation' : 'Aucun résultat'}
              description={
                organizations.length === 0
                  ? 'Créez la première organisation avec le bouton « Nouvelle organisation ».'
                  : 'Aucune organisation ne correspond aux filtres sélectionnés.'
              }
            />
          </Grid>
        ) : (
          filteredOrgs.map((org) => {
            const typeInfo = getTypeInfo(org.type);
            const typeColor = typeInfo.hex;
            const TypeIcon = typeInfo.Icon;
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={org.id}>
                {/* Carte hairline r14 (thème global) — hover lift + shadow-card */}
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      borderColor: 'var(--line-2)',
                      boxShadow: 'var(--shadow-card)',
                      transform: 'translateY(-1px)',
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                      '&:hover': { transform: 'none' },
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 1.75, pb: 1.25 }}>
                    {/* Header — badge icône fond soft (pattern .mg-avt) */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25, gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: `${typeColor}1F`,
                            color: typeColor,
                            flexShrink: 0,
                          }}
                        >
                          <TypeIcon size={18} strokeWidth={1.75} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            fontWeight={600}
                            sx={{
                              fontSize: '0.9rem',
                              lineHeight: 1.25,
                              color: 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={org.name}
                          >
                            {org.name}
                          </Typography>
                          <Typography
                            color="text.secondary"
                            sx={{
                              fontSize: '0.7rem',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {org.slug}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, org)}
                        sx={{ p: 0.5, ml: 0.25, color: 'text.secondary' }}
                        aria-label="Options"
                      >
                        <MoreVert size={16} strokeWidth={1.75} />
                      </IconButton>
                    </Box>

                    {/* Type et membres — chips -soft (pilule/typo via thème global MuiChip) */}
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<TypeIcon size={11} strokeWidth={2} />}
                        label={typeInfo.label}
                        size="small"
                        sx={{
                          backgroundColor: `${typeColor}18`,
                          color: typeColor,
                          '& .MuiChip-icon': { color: typeColor, ml: '8px', mr: '-4px' },
                        }}
                      />
                      <Chip
                        icon={<People size={11} strokeWidth={2} />}
                        label={`${org.memberCount} membre${org.memberCount !== 1 ? 's' : ''}`}
                        size="small"
                        onClick={() => setMembersDialogOrg(org)}
                        sx={{
                          cursor: 'pointer',
                          backgroundColor: `${MEMBER_CHIP_COLOR}18`,
                          color: MEMBER_CHIP_COLOR,
                          fontVariantNumeric: 'tabular-nums',
                          '& .MuiChip-icon': { color: MEMBER_CHIP_COLOR, ml: '8px', mr: '-4px' },
                          '&:hover': { backgroundColor: `${MEMBER_CHIP_COLOR}28` },
                        }}
                      />
                    </Box>

                    {/* Date de creation */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
                        <Person size={13} strokeWidth={1.75} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Creee le {formatDate(org.createdAt)}
                      </Typography>
                    </Box>
                  </CardContent>

                  {/* Actions */}
                  {/* Boutons secondaires : peau .s-btn--g du thème global */}
                  <CardActions sx={{ pt: 0, px: 1.75, pb: 1.5, gap: 0.75 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Visibility size={14} strokeWidth={1.75} />}
                      onClick={() => setMembersDialogOrg(org)}
                      sx={{ flex: 1 }}
                    >
                      Membres
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit size={14} strokeWidth={1.75} />}
                      onClick={() => {
                        setSelectedOrg(org);
                        setFormMode('edit');
                        setFormData({ name: org.name, type: org.type });
                        setFormDialogOpen(true);
                      }}
                      sx={{ flex: 1 }}
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
        >
          <ListItemIcon>
            <People size={18} strokeWidth={1.75} />
          </ListItemIcon>
          Voir les membres
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit size={18} strokeWidth={1.75} />
          </ListItemIcon>
          Modifier
        </MenuItem>
        {isAdmin() && (
          <MenuItem onClick={handleDelete} sx={{ color: 'var(--err)' }}>
            <ListItemIcon>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}><Delete size={18} strokeWidth={1.75} /></Box>
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
                  {orgTypes.map((t) => {
                    const TypeIcon = t.Icon;
                    return (
                      <MenuItem key={t.value} value={t.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'inline-flex', color: t.hex }}>
                            <TypeIcon size={16} strokeWidth={1.75} />
                          </Box>
                          <Typography variant="body2">{t.label}</Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
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
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><People size={20} strokeWidth={1.75} /></Box>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Membres de {membersDialogOrg.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    {(() => { const ti = getTypeInfo(membersDialogOrg.type); const c = ti.hex; return (
                      <Chip
                        label={ti.label}
                        size="small"
                        sx={{ backgroundColor: `${c}18`, color: c }}
                      />
                    ); })()}
                    <Chip
                      label={`${membersDialogOrg.memberCount} membre${membersDialogOrg.memberCount !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{ backgroundColor: `${MEMBER_CHIP_COLOR}18`, color: MEMBER_CHIP_COLOR, fontVariantNumeric: 'tabular-nums' }}
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
