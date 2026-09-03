import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, Button, Card } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Home, LocationOn } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi } from '../../services/api/teamsApi';
import { propertyTeamsApi } from '../../services/api/propertyTeamsApi';
import { portfoliosKeys } from '../../services/api/portfoliosApi';
import type {
  PortfolioClient,
  PortfolioProperty,
  PortfolioTeam,
  PortfolioUser,
} from './usePortfoliosPage';

/** Traduction, telle que le hook maison la fournit. */
type Translate = ReturnType<typeof useTranslation>['t'];

/** Une ville et tout ce qu'elle porte. */
interface CityGroup {
  city: string;
  properties: PortfolioProperty[];
  teams: PortfolioTeam[];
  /** Intervenants rattachés à la ville, toutes équipes confondues. */
  staff: PortfolioUser[];
  /** Ceux qu'aucune équipe de la ville ne contient — ce qui appelle une action. */
  unassigned: PortfolioUser[];
}

interface PortfolioByCityProps {
  clients: PortfolioClient[];
  properties: PortfolioProperty[];
  teams: PortfolioTeam[];
  users: PortfolioUser[];
  loading: boolean;
  onAssignProperties: () => void;
  onAssignStaff: () => void;
}

const SANS_VILLE = 'Sans ville';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** Libellé métier d'une équipe : le nom porte déjà la ville, pas besoin de la répéter. */
function teamTrade(team: PortfolioTeam): string {
  if (team.interventionType === 'CLEANING') return 'Ménage';
  if (team.interventionType === 'MAINTENANCE') return 'Maintenance';
  return team.name;
}


/**
 * Ce qu'on deplace : un intervenant, ou un logement.
 *
 * <p>Un meme conteneur porte les deux, et la cible lit ce type pour savoir
 * quoi faire du depot — plutot que de deviner a la forme de l'identifiant.</p>
 */
type DragPayload =
  | { kind: 'person'; userId: number; fromTeamId: number | null }
  | { kind: 'property'; propertyId: number };

/** Seul un SUPER_ADMIN peut affecter un logement (POST /property-teams). */
const PROPERTY_ASSIGN_ROLES = new Set(['SUPER_ADMIN']);


/**
 * Charge utile de `PUT /api/teams/{id}`, ou `null` si on ne peut pas la bâtir
 * sans risque.
 *
 * <p>Le contrat attend l'équipe ENTIÈRE, pas un delta : `TeamService.update`
 * écrit `name`, `description` et `interventionType` SANS garde. Un métier
 * absent qu'on remplacerait par une valeur par défaut convertirait
 * silencieusement une équipe de maintenance en équipe de ménage — on préfère
 * refuser le dépôt.</p>
 *
 * <p>`coverageZones` est en revanche gardé par un `!= null` côté serveur :
 * l'omettre laisse les zones intactes, donc la ville de l'équipe survit. C'est
 * ce qui permet de ne renvoyer que les membres.</p>
 */
function buildTeamPayload(
  team: PortfolioTeam,
  members: { userId: number; role: string }[],
) {
  if (!team.name || !team.interventionType) {
    return null;
  }
  return {
    name: team.name,
    description: team.description ?? '',
    interventionType: team.interventionType,
    members,
  };
}

/** Pastille d'intervenant deplacable au pointeur comme au clavier. */
const DraggablePerson: React.FC<{
  id: string;
  payload: DragPayload;
  label: string;
  tone?: 'default' | 'warn';
  disabled?: boolean;
}> = ({ id, payload, label, tone = 'default', disabled }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: payload,
    disabled,
  });
  return (
    <span
      ref={setNodeRef}
      // `attributes` porte role, tabIndex et les aria-* dont le capteur clavier
      // a besoin : sans eux le deplacement serait reserve a la souris.
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-0.5 pe-2.5 ps-0.5 text-xs',
        'transition-opacity duration-200',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
        tone === 'warn'
          ? 'border-warning bg-warning-soft text-warning-ink'
          : 'border-border bg-muted/40 text-foreground',
      )}
    >
      <Avatar className="size-[21px]">
        <AvatarFallback className="text-[0.55rem] font-bold">{initials(label)}</AvatarFallback>
      </Avatar>
      {label}
    </span>
  );
};


/** Ligne de logement, deplacable vers une equipe. */
const DraggableProperty: React.FC<{
  property: PortfolioProperty;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ property, disabled, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `property-${property.id}`,
    data: { kind: 'property', propertyId: property.id } satisfies DragPayload,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-2',
        'transition-opacity duration-200',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      {children}
    </div>
  );
};

/** Zone d'accueil : une equipe, ou le vivier « sans equipe ». */
const DropZone: React.FC<{
  id: string;
  accepts: DragPayload['kind'][];
  className?: string;
  children: React.ReactNode;
}> = ({ id, accepts, className, children }) => {
  const { isOver, setNodeRef, active } = useDroppable({ id, data: { accepts } });
  const dragged = active?.data.current as DragPayload | undefined;
  // On ne s'allume que pour ce qu'on sait recevoir : un survol qui s'illumine
  // puis refuse le depot est un mensonge visuel.
  const welcome = isOver && dragged != null && accepts.includes(dragged.kind);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        'transition-colors duration-200',
        welcome && 'border-primary bg-primary-soft',
      )}
    >
      {children}
    </div>
  );
};

/**
 * Le portefeuille, organisé par ville.
 *
 * <p>Les deux écrans précédents affichaient des listes parallèles — les équipes
 * d'un côté, les intervenants de l'autre — alors que leur sujet est la RELATION
 * entre les deux. On ne pouvait donc y répondre ni à « qui compose cette
 * équipe ? » (la carte annonçait « 6 membres » et s'arrêtait), ni à « dans
 * quelle équipe est cette personne ? », ni à « où manque-t-il du monde ? ».</p>
 *
 * <p>L'axe qui réconcilie tout est la VILLE : c'est par elle que le parc est
 * dispatché, que les équipes sont constituées et que les intervenants sont
 * rattachés. Une ville porte ses logements, ses équipes et ses gens.</p>
 *
 * <p>Le regroupement règle au passage la liste de cent-cinq intervenants, qui
 * dépassait largement le seuil au-delà duquel une liste doit être virtualisée :
 * on n'affiche jamais que les personnes d'une ville.</p>
 */
const PortfolioByCity: React.FC<PortfolioByCityProps> = ({
  clients,
  properties,
  teams,
  users,
  loading,
  onAssignProperties,
  onAssignStaff,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // L'affectation d'un logement est réservée aux SUPER_ADMIN côté serveur. On
  // désactive la poignée plutôt que d'offrir un dépôt qui finirait en 403.
  const canAssignProperty = useMemo(() => {
    if (!user) return false;
    if (user.platformRole && PROPERTY_ASSIGN_ROLES.has(user.platformRole)) return true;
    return user.roles?.some((role) => PROPERTY_ASSIGN_ROLES.has(role)) ?? false;
  }, [user]);

  const sensors = useSensors(
    // Sans distance d'activation, un simple clic sur une pastille lancerait un
    // déplacement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // L'API concatène DEUX sources d'intervenants : les rattachements de
  // portefeuille et les assignations directes au manager. Une même personne
  // figure donc dans les deux, et le total affiché valait presque le double du
  // réel — cinquante-et-un plus cinquante-quatre pour cinquante-quatre
  // personnes. On dédoublonne sur l'identifiant, en gardant la première
  // occurrence.
  const people = useMemo(() => {
    const seen = new Map<number, PortfolioUser>();
    users.forEach((user) => {
      if (!seen.has(user.id)) {
        seen.set(user.id, user);
      }
    });
    return [...seen.values()];
  }, [users]);

  const groups = useMemo<CityGroup[]>(() => {
    const byCity = new Map<string, CityGroup>();
    const ensure = (city: string): CityGroup => {
      let group = byCity.get(city);
      if (!group) {
        group = { city, properties: [], teams: [], staff: [], unassigned: [] };
        byCity.set(city, group);
      }
      return group;
    };

    properties.forEach((p) => ensure(p.city || SANS_VILLE).properties.push(p));
    teams.forEach((team) => ensure(team.city || SANS_VILLE).teams.push(team));
    people.forEach((user) => ensure(user.city || SANS_VILLE).staff.push(user));

    // Une personne « sans équipe » est rattachée à la ville sans figurer dans
    // aucune de ses équipes. C'est le seul état qui demande une décision, donc
    // le seul qu'on remonte jusqu'à la liste des villes.
    byCity.forEach((group) => {
      const inTeams = new Set<number>();
      group.teams.forEach((team) =>
        (team.members ?? []).forEach((member) => inTeams.add(member.id)),
      );
      group.unassigned = group.staff.filter((user) => !inTeams.has(user.id));
    });

    return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city, 'fr'));
  }, [properties, teams, people]);

  const [selected, setSelected] = useState<string | null>(null);
  const current = groups.find((g) => g.city === selected) ?? groups[0] ?? null;

  /**
   * Applique un dépôt.
   *
   * <p>L'appartenance à une équipe se met à jour en renvoyant la liste
   * COMPLÈTE des membres : c'est le contrat de `PUT /api/teams/{id}`, il n'y a
   * pas d'endpoint pour ajouter ou retirer une seule personne. On reconstruit
   * donc la liste à partir de ce que l'écran affiche.</p>
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const payload = event.active.data.current as DragPayload | undefined;
      const overId = event.over?.id ? String(event.over.id) : null;
      if (!payload || !overId || busy || !current) {
        return;
      }

      const teamOf = (id: string) =>
        current.teams.find((team) => `team-${team.id}` === id) ?? null;

      try {
        setBusy(true);

        if (payload.kind === 'property') {
          const target = teamOf(overId);
          if (!target) return;
          await propertyTeamsApi.assign(payload.propertyId, target.id);
        } else {
          const target = teamOf(overId);
          const leaving = payload.fromTeamId;
          if (target && target.id === leaving) return; // déposé là d'où il vient

          if (target) {
            const members = [
              ...(target.members ?? []).map((m) => ({ userId: m.id, role: m.role })),
              { userId: payload.userId, role: 'MEMBER' },
            ];
            const body = buildTeamPayload(target, members);
            if (!body) return;
            await teamsApi.update(target.id, body);
          }
          if (leaving != null && (target || overId === 'unassigned')) {
            const source = current.teams.find((team) => team.id === leaving);
            if (source) {
              const members = (source.members ?? [])
                .filter((m) => m.id !== payload.userId)
                .map((m) => ({ userId: m.id, role: m.role }));
              const body = buildTeamPayload(source, members);
              if (body) {
                await teamsApi.update(source.id, body);
              }
            }
          }
        }

        await queryClient.invalidateQueries({
          queryKey: portfoliosKeys.associations(user?.id ?? ''),
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, current, queryClient, user?.id],
  );

  const totals = useMemo(
    () => ({
      properties: properties.length,
      teams: teams.length,
      staff: people.length,
      unassigned: groups.reduce((sum, g) => sum + g.unassigned.length, 0),
      clients: clients.length,
    }),
    [properties.length, teams.length, people.length, groups, clients.length],
  );

  if (!loading && groups.length === 0) {
    return (
      <EmptyState
        icon={<Home />}
        title={t('portfolios.byCity.emptyTitle', 'Aucun logement dans ce portefeuille')}
        description={t(
          'portfolios.byCity.emptyDescription',
          'Affectez des logements pour voir apparaître les villes, leurs équipes et leurs intervenants.',
        )}
        action={
          <Button onClick={onAssignProperties}>
            {t('portfolios.byCity.assignProperties', 'Affecter un logement')}
          </Button>
        }
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <div className={cn('flex flex-col gap-3', busy && 'pointer-events-none opacity-70')}>
      {/* Une répartition, pas de grands nombres isolés : « 105 » n'appelle
          aucune action, « 2 sans équipe » en appelle une. */}
      <Card className="flex flex-row flex-wrap items-baseline gap-x-6 gap-y-2 border-border p-3">
        <Figure value={totals.properties} label={t('portfolios.byCity.properties', 'logements')} />
        <Figure value={totals.teams} label={t('portfolios.byCity.teams', 'équipes')} />
        <Figure value={totals.staff} label={t('portfolios.byCity.staff', 'intervenants')} />
        <Figure
          value={totals.unassigned}
          label={t('portfolios.byCity.unassigned', 'sans équipe')}
          alert={totals.unassigned > 0}
        />
        <Figure value={totals.clients} label={t('portfolios.byCity.clients', 'propriétaires')} />
        <div className="ms-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAssignStaff}>
            {t('portfolios.byCity.assignStaff', 'Rattacher un intervenant')}
          </Button>
          <Button size="sm" onClick={onAssignProperties}>
            {t('portfolios.byCity.assignProperties', 'Affecter un logement')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
        {/* Rail des villes : un bouton par ville, donc navigable au clavier
            sans avoir à recréer un rôle et un gestionnaire de touches. */}
        <Card className="flex flex-col gap-0 overflow-hidden border-border p-0">
          <div className="px-4 pb-2 pt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('portfolios.byCity.cities', 'Villes')}
          </div>
          <nav aria-label={t('portfolios.byCity.cities', 'Villes')}>
            {groups.map((group) => {
              const active = current?.city === group.city;
              return (
                <button
                  key={group.city}
                  type="button"
                  aria-current={active}
                  onClick={() => setSelected(group.city)}
                  className={cn(
                    'flex w-full cursor-pointer flex-col gap-1 border-s-2 px-4 py-2.5 text-start',
                    'transition-colors duration-200 hover:bg-primary-soft',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
                    active ? 'border-s-primary bg-primary-soft' : 'border-s-transparent',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {group.city}
                    </span>
                    {group.unassigned.length > 0 ? (
                      <StatusChip
                        tone="warn"
                        label={`${group.unassigned.length} ${t('portfolios.byCity.without', 'sans équipe')}`}
                        className="h-[20px] shrink-0 text-[0.6rem]"
                      />
                    ) : (
                      <StatusChip
                        tone="ok"
                        label={t('portfolios.byCity.covered', 'Couverte')}
                        className="h-[20px] shrink-0 text-[0.6rem]"
                      />
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {group.properties.length} · {group.teams.length} · {group.staff.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </Card>

        {current ? (
          <CityDetail group={current} t={t} canDragProperty={canAssignProperty} />
        ) : null}
      </div>
    </div>
    </DndContext>
  );
};

const Figure: React.FC<{ value: number; label: string; alert?: boolean }> = ({
  value,
  label,
  alert,
}) => (
  <span className="flex items-baseline gap-1.5">
    <b
      className={cn(
        'font-display text-lg font-bold tabular-nums',
        alert ? 'text-warning-ink' : 'text-foreground',
      )}
    >
      {value}
    </b>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

const CityDetail: React.FC<{
  group: CityGroup;
  t: Translate;
  canDragProperty: boolean;
}> = ({ group, t, canDragProperty }) => (
  <div className="flex flex-col gap-3">
    <Section
      title={t('portfolios.byCity.properties', 'Logements')}
      count={group.properties.length}
    >
      {group.properties.length === 0 ? (
        <Hint>{t('portfolios.byCity.noProperty', 'Aucun logement dans cette ville.')}</Hint>
      ) : (
        <div className="flex flex-col gap-px">
          {group.properties.map((property) => (
            <DraggableProperty
              key={property.id}
              property={property}
              disabled={!canDragProperty}
            >
              <span className="text-sm font-semibold text-foreground">{property.name}</span>
              {property.address ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <LocationOn size={12} strokeWidth={1.75} aria-hidden="true" />
                  {property.address}
                </span>
              ) : null}
              <span className="ms-auto text-xs text-muted-foreground">{property.ownerName}</span>
            </DraggableProperty>
          ))}
        </div>
      )}
    </Section>

    <Section title={t('portfolios.byCity.teamsOf', 'Équipes')} count={group.teams.length}>
      {group.teams.length === 0 ? (
        <Hint>{t('portfolios.byCity.noTeam', 'Aucune équipe sur cette ville.')}</Hint>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {group.teams.map((team) => (
            <DropZone
              key={team.id}
              id={`team-${team.id}`}
              accepts={['person', 'property']}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{teamTrade(team)}</span>
                <StatusChip
                  tone={(team.members?.length ?? 0) > 0 ? 'ok' : 'warn'}
                  label={`${team.members?.length ?? team.memberCount} ${t('portfolios.byCity.members', 'membres')}`}
                  className="h-[20px] text-[0.6rem]"
                />
              </div>
              {/* Les membres sont NOMMÉS : c'est la question à laquelle l'écran
                  précédent ne pouvait pas répondre. */}
              {(team.members ?? []).length === 0 ? (
                <Hint>{t('portfolios.byCity.emptyTeam', 'Personne dans cette équipe.')}</Hint>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(team.members ?? []).map((member) => (
                    <DraggablePerson
                      key={member.id}
                      id={`member-${team.id}-${member.id}`}
                      payload={{ kind: 'person', userId: member.id, fromTeamId: team.id }}
                      label={member.fullName}
                    />
                  ))}
                </div>
              )}
            </DropZone>
          ))}
        </div>
      )}
    </Section>

    {group.unassigned.length > 0 ? (
      <Section
        title={t('portfolios.byCity.unassignedTitle', 'Rattachés à la ville, dans aucune équipe')}
        count={group.unassigned.length}
      >
        <DropZone
          id="unassigned"
          accepts={['person']}
          className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-border p-3"
        >
          {group.unassigned.map((user) => (
            <DraggablePerson
              key={user.id}
              id={`free-${user.id}`}
              payload={{ kind: 'person', userId: user.id, fromTeamId: null }}
              label={fullName(user)}
              tone="warn"
            />
          ))}
        </DropZone>
      </Section>
    ) : null}
  </div>
);

const Section: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
    {children}
  </div>
);

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="m-0 text-xs text-muted-foreground">{children}</p>
);

export default PortfolioByCity;
