import React from 'react';
import { Spinner } from '../../components/ui';
import { createPortal } from 'react-dom';
import { Grid, Button, Chip, Alert, Menu, MenuItem, ListItemIcon, Divider, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Refresh,
  AutoAwesome,
  Build,
  Category,
  Groups,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import TeamCard from '../../components/TeamCard';
import { useTeamsList } from './useTeamsList';
import PagePagination from '../../components/PagePagination';
import { useScreenSearch } from '../../components/ScreenChrome';

// Catégories de filtrage pour la liste des équipes
const TEAM_FILTER_CATEGORIES = [
  { value: 'CLEANING', label: 'Nettoyage', icon: <AutoAwesome size={16} strokeWidth={1.75} />, borderColor: 'var(--ok)' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: <Build size={16} strokeWidth={1.75} />, borderColor: 'var(--warn)' },
  { value: 'OTHER', label: 'Autre', icon: <Category size={16} strokeWidth={1.75} />, borderColor: 'var(--info)' },
];

interface TeamsListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

const TeamsList: React.FC<TeamsListProps> = ({ embedded = false, actionsContainer }) => {
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

  // Recherche de l'écran → champ UNIQUE du PageHeader (cf. ScreenChrome).
  useScreenSearch(searchTerm, setSearchTerm, t('teams.searchPlaceholder') || 'Rechercher une équipe…');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  const totalPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE);

  const actionButtons = canCreateTeams ? (
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
  ) : null;

  return (
    <div>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && actionButtons && createPortal(actionButtons, actionsContainer)}

      {!embedded && (
        <PageHeader
          title={t('teams.title')}
          subtitle={t('teams.subtitle')}
          iconBadge={<Groups />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* ─── Barre de recherche + filtres ─── */}
      <div className="mb-3">

        {/* Filtres par catégorie de service */}
        <div className="flex gap-1 flex-wrap mb-2">
          <Chip
            label={t('teams.allTypes')}
            onClick={() => setSelectedType('all')}
            variant="outlined"
            size="small"
            aria-pressed={selectedType === 'all'}
            sx={{
              cursor: 'pointer',
              fontSize: '0.72rem',
              height: 26,
              fontWeight: 600,
              ...(selectedType === 'all'
                ? { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent)' }
                : { color: 'var(--body)', borderColor: 'var(--line-2)' }),
              '&:hover': { backgroundColor: 'var(--hover)' },
            }}
          />
          {TEAM_FILTER_CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              icon={cat.icon}
              label={cat.label}
              onClick={() => setSelectedType(cat.value)}
              variant="outlined"
              size="small"
              aria-pressed={selectedType === cat.value}
              sx={{
                cursor: 'pointer',
                fontSize: '0.72rem',
                height: 26,
                fontWeight: selectedType === cat.value ? 600 : 400,
                ...(selectedType === cat.value
                  ? { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent)' }
                  : { color: 'var(--body)', borderColor: cat.borderColor }),
                '&:hover': { backgroundColor: 'var(--hover)' },
              }}
            />
          ))}
        </div>

        {/* Compteur d'équipes */}
        <div className="flex items-center gap-2">
          <Divider sx={{ flex: 1 }} />
          <span className="cn-text-caption text-muted-foreground text-[0.75rem]">
            {filteredTeams.length} {filteredTeams.length > 1 ? t('teams.teams') : t('teams.team')} {t('teams.available')}
          </span>
        </div>
      </div>

      {/* ─── Liste des équipes ─── */}
      {filteredTeams.length === 0 ? (
        <EmptyState
          icon={<Groups />}
          title={t('teams.noTeamFound')}
          description={t('teams.noTeamCreated')}
          action={canCreateTeams && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add size={16} strokeWidth={1.75} />}
              onClick={() => navigate('/teams/new')}
            >
              {t('teams.createFirst')}
            </Button>
          )}
        />
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
            <div className="flex justify-center mt-4">
              <PagePagination
                totalPages={totalPages}
                page={page}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
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
            <Visibility fontSize="small" size={18} strokeWidth={1.75} />
          </ListItemIcon>
          {t('teams.viewDetails')}
        </MenuItem>
        {canEditTeams && (
          <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <Edit fontSize="small" size={18} strokeWidth={1.75} />
            </ListItemIcon>
            {t('teams.modify')}
          </MenuItem>
        )}
        {canDeleteTeams && (
          <MenuItem onClick={handleDelete} sx={{ color: 'var(--err)', fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <span className="inline-flex text-[var(--err)]"><Delete fontSize="small" size={18} strokeWidth={1.75} /></span>
            </ListItemIcon>
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle sx={{ pb: 1 }}>{t('teams.confirmDelete')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <p className="cn-text-body2">
            {t('teams.confirmDeleteMessage', { name: selectedTeam?.name })}
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={handleCloseDeleteDialog} size="small">{t('teams.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            {t('teams.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TeamsList;
