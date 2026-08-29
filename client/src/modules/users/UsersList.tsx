import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import StatusChip, { STATUS_TONES, type StatusTone } from '../../components/StatusChip';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input } from '../../components/ui';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  MoreVert,
  Edit,
  Delete,
  Person,
  Visibility,
  Email,
  Phone,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
  Add,
  Sync,
  ManageAccounts,
  Euro,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import HousekeeperRatesDialog from './components/HousekeeperRatesDialog';
import { useNotification } from '../../hooks/useNotification';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import ExportButton from '../../components/ExportButton';
import StatTile from '../../components/baitly/StatTile';
import EmptyState from '../../components/EmptyState';
import { usersApi, type UserFormData } from '../../services/api/usersApi';
import { userAvatarSrc } from '../../services/api/usersApi';
import { extractApiList } from '../../types';
import apiClient from '../../services/apiClient';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import type { ExportColumn } from '../../utils/exportUtils';
import type { ChipColor } from '../../types';
import type { LucideIcon } from 'lucide-react';
import compactHeaderActions from '../../components/compactHeaderActions';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  // Rôle du membre dans son organisation (OrgMemberRole, ex: MANAGER). Affiché en
  // priorité dans l'Annuaire pour les membres d'org (le rôle plateforme d'un
  // Manager/Admin d'org est HOST = "Propriétaire", ce qui prêtait à confusion).
  organizationRole?: string;
  status: string;
  createdAt: string;
}

// `tone` alimente les pastilles ET la teinte de l'avatar, via le couple
// `-ink` / `-soft` de la primitive StatusChip (seul couple conforme AA) ;
// `iconClass` habille l'icone decorative de la liste deroulante, ou la teinte
// vive est admise. Baitly UI n'expose pas de sixieme teinte : le violet et le
// gris chaud de l'ancienne palette Clenzy retombent respectivement sur
// `warning` et `neutral`, ce qui garde les roles distincts deux a deux.
const userRoles: Array<{ value: string; label: string; Icon: LucideIcon; color: ChipColor; tone: StatusTone; iconClass: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', Icon: AdminPanelSettings, color: 'error', tone: 'err', iconClass: 'text-destructive' },
  { value: 'SUPER_MANAGER', label: 'Super Manager', Icon: SupervisorAccount, color: 'secondary', tone: 'warn', iconClass: 'text-warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', Icon: SupervisorAccount, color: 'info', tone: 'info', iconClass: 'text-info' },
  { value: 'TECHNICIAN', label: 'Technicien', Icon: Build, color: 'primary', tone: 'accent', iconClass: 'text-primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', Icon: CleaningServices, color: 'default', tone: 'neutral', iconClass: 'text-muted-foreground' },
  { value: 'LAUNDRY', label: 'Blanchisserie', Icon: CleaningServices, color: 'default', tone: 'neutral', iconClass: 'text-muted-foreground' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Extérieur', Icon: Build, color: 'primary', tone: 'accent', iconClass: 'text-primary' },
  { value: 'HOST', label: 'Propriétaire', Icon: Home, color: 'success', tone: 'ok', iconClass: 'text-success' },
];

// Libellés/visuels des rôles d'ORGANISATION (OrgMemberRole), affichés dans
// l'Annuaire pour les membres d'org. Distinct de userRoles (rôles plateforme) :
// un Manager/Admin d'org a le rôle plateforme HOST, mais on veut afficher son rôle réel.
const orgRoleDisplay: Record<string, { label: string; Icon: LucideIcon; color: ChipColor; tone: StatusTone }> = {
  OWNER: { label: 'Propriétaire', Icon: Home, color: 'success', tone: 'ok' },
  ADMIN: { label: 'Administrateur', Icon: AdminPanelSettings, color: 'error', tone: 'err' },
  MANAGER: { label: 'Manager', Icon: SupervisorAccount, color: 'warning', tone: 'warn' },
  SUPERVISOR: { label: 'Superviseur', Icon: SupervisorAccount, color: 'info', tone: 'info' },
  HOUSEKEEPER: { label: 'Agent de ménage', Icon: CleaningServices, color: 'default', tone: 'neutral' },
  TECHNICIAN: { label: 'Technicien', Icon: Build, color: 'primary', tone: 'accent' },
  LAUNDRY: { label: 'Blanchisserie', Icon: CleaningServices, color: 'default', tone: 'neutral' },
  EXTERIOR_TECH: { label: 'Tech. Extérieur', Icon: Build, color: 'primary', tone: 'accent' },
  HOST: { label: 'Hôte', Icon: Home, color: 'success', tone: 'ok' },
  MEMBER: { label: 'Membre', Icon: Home, color: 'default', tone: 'neutral' },
};

// Statuts utilisateur → ton de la primitive StatusChip.
const USER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'ok',
  PENDING_VERIFICATION: 'warn',
  SUSPENDED: 'warn',
  INACTIVE: 'neutral',
  BLOCKED: 'err',
  DELETED: 'err',
};

// Utilisation des enums partagés pour les statuts utilisateur
const userStatuses = USER_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  color: option.color
}));

const getRoleInfo = (role: string) => {
  return userRoles.find(r => r.value === role) || userRoles[0];
};

// Rôles affichés dans l'Annuaire : on montre LES DEUX — le rôle plateforme
// (User.role) ET le rôle d'org (organizationRole) — pour lever l'ambiguïté.
const getOrgRoleInfo = (user: User) =>
  user.organizationRole && orgRoleDisplay[user.organizationRole]
    ? orgRoleDisplay[user.organizationRole]
    : null;

const getStatusInfo = (status: string) => {
  return userStatuses.find(s => s.value === status) || userStatuses[0];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Données mockées supprimées - utilisation de l'API uniquement

export interface UsersListHandle {
  sync: () => void;
  syncing: boolean;
  filteredUsers: User[];
  exportColumns: ExportColumn[];
}

interface UsersListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

const UsersList = forwardRef<UsersListHandle, UsersListProps>(({ embedded = false, actionsContainer, filtersContainer }, ref) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // Tarifs & score d'un prestataire (staff plateforme) — MM-4A #6.
  const [ratesUser, setRatesUser] = useState<{ id: number; name: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<UserFormData>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const navigate = useNavigate();
  const { user, hasPermissionAsync, hasAnyRole } = useAuth();
  const { notify } = useNotification();

  // Vérifier la permission de gestion des utilisateurs
  const [canManageUsers, setCanManageUsers] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canManageUsersPermission = await hasPermissionAsync('users:manage');
      setCanManageUsers(canManageUsersPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;

  // Charger les utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await usersApi.getAll();
        const usersList = extractApiList<User>(data);
        setUsers(usersList);
      } catch (err) {
        // En cas d'erreur, tableau vide
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Le menu contextuel est desormais monte DANS chaque carte (DropdownMenu du
  // kit, ancre sur son declencheur) : plus d'anchorEl, chaque action recoit
  // directement la ligne concernee.
  const openEdit = (u: User) => {
    setSelectedUser(u);
    setEditFormData({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
      status: u.status,
    });
    setEditDialogOpen(true);
  };

  const openDelete = (u: User) => {
    setSelectedUser(u);
    setDeleteDialogOpen(true);
  };

  const handleSyncUsers = async () => {
    setSyncing(true);
    try {
      await apiClient.post('/sync/force-sync-all-to-keycloak');
      const data = await usersApi.getAll();
      const usersList = extractApiList<User>(data);
      setUsers(usersList);
    } catch (err) {
    } finally {
      setSyncing(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedUser || !editFormData.firstName || !editFormData.lastName || !editFormData.email) {
      notify.warning('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, editFormData);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, ...editFormData } : u
      ));
      setEditDialogOpen(false);
      setEditFormData({});
      setSelectedUser(null);
      notify.success('Utilisateur mis à jour avec succès');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour de l\'utilisateur');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedUser) {
      try {
        await usersApi.delete(selectedUser.id);
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        setDeleteDialogOpen(false);
        notify.success('Utilisateur supprimé avec succès');
      } catch (err: unknown) {
        notify.error(err instanceof Error ? err.message : 'Erreur lors de la suppression de l\'utilisateur');
        setDeleteDialogOpen(false);
      }
    } else {
      setDeleteDialogOpen(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = searchTerm === '' ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || u.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const exportColumns: ExportColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Téléphone' },
    { key: 'role', label: 'Rôle', formatter: (v: string) => getRoleInfo(v).label },
    { key: 'status', label: 'Statut', formatter: (v: string) => getStatusInfo(v).label },
    { key: 'createdAt', label: 'Date de création', formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
  ];

  // Exposer les actions au parent (UsersAndOrganizations)
  useImperativeHandle(ref, () => ({
    sync: handleSyncUsers,
    syncing,
    filteredUsers,
    exportColumns,
  }));

  // Si pas de permission, afficher un message informatif
  if (!user || !canManageUsers) {
    return (
      <div className="p-3">
        <Alert variant="info" className="p-3 py-1.5">
          <Info />
          {/* `m-0` reprend ce que portait `cn-text-*` : sans preflight Tailwind,
              un <h6>/<p> natif recupere sinon les marges du navigateur. */}
          <AlertDescription><h6 className="m-0 mb-1.5 text-sm font-medium">
            Accès non autorisé
          </h6><p className="m-0 text-sm">
            Vous n'avez pas les permissions nécessaires pour gérer les utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p></AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={i}>
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const actionButtons = (
    <div className="flex gap-2">
      <ExportButton
        data={filteredUsers}
        columns={exportColumns}
        fileName="utilisateurs"
      />
      {/* Barre d'actions du header : « Nouvel utilisateur » est l'action principale,
          la synchro reste secondaire a poids egal -> outline. */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncUsers}
        disabled={syncing}
        title="Synchroniser"
      >
        <Sync strokeWidth={1.75} />
        {syncing ? 'Sync...' : 'Synchroniser'}
      </Button>
      <Button
        size="sm"
        onClick={() => navigate('/users/new')}
        title="Nouvel utilisateur"
      >
        <Add strokeWidth={1.75} />
        Nouvel utilisateur
      </Button>
    </div>
  );

  const filtersBar = (
    <FilterSearchBar
      bare={Boolean(filtersContainer)}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Rechercher un utilisateur..."
      filters={{
        type: {
          value: selectedRole,
          options: [
            { value: 'all', label: 'Tous les rôles' },
            ...userRoles.map(role => ({ value: role.value, label: role.label }))
          ],
          onChange: setSelectedRole,
          label: "Rôle"
        },
        status: {
          value: selectedStatus,
          options: [
            { value: 'all', label: 'Tous les statuts' },
            ...userStatuses.map(status => ({ value: status.value, label: status.label }))
          ],
          onChange: setSelectedStatus,
          label: "Statut"
        }
      }}
      counter={{
        label: "utilisateur",
        count: filteredUsers.length,
        singular: "",
        plural: "s"
      }}
    />
  );

  return (
    <div>
      {/* Portal des actions dans le header parent */}
      {embedded && actionsContainer && createPortal(compactHeaderActions(actionButtons), actionsContainer)}

      {/* Header standalone (hors Annuaire multi-tabs) */}
      {!embedded && (
        <PageHeader
          title="Utilisateurs"
          subtitle="Comptes utilisateurs de la plateforme : rôles, permissions, activation et réinitialisation d'accès."
          iconBadge={<ManageAccounts />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      {/* Statistiques — StatTile (carte plate hairline, valeur display) */}
      <div className="mb-3">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6 min-[900px]:col-span-3">
            <StatTile
              icon={<Person />}
              label="Total utilisateurs"
              value={users.length}
              iconClassName="text-primary"
            />
          </div>
          <div className="col-span-6 min-[900px]:col-span-3">
            <StatTile
              icon={<ManageAccounts />}
              label="Utilisateurs actifs"
              value={users.filter(u => u.status === 'ACTIVE').length}
              iconClassName="text-success"
            />
          </div>
          <div className="col-span-6 min-[900px]:col-span-3">
            <StatTile
              icon={<AdminPanelSettings />}
              label="Administrateurs"
              value={users.filter(u => ['SUPER_ADMIN'].includes(u.role)).length}
              iconClassName="text-destructive"
            />
          </div>
          <div className="col-span-6 min-[900px]:col-span-3">
            <StatTile
              icon={<Build />}
              label="Personnel opérationnel"
              value={users.filter(u => ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'].includes(u.role)).length}
              iconClassName="text-info"
            />
          </div>
        </div>
      </div>

      {/* Filtres : portales dans le PageHeader parent, sinon inline en standalone */}
      {filtersContainer
        ? createPortal(filtersBar, filtersContainer)
        : !embedded && <div className="mb-3">{filtersBar}</div>}

      {/* Liste des utilisateurs */}
      <div className="grid grid-cols-12 gap-3">
        {filteredUsers.length === 0 ? (
          <div className="col-span-12">
            <EmptyState
              icon={<Person />}
              title={users.length === 0 ? 'Aucun utilisateur' : 'Aucun résultat'}
              description={
                users.length === 0
                  ? 'Créez le premier compte avec le bouton « Nouvel utilisateur ».'
                  : 'Aucun utilisateur ne correspond aux filtres sélectionnés.'
              }
            />
          </div>
        ) : (
          filteredUsers.map((user) => {
            const platformRole = getRoleInfo(user.role);
            const orgRole = getOrgRoleInfo(user);
            // Eviter le doublon si le role d'org a le meme libelle que le role plateforme.
            const showOrgRole = orgRole && orgRole.label !== platformRole.label;
            const s = getStatusInfo(user.status);
            // Couple `-soft` / `-ink` du ton du role : teinte calculee a
            // l'execution, donc valeur CSS et non classe Tailwind.
            const roleTokens = STATUS_TONES[platformRole.tone];
            const statusTone = USER_STATUS_TONE[user.status] ?? 'neutral';
            const PlatformIcon = platformRole.Icon;
            const OrgIcon = orgRole?.Icon;
            return (
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={user.id}>
              {/* Carte hairline (rayon du kit) — hover lift + ombre discrete */}
              <Card className="h-full gap-2 [--card-spacing:10.5px] transition-[box-shadow,transform,--tw-ring-color] duration-150 ease-out-quart hover:-translate-y-px hover:shadow-sm hover:ring-primary/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <CardContent className="flex-1">
                  {/* En-tête avec avatar (initiales display) et menu */}
                  <div className="flex justify-between items-start mb-2 gap-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="size-[38px] shrink-0 rounded-[10px] after:rounded-[10px]">
                        <AvatarImage src={userAvatarSrc(user)} alt="" className="rounded-[10px]" />
                        <AvatarFallback
                          className="rounded-[10px] font-[family-name:var(--font-display)] text-[0.8125rem] font-semibold tracking-[0.02em]"
                          style={{ backgroundColor: roleTokens.bg, color: roleTokens.color }}
                        >
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {/* `m-0` : sans preflight Tailwind, un <p> natif reprend les
                            marges UA que `cn-text-*` neutralisait. */}
                        <p className="m-0 font-semibold text-[0.9rem] leading-[1.25] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="m-0 text-muted-foreground text-[0.7rem] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap block">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {/* Le span porte la ref exigee par Radix : Button du kit est
                            un composant fonction qui ne la transmet pas (React 18). */}
                        <span className="inline-flex ms-[1.5px]">
                          <Button variant="ghost" size="icon-sm" aria-label="Options" className="text-muted-foreground">
                            <MoreVert size={16} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto min-w-[180px]">
                        <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                          <Visibility size={18} strokeWidth={1.75} />
                          Voir détails
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(user)}>
                          <Edit size={18} strokeWidth={1.75} />
                          Modifier
                        </DropdownMenuItem>
                        {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER'])
                          && ['HOUSEKEEPER', 'TECHNICIAN'].includes(user.role) && (
                          <DropdownMenuItem
                            onClick={() => setRatesUser({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim() })}
                          >
                            <Euro size={18} strokeWidth={1.75} />
                            Tarifs & score
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => openDelete(user)}>
                          <Delete size={18} strokeWidth={1.75} />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Rôles (plateforme + org) et statut — chips -soft */}
                  <div className="flex gap-0.5 mb-2 flex-wrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* TooltipTrigger pose une ref sur son enfant, que StatusChip ne transmet
                            pas (React 18, composant fonction) : sans ce span, rien ne s'ancre. */}
                        <span className="inline-flex">
                          <StatusChip tone={platformRole.tone} label={platformRole.label} icon={<PlatformIcon size={11} strokeWidth={2} />} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Rôle sur la plateforme</TooltipContent>
                    </Tooltip>
                    {showOrgRole && orgRole && OrgIcon && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* Meme raison que ci-dessus : le span porte la ref. */}
                          <span className="inline-flex">
                            {/* Liseré teinté : `border-solid` est indispensable, le
                                gabarit de la primitive pose `border-none`. Encre
                                `-ink` du ton, filet tire de la meme encre. */}
                            <StatusChip
                              tokens={{ color: STATUS_TONES[orgRole.tone].color, bg: 'transparent' }}
                              label={orgRole.label}
                              icon={<OrgIcon size={11} strokeWidth={2} />}
                              className="border border-solid"
                              sx={{ borderColor: `color-mix(in srgb, ${STATUS_TONES[orgRole.tone].color} 40%, transparent)` }}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Rôle dans l'organisation</TooltipContent>
                      </Tooltip>
                    )}
                    <StatusChip tone={statusTone} label={s.label} />
                  </div>

                  {/* Informations supplémentaires */}
                  <div className="flex flex-col gap-1">
                    {user.phoneNumber && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="inline-flex text-muted-foreground shrink-0">
                          <Phone size={13} strokeWidth={1.75} />
                        </div>
                        <p className="m-0 text-[0.72rem] text-muted-foreground tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">
                          {user.phoneNumber}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="inline-flex text-muted-foreground shrink-0">
                        <Email size={13} strokeWidth={1.75} />
                      </div>
                      <p className="m-0 text-[0.72rem] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="inline-flex text-muted-foreground shrink-0">
                        <Person size={13} strokeWidth={1.75} />
                      </div>
                      <p className="m-0 text-[0.72rem] text-muted-foreground tabular-nums">
                        Créé le {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>

                {/* Actions */}
                <div className="px-[10.5px]">
                  {/* Action de pied de carte, repetee sur chaque fiche : poids secondaire. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/users/${user.id}`)}
                    className="w-full"
                  >
                    <Visibility strokeWidth={1.75} />
                    Voir détails
                  </Button>
                </div>
              </Card>
            </div>
            );
          })
        )}
      </div>

      {/* Tarifs & score d'un prestataire (staff plateforme) */}
      <HousekeeperRatesDialog
        userId={ratesUser?.id ?? null}
        userName={ratesUser?.name}
        onClose={() => setRatesUser(null)}
      />

      {/* Dialog de modification */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(next) => { if (!next) { setEditDialogOpen(false); setSelectedUser(null); } }}
      >
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 min-[900px]:col-span-6">
              <Field>
                <FieldLabel htmlFor="user-edit-first-name">Prénom *</FieldLabel>
                <Input
                  id="user-edit-first-name"
                  className="w-full"
                  required
                  value={editFormData.firstName || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </Field>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <Field>
                <FieldLabel htmlFor="user-edit-last-name">Nom *</FieldLabel>
                <Input
                  id="user-edit-last-name"
                  className="w-full"
                  required
                  value={editFormData.lastName || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <div className="col-span-12">
              <Field>
                <FieldLabel htmlFor="user-edit-email">Email *</FieldLabel>
                <Input
                  id="user-edit-email"
                  type="email"
                  className="w-full"
                  required
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </Field>
            </div>
            <div className="col-span-12">
              <Field>
                <FieldLabel htmlFor="user-edit-phone">Téléphone</FieldLabel>
                <Input
                  id="user-edit-phone"
                  className="w-full"
                  value={editFormData.phoneNumber || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                />
              </Field>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              {/* Liste riche (pastille de couleur par role) -> Select du kit et non
                  NativeSelect : une <option> native ne peut pas porter d'icone. */}
              <Field>
                <FieldLabel htmlFor="user-edit-role">Rôle</FieldLabel>
                <Select
                  value={editFormData.role || ''}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="user-edit-role" size="sm" className="w-full">
                    <SelectValue placeholder="Rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => {
                      const RoleIcon = role.Icon;
                      return (
                        <SelectItem key={role.value} value={role.value}>
                          <span className={`inline-flex ${role.iconClass}`}>
                            <RoleIcon size={16} strokeWidth={1.75} />
                          </span>
                          {role.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <Field>
                <FieldLabel htmlFor="user-edit-status">Statut</FieldLabel>
                <NativeSelect
                  id="user-edit-status"
                  className="w-full"
                  value={editFormData.status ?? ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                >
                  {userStatuses.map((status) => (
                    <NativeSelectOption key={status.value} value={status.value}>
                      {status.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setEditDialogOpen(false); setSelectedUser(null); }} variant="outline" size="sm">Annuler</Button>
            <Button
              onClick={handleEditSave}
              size="sm"
              disabled={saving || !editFormData.firstName || !editFormData.lastName || !editFormData.email}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={(next) => { if (!next) setDeleteDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="m-0 text-xs">
            Êtes-vous sûr de vouloir supprimer l'utilisateur "{selectedUser?.firstName} {selectedUser?.lastName}" ?
            Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button onClick={() => setDeleteDialogOpen(false)} variant="outline" size="sm">Annuler</Button>
            <Button onClick={confirmDelete} variant="destructive" size="sm">
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

UsersList.displayName = 'UsersList';

export default UsersList;
