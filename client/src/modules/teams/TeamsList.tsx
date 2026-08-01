import React from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '../../components/ui';
import { createPortal } from 'react-dom';
// Menu laisse en MUI : son ancre (`anchorEl`) est produite par `useTeamsList`
// et par `TeamCard` — deux fichiers hors lot. Un DropdownMenu Radix exige que
// le declencheur vive dans l'arbre du menu, ce qui n'est pas le cas ici.
import { Menu, MenuItem, ListItemIcon } from '@mui/material';
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
import StatusChip from '../../components/StatusChip';

// Teinte d'une puce de filtre choisie — identique pour toutes les catégories,
// seule la bordure au repos distingue la catégorie.
const FILTER_SELECTED_TOKENS = { color: 'var(--accent)', bg: 'var(--accent-soft)' };

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
    <Button size="sm" onClick={() => navigate('/teams/new')} title={t('teams.create')}>
      <Add />
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
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ─── Barre de recherche + filtres ─── */}
      <div className="mb-3">

        {/* Filtres par catégorie de service */}
        <div className="flex gap-1 flex-wrap mb-2">
          <StatusChip
            label={t('teams.allTypes')}
            outlined
            selected={selectedType === 'all'}
            pressed={selectedType === 'all'}
            onClick={() => setSelectedType('all')}
            tokens={FILTER_SELECTED_TOKENS}
            className="h-[26px] border-solid text-[0.72rem] font-semibold"
          />
          {TEAM_FILTER_CATEGORIES.map((cat) => {
            const actif = selectedType === cat.value;
            return (
              <StatusChip
                key={cat.value}
                icon={cat.icon}
                label={cat.label}
                outlined
                selected={actif}
                pressed={actif}
                onClick={() => setSelectedType(cat.value)}
                tokens={FILTER_SELECTED_TOKENS}
                // Au repos la bordure porte l'identite de la categorie : couleur
                // connue a l'execution seulement, donc style inline.
                sx={actif ? undefined : { borderColor: cat.borderColor }}
                className={`h-[26px] border-solid text-[0.72rem] ${actif ? 'font-semibold' : 'font-normal'}`}
              />
            );
          })}
        </div>

        {/* Compteur d'équipes */}
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
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
            <Button variant="outline" size="sm" onClick={() => navigate('/teams/new')}>
              <Add size={16} strokeWidth={1.75} />
              {t('teams.createFirst')}
            </Button>
          )}
        />
      ) : (
        <>
          <div className="grid grid-cols-12 gap-3">
            {paginatedTeams.map((team) => (
              <div className="col-span-12 min-[900px]:col-span-6 min-[1200px]:col-span-4" key={team.id}>
                <TeamCard
                  team={team}
                  onMenuOpen={handleMenuOpen}
                  activeInterventionsCount={teamWorkloadCounts[team.name] || 0}
                  canEdit={canEditTeams}
                />
              </div>
            ))}
          </div>

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
      <Dialog open={deleteDialogOpen} onOpenChange={(next) => { if (!next) handleCloseDeleteDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="cn-text-body2">
            {t('teams.confirmDeleteMessage', { name: selectedTeam?.name })}
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={handleCloseDeleteDialog}>{t('teams.cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              {t('teams.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsList;
