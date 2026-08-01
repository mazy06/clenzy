import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  Card,
  CardContent,
  Skeleton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui';
import { Field, FieldLabel, Input } from '../../components/ui';
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

  const handleCreate = () => {
    setFormMode('create');
    setFormData({ name: '', type: 'INDIVIDUAL' });
    setFormDialogOpen(true);
  };

  // Exposer les actions au parent (UsersAndOrganizations)
  useImperativeHandle(ref, () => ({
    create: handleCreate,
  }));

  // Le menu contextuel est desormais monte DANS chaque carte (DropdownMenu du
  // kit, plus d'anchorEl global) : l'organisation ciblee est passee en argument
  // au lieu d'etre lue dans un state pose au clic du declencheur.
  const handleEdit = (org: OrganizationDto) => {
    setSelectedOrg(org);
    setFormMode('edit');
    setFormData({ name: org.name, type: org.type });
    setFormDialogOpen(true);
  };

  const handleDelete = (org: OrganizationDto) => {
    setSelectedOrg(org);
    setDeleteDialogOpen(true);
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
      <div className="grid grid-cols-12 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={i}>
            <Skeleton className="h-[170px] rounded-[14px]" />
          </div>
        ))}
      </div>
    );
  }

  const actionButtons = isAdmin() ? (
    <Button size="sm" onClick={handleCreate}>
      <Add size={18} strokeWidth={1.75} />
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
    <div>
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
      <div className="mb-3">
        {/* Les 5 tuiles se partagent la ligne a parts egales des 900px (ancien
            `<Grid item md>` sans taille) : `flex-1` n'a aucun effet sur un enfant
            de `display: grid`, d'ou le passage du conteneur en flex a ce palier. */}
        <div className="grid grid-cols-12 gap-3 min-[900px]:flex">
          <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:flex-1">
            <StatTile
              icon={<CorporateFare />}
              label="Total organisations"
              value={organizations.length}
              color="#6B8A9A"
            />
          </div>
          {orgTypes.map((typeInfo) => {
            const TypeIcon = typeInfo.Icon;
            return (
              <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:flex-1" key={typeInfo.value}>
                <StatTile
                  icon={<TypeIcon />}
                  label={typeInfo.label}
                  value={organizations.filter(o => o.type === typeInfo.value).length}
                  color={typeInfo.hex}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtres : portales dans le PageHeader parent, sinon inline en standalone */}
      {filtersContainer
        ? createPortal(filtersBar, filtersContainer)
        : !embedded && <div className="mb-3">{filtersBar}</div>}

      {/* Liste des organisations */}
      <div className="grid grid-cols-12 gap-3">
        {filteredOrgs.length === 0 ? (
          <div className="col-span-12">
            <EmptyState
              icon={<CorporateFare />}
              title={organizations.length === 0 ? 'Aucune organisation' : 'Aucun résultat'}
              description={
                organizations.length === 0
                  ? 'Créez la première organisation avec le bouton « Nouvelle organisation ».'
                  : 'Aucune organisation ne correspond aux filtres sélectionnés.'
              }
            />
          </div>
        ) : (
          filteredOrgs.map((org) => {
            const typeInfo = getTypeInfo(org.type);
            const typeColor = typeInfo.hex;
            const TypeIcon = typeInfo.Icon;
            return (
              <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4 min-[1200px]:col-span-3" key={org.id}>
                {/* Carte hairline r14 (thème global) — hover lift + shadow-card.
                    Le filet de la carte du kit est un `ring`, d'ou hover:ring-… la
                    ou le sx MUI teintait `borderColor`. */}
                <Card className="h-full gap-0 py-0 transition-[box-shadow,transform,--tw-ring-color] duration-150 hover:ring-[var(--line-2)] hover:shadow-[var(--shadow-card)] hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <CardContent className="grow p-[10.5px] pb-[7.5px]">
                    {/* Header — badge icône fond soft (pattern .mg-avt) */}
                    <div className="flex justify-between items-start mb-2 gap-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-[38px] h-[38px] rounded-[10px] inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `${typeColor}1F`, color: typeColor }}>
                          <TypeIcon size={18} strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="cn-text-body1 font-semibold text-[0.9rem] leading-[1.25] text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={org.name}>
                            {org.name}
                          </p>
                          <p className="cn-text-body1 text-muted-foreground text-[0.7rem] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap block tabular-nums">
                            {org.slug}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <span className="inline-flex ms-[1.5px]">
                            <Button variant="ghost" size="icon-sm" aria-label="Options" className="text-[var(--muted)]">
                              <MoreVert size={16} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-auto min-w-[180px]">
                          <DropdownMenuItem onClick={() => setMembersDialogOrg(org)}>
                            <People size={18} strokeWidth={1.75} />
                            Voir les membres
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(org)}>
                            <Edit size={18} strokeWidth={1.75} />
                            Modifier
                          </DropdownMenuItem>
                          {isAdmin() && (
                            <DropdownMenuItem variant="destructive" onClick={() => handleDelete(org)}>
                              <Delete size={18} strokeWidth={1.75} />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Type et membres — chips -soft (pilule/typo via thème global MuiChip) */}
                    <div className="flex gap-0.5 mb-2 flex-wrap">
                      <StatusChip tokens={{ color: typeColor, bg: `${typeColor}18` }} label={typeInfo.label} icon={<TypeIcon size={11} strokeWidth={2} />} />
                      <StatusChip
                        tokens={{ color: MEMBER_CHIP_COLOR, bg: `${MEMBER_CHIP_COLOR}18` }}
                        icon={<People size={11} strokeWidth={2} />}
                        label={`${org.memberCount} membre${org.memberCount !== 1 ? 's' : ''}`}
                        onClick={() => setMembersDialogOrg(org)}
                        className="tabular-nums"
                      />
                    </div>

                    {/* Date de creation */}
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex text-muted-foreground shrink-0">
                        <Person size={13} strokeWidth={1.75} />
                      </div>
                      <p className="cn-text-body1 text-[0.72rem] text-muted-foreground tabular-nums">
                        Creee le {formatDate(org.createdAt)}
                      </p>
                    </div>
                  </CardContent>

                  {/* Actions — simple rangee et non CardFooter du kit : ce dernier
                      pose un fond `muted` + filet superieur que la carte MUI
                      d'origine n'avait pas. */}
                  <div className="flex items-center gap-[4.5px] px-[10.5px] pb-[9px]">
                    {/* Deux actions de carte a poids egal : aucune ne domine, donc
                        outline pour les deux plutot qu'une principale arbitraire. */}
                    <Button variant="outline" size="sm" className="flex-1 shrink" onClick={() => setMembersDialogOrg(org)}>
                      <Visibility size={14} strokeWidth={1.75} />
                      Membres
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 shrink"
                      onClick={() => handleEdit(org)}
                    >
                      <Edit size={14} strokeWidth={1.75} />
                      Modifier
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })
        )}
      </div>

      {/* Dialog de creation/modification */}
      <Dialog
        open={formDialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setFormDialogOpen(false);
            setSelectedOrg(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? 'Nouvelle organisation' : 'Modifier l\'organisation'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-12 gap-3 mt-[3px]">
            <div className="col-span-12">
              <Field>
                <FieldLabel htmlFor="org-form-name">Nom de l'organisation *</FieldLabel>
                <Input
                  id="org-form-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  autoFocus
                />
              </Field>
            </div>
            <div className="col-span-12">
              {/* Select riche (pas NativeSelect) : chaque option porte une icone
                  coloree par type d'organisation, qu'une <option> ne rend pas. */}
              <Field>
                <FieldLabel htmlFor="org-form-type">Type</FieldLabel>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger id="org-form-type" className="w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgTypes.map((t) => {
                      const TypeIcon = t.Icon;
                      return (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-flex" style={{ color: t.hex }}>
                              <TypeIcon size={16} strokeWidth={1.75} />
                            </span>
                            {t.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormDialogOpen(false);
                setSelectedOrg(null);
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleFormSave}
              disabled={saving || !formData.name.trim()}
            >
              {saving ? 'Sauvegarde...' : formMode === 'create' ? 'Creer' : 'Sauvegarder'}
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
          <p className="cn-text-body2">
            Etes-vous sur de vouloir supprimer l'organisation "{selectedOrg?.name}" ?
          </p>
          {selectedOrg && selectedOrg.memberCount > 0 && (
            <Alert variant="warning" className="mt-1.5">
              <TriangleAlert />
              <AlertDescription>Cette organisation contient {selectedOrg.memberCount}membre(s).
              Vous devez retirer tous les membres avant de pouvoir la supprimer.</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog des membres de l'organisation */}
      <Dialog
        open={!!membersDialogOrg}
        onOpenChange={(next) => {
          if (!next) {
            setMembersDialogOrg(null);
            // Rafraichir la liste des orgas pour mettre a jour le memberCount
            loadOrganizations();
          }
        }}
      >
        <DialogContent className="sm:max-w-[900px]">
          {membersDialogOrg && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-1.5">
                  <span className="inline-flex text-[var(--accent)]"><People size={20} strokeWidth={1.75} /></span>
                  <span className="flex flex-col">
                    <span className="text-[1rem] font-semibold">
                      Membres de {membersDialogOrg.name}
                    </span>
                    <span className="flex gap-0.5 mt-0.5">
                      {(() => { const ti = getTypeInfo(membersDialogOrg.type); const c = ti.hex; return (
                        <StatusChip tokens={{ color: c, bg: `${c}18` }} label={ti.label} />
                      ); })()}
                      <StatusChip tokens={{ color: MEMBER_CHIP_COLOR, bg: `${MEMBER_CHIP_COLOR}18` }} label={`${membersDialogOrg.memberCount} membre${membersDialogOrg.memberCount !== 1 ? 's' : ''}`} className="tabular-nums" />
                    </span>
                  </span>
                </DialogTitle>
              </DialogHeader>
              <MembersList
                organizationId={membersDialogOrg.id}
                refreshTrigger={membersRefresh}
                onMemberChanged={() => setMembersRefresh(prev => prev + 1)}
              />
              <DialogFooter>
                {/* Seule action du pied de cette modale : outline plutot que ghost,
                    sinon le pied n'offre plus aucune cible visible. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMembersDialogOrg(null);
                    loadOrganizations();
                  }}
                >
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

OrganizationsList.displayName = 'OrganizationsList';

export default OrganizationsList;
