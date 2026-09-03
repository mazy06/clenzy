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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui';
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
import { TEAM_TYPE_OPTIONS, type TeamTypeValue } from '../../types/teamTypes';
import { useTeamsList } from './useTeamsList';
import PagePagination from '../../components/PagePagination';
import { useScreenSearch } from '../../components/ScreenChrome';
import StatusChip from '../../components/StatusChip';
import compactHeaderActions from '../../components/compactHeaderActions';

// Catégories de filtrage. Valeurs, libellés et teintes viennent de la source
// UNIQUE `TEAM_TYPE_OPTIONS` : cette liste les redéfinissait, et la carte
// d'équipe interrogeait de son côté le vocabulaire des INTERVENTIONS — d'où un
// « MAINTENANCE » brut et gris sur les cartes alors que le filtre affichait
// « Maintenance » en ambre. Seule l'icône reste locale : elle n'a de sens que
// dans une rangée de filtres, où elle aide au balayage.
const FILTER_ICONS: Record<TeamTypeValue, React.ReactElement> = {
  CLEANING: <AutoAwesome size={16} strokeWidth={1.75} />,
  MAINTENANCE: <Build size={16} strokeWidth={1.75} />,
  OTHER: <Category size={16} strokeWidth={1.75} />,
};

const TEAM_FILTER_CATEGORIES = TEAM_TYPE_OPTIONS.map((option) => ({
  ...option,
  icon: FILTER_ICONS[option.value],
  borderColor: option.token,
}));

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
  useScreenSearch(searchTerm, setSearchTerm, t('teams.searchPlaceholder', 'Rechercher une équipe…'));

  // Radix ferme le menu de lui-meme apres chaque selection. Sans ce drapeau, la
  // fermeture rappellerait handleMenuClose, qui remet selectedTeam a null — or
  // la modale de suppression en a besoin juste apres le clic sur « Supprimer ».
  const selectionEnCours = React.useRef(false);
  const surSelection = (action: () => void) => {
    selectionEnCours.current = true;
    action();
  };

  // Le declencheur reel du menu vit dans TeamCard, hors de cet arbre : on
  // reporte sa position d'ecran sur une ancre invisible pour que Radix ait un
  // point d'ancrage. Le menu etant modal, la page ne defile pas tant qu'il est
  // ouvert, donc la position mesuree reste valide.
  const anchorRect = anchorEl?.getBoundingClientRect();
  // Memorise pour rendre le focus au bouton d'options a la fermeture : Radix le
  // rendrait a l'ancre invisible, qui n'est pas focalisable.
  const dernierDeclencheur = React.useRef<HTMLElement | null>(null);
  if (anchorEl) dernierDeclencheur.current = anchorEl;

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
      {embedded && actionsContainer && actionButtons && createPortal(compactHeaderActions(actionButtons), actionsContainer)}

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
            tone="accent"
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
                tone="accent"
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
          <span className="text-xs text-muted-foreground">
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
      <DropdownMenu
        open={Boolean(anchorEl)}
        onOpenChange={(next) => {
          if (next) return;
          if (selectionEnCours.current) {
            selectionEnCours.current = false;
            return;
          }
          handleMenuClose();
        }}
      >
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="fixed pointer-events-none"
            style={anchorRect
              ? { top: anchorRect.top, left: anchorRect.left, width: anchorRect.width, height: anchorRect.height }
              : { top: 0, left: 0, width: 0, height: 0 }}
          />
        </DropdownMenuTrigger>
        {/* Le contenu du kit calque sa largeur sur celle du declencheur : notre
            ancre etant reduite au bouton d'options, on la relache ici. */}
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-[11rem] text-[0.85rem]"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            dernierDeclencheur.current?.focus();
          }}
        >
          <DropdownMenuItem onSelect={() => surSelection(handleViewDetails)}>
            <Visibility size={18} strokeWidth={1.75} />
            {t('teams.viewDetails')}
          </DropdownMenuItem>
          {canEditTeams && (
            <DropdownMenuItem onSelect={() => surSelection(handleEdit)}>
              <Edit size={18} strokeWidth={1.75} />
              {t('teams.modify')}
            </DropdownMenuItem>
          )}
          {canDeleteTeams && (
            <DropdownMenuItem variant="destructive" onSelect={() => surSelection(handleDelete)}>
              <Delete size={18} strokeWidth={1.75} />
              Supprimer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={(next) => { if (!next) handleCloseDeleteDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
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
