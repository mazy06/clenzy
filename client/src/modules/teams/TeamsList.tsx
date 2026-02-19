import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  Refresh,
  AutoAwesome,
  Build,
  Category,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import TeamCard from '../../components/TeamCard';
import { useTeamsList } from './useTeamsList';

// Catégories de filtrage pour la liste des équipes
const TEAM_FILTER_CATEGORIES = [
  { value: 'CLEANING', label: 'Nettoyage', icon: <AutoAwesome sx={{ fontSize: 16 }} />, borderColor: 'success.main' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: <Build sx={{ fontSize: 16 }} />, borderColor: 'warning.main' },
  { value: 'OTHER', label: 'Autre', icon: <Category sx={{ fontSize: 16 }} />, borderColor: 'info.main' },
];

const TeamsList: React.FC = () => {
  const {
    loading,
    error,
    selectedTeam,
    anchorEl,
    searchTerm,
    selectedType,
    page,
    ITEMS_PER_PAGE,
    deleteDialogOpen,
    teamWorkloadCounts,
    canCreateTeams,
    canEditTeams,
    canDeleteTeams,

    setSearchTerm,
    setSelectedType,
    setPage,

    handleMenuOpen,
    handleMenuClose,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog,
    confirmDelete,

    filteredTeams,
    paginatedTeams,

    navigate,
    t,
  } = useTeamsList();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const totalPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE);

  return (
    <Box>
      <PageHeader
        title={t('teams.title')}
        subtitle={t('teams.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          canCreateTeams && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/teams/new')}
              size="small"
              title={t('teams.create')}
            >
              {t('teams.create')}
            </Button>
          )
        }
      />

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* ─── Barre de recherche + filtres ─── */}
      <Box sx={{ mb: 2 }}>
        {/* Recherche */}
        <TextField
          fullWidth
          size="small"
          placeholder={t('teams.searchPlaceholder') || 'Rechercher une équipe...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontSize: '0.85rem',
            },
          }}
        />

        {/* Filtres par catégorie de service */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          <Chip
            label={t('teams.allTypes')}
            onClick={() => setSelectedType('all')}
            color={selectedType === 'all' ? 'primary' : 'default'}
            variant={selectedType === 'all' ? 'filled' : 'outlined'}
            size="small"
            sx={{
              cursor: 'pointer',
              fontSize: '0.72rem',
              height: 26,
              fontWeight: 600,
              borderWidth: 1.5,
              '&:hover': { transform: 'translateY(-1px)', transition: 'all 0.2s ease-in-out' },
            }}
          />
          {TEAM_FILTER_CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              icon={cat.icon}
              label={cat.label}
              onClick={() => setSelectedType(cat.value)}
              color={selectedType === cat.value ? 'primary' : 'default'}
              variant={selectedType === cat.value ? 'filled' : 'outlined'}
              size="small"
              sx={{
                cursor: 'pointer',
                fontSize: '0.72rem',
                height: 26,
                fontWeight: selectedType === cat.value ? 600 : 400,
                borderWidth: 1.5,
                borderColor: selectedType === cat.value ? 'primary.main' : cat.borderColor,
                '&:hover': { transform: 'translateY(-1px)', transition: 'all 0.2s ease-in-out' },
              }}
            />
          ))}
        </Box>

        {/* Compteur d'équipes */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {filteredTeams.length} {filteredTeams.length > 1 ? t('teams.teams') : t('teams.team')} {t('teams.available')}
          </Typography>
        </Box>
      </Box>

      {/* ─── Liste des équipes ─── */}
      {filteredTeams.length === 0 ? (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            {t('teams.noTeamFound')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
            {t('teams.noTeamCreated')}
          </Typography>
          {canCreateTeams && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/teams/new')}
              size="medium"
            >
              {t('teams.createFirst')}
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {paginatedTeams.map((team) => (
              <Grid item xs={12} md={6} lg={4} key={team.id}>
                <TeamCard
                  team={team}
                  onMenuOpen={handleMenuOpen}
                  activeInterventionsCount={teamWorkloadCounts[team.name] || 0}
                  canEdit={canEditTeams}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page + 1}
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
                size="small"
              />
            </Box>
          )}
        </>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleViewDetails} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Visibility fontSize="small" sx={{ fontSize: 18 }} />
          </ListItemIcon>
          {t('teams.viewDetails')}
        </MenuItem>
        {canEditTeams && (
          <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <Edit fontSize="small" sx={{ fontSize: 18 }} />
            </ListItemIcon>
            {t('teams.modify')}
          </MenuItem>
        )}
        {canDeleteTeams && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main', fontSize: 18 }} />
            </ListItemIcon>
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle sx={{ pb: 1 }}>{t('teams.confirmDelete')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            {t('teams.confirmDeleteMessage', { name: selectedTeam?.name })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={handleCloseDeleteDialog} size="small">{t('teams.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            {t('teams.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamsList;
