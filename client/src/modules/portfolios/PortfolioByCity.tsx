import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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

/**
 * Libellé d'une équipe dans le panneau d'une ville.
 *
 * <p>On retire la ville du nom quand elle s'y trouve — « Ménage Tours » dans le
 * panneau de Tours devient « Ménage » — mais on ne remplace JAMAIS le nom par
 * le métier : une équipe qui ne suit pas cette nomenclature y perdrait son
 * identité, et deux équipes de ménage deviendraient indistinguables.</p>
 */
function teamLabel(team: PortfolioTeam, city: string): string {
  const name = team.name?.trim() ?? '';
  if (!name) {
    return team.interventionType === 'MAINTENANCE' ? 'Maintenance' : 'Ménage';
  }
  const suffix = ` ${city}`;
  if (city && name.toLowerCase().endsWith(suffix.toLowerCase())) {
    return name.slice(0, -suffix.length).trim() || name;
  }
  return name;
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
 * Corps de metier d'une personne, en regard du metier d'une equipe.
 *
 * <p>Aligne sur {@code PersonalTeamService.interventionTypeFor} cote serveur,
 * avec une nuance : celui-ci range l'encadrement en CLEANING par defaut, ce
 * qui interdirait a un superviseur d'encadrer une equipe de maintenance. Un
 * encadrant ne fait pas le travail, il le supervise — il est compatible des
 * deux cotes.</p>
 */
type Trade = 'CLEANING' | 'MAINTENANCE' | 'BOTH';

function tradeOf(role: string | undefined): Trade {
  switch (role) {
    case 'HOUSEKEEPER':
    case 'LAUNDRY':
      return 'CLEANING';
    case 'TECHNICIAN':
    case 'EXTERIOR_TECH':
      return 'MAINTENANCE';
    default:
      // SUPERVISOR, MANAGER, SUPER_ADMIN, HOST… : encadrement.
      return 'BOTH';
  }
}

const TRADE_LABEL: Record<Trade, string> = {
  CLEANING: 'Ménage',
  MAINTENANCE: 'Maintenance',
  BOTH: 'Encadrement',
};

/** Une personne peut-elle rejoindre cette equipe, au regard de son metier ? */
function tradeAllows(role: string | undefined, teamType: string | null | undefined): boolean {
  const trade = tradeOf(role);
  if (trade === 'BOTH') return true;
  if (!teamType) return true; // metier d'equipe inconnu : on ne bloque pas a l'aveugle
  return trade === teamType;
}

/**
 * Une personne peut-elle travailler dans cette ville ?
 *
 * <p>On s'appuie sur la zone DECLAREE, pas sur la ville de rattachement : un
 * responsable de secteur siege a Marrakech et intervient a Cannes, Lyon et
 * Nice. Sans zone declaree, on retombe sur la ville de rattachement plutot que
 * de tout interdire — une donnee absente n'est pas un refus.</p>
 */
function coversCity(user: PortfolioUser, city: string): boolean {
  const declared = user.coverageCities ?? [];
  if (declared.length > 0) {
    return declared.some((c) => c.localeCompare(city, 'fr', { sensitivity: 'base' }) === 0);
  }
  return !user.city || user.city.localeCompare(city, 'fr', { sensitivity: 'base' }) === 0;
}

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
    // Le libelle voyage avec la charge utile : l'apercu rendu sous le curseur
    // n'a pas acces a la liste d'origine.
    data: { ...payload, label },
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
        // `touch-none` : sans lui, le capteur pointeur perd la main au profit
        // du defilement sur ecran tactile.
        disabled ? 'cursor-default' : 'cursor-grab touch-none active:cursor-grabbing',
        // La pastille d'origine reste en place, estompee ; c'est la copie du
        // DragOverlay qui suit le curseur.
        isDragging && 'opacity-30',
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
    data: { kind: 'property', propertyId: property.id, label: property.name },
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
        disabled ? 'cursor-default' : 'cursor-grab touch-none active:cursor-grabbing',
        isDragging && 'opacity-30',
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
  // Ce qu'on tient en main. Sans cet etat, rien ne peut etre dessine sous le
  // curseur : `useDraggable` expose un `transform`, mais une pastille qui se
  // deplacerait dans le flux serait rognee par son conteneur.
  const [dragging, setDragging] = useState<{ label: string; tone: 'default' | 'warn' } | null>(
    null,
  );
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);

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

    // Une personne peut travailler dans une ville sans y etre basee : un
    // responsable de secteur siege dans une ville et encadre les equipes de
    // plusieurs autres. Compter le personnel d'une ville sur la seule ville de
    // rattachement laissait ces gens hors du total alors qu'ils figurent dans
    // ses equipes — et le compte de la liste contredisait ce que le panneau
    // affichait.
    const byId = new Map(people.map((user) => [user.id, user]));
    byCity.forEach((group) => {
      const known = new Set(group.staff.map((user) => user.id));
      group.teams.forEach((team) =>
        (team.members ?? []).forEach((member) => {
          if (known.has(member.id)) return;
          const person = byId.get(member.id);
          if (person) {
            known.add(member.id);
            group.staff.push(person);
          }
        }),
      );
    });

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
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as (DragPayload & { label?: string }) | undefined;
    setDragging({
      label: data?.label ?? '',
      tone: data?.kind === 'person' && data.fromTeamId == null ? 'warn' : 'default',
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDragging(null);
      setDropError(null);
      setDropNotice(null);
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
          if (target && Number(target.id) === Number(leaving)) return; // déposé là d'où il vient

          if (target) {
            // Les deux regles s'appliquent AVANT d'ecrire quoi que ce soit :
            // un refus doit se dire, pas se decouvrir apres coup.
            const person = people.find((u) => Number(u.id) === Number(payload.userId));
            if (person && !coversCity(person, current.city)) {
              const zone = (person.coverageCities ?? []).join(', ') || person.city || 'aucune';
              throw new Error(
                `${fullName(person)} n'intervient pas à ${current.city}. `
                + `Zone déclarée : ${zone}.`,
              );
            }
            if (person && !tradeAllows(person.role, target.interventionType)) {
              throw new Error(
                `${fullName(person)} est ${TRADE_LABEL[tradeOf(person.role)].toLowerCase()} : `
                + `il ne peut pas rejoindre une équipe `
                + `${target.interventionType === 'MAINTENANCE' ? 'de maintenance' : 'de ménage'}.`,
              );
            }
            const members = [
              ...(target.members ?? []).map((m) => ({ userId: m.id, role: m.role })),
              { userId: payload.userId, role: 'MEMBER' },
            ];
            const body = buildTeamPayload(target, members);
            if (!body) return;
            await teamsApi.update(target.id, body);
          }
          if (leaving != null && (target || overId === 'unassigned')) {
            const source = current.teams.find((team) => Number(team.id) === Number(leaving));
            if (!source) {
              throw new Error(`Équipe d'origine ${leaving} introuvable dans ${current.city}`);
            }
            const before = source.members ?? [];
            // Comparaison sur des nombres : un identifiant qui arriverait en
            // chaine ne serait jamais egal en `!==`, le filtre ne retirerait
            // personne, et le PUT renverrait la liste inchangee — un retrait
            // qui reussit en apparence sans rien changer.
            const members = before
              .filter((m) => Number(m.id) !== Number(payload.userId))
              .map((m) => ({ userId: m.id, role: m.role }));
            if (members.length === before.length) {
              throw new Error(
                `L'intervenant ${payload.userId} n'est pas dans l'équipe ${source.id} `
                + `(membres : ${before.map((m) => m.id).join(', ') || 'aucun'})`,
              );
            }
            const body = buildTeamPayload(source, members);
            if (!body) {
              throw new Error(`Métier absent sur l'équipe ${source.id} : retrait refusé`);
            }
            await teamsApi.update(source.id, body);

            // Sortir quelqu'un d'une equipe le sort AUSSI de la ville quand il
            // n'y est pas base : sa seule attache etait cette equipe. La
            // disparition est alors correcte, mais elle doit se dire — sinon on
            // croit a un retrait qui a echoue.
            const removed = people.find((u) => Number(u.id) === Number(payload.userId));
            const home = removed?.city ?? null;
            if (!target && home && home !== current.city) {
              const who = removed ? fullName(removed) : `L'intervenant ${payload.userId}`;
              setDropNotice(
                `${who} a été retiré de l'équipe. Rattaché à ${home}, il n'apparaît plus `
                + `dans ${current.city}.`,
              );
            }
          }
        }

        await queryClient.invalidateQueries({
          queryKey: portfoliosKeys.associations(user?.id ?? ''),
        });
      } catch (err) {
        // Sans ce catch, un echec partait en rejet non gere : l'ecran se
        // rechargeait a l'identique et l'utilisateur ne voyait RIEN — ni
        // deplacement, ni erreur. Un depot qui echoue doit se dire.
        setDropError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, current, people, queryClient, user?.id],
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
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

      {dropNotice ? (
        <p
          role="status"
          className="m-0 rounded-lg border border-info bg-info-soft px-3 py-2 text-xs text-info-ink"
        >
          {dropNotice}
        </p>
      ) : null}

      {dropError ? (
        <p
          role="alert"
          className="m-0 rounded-lg border border-destructive bg-destructive-soft px-3 py-2 text-xs text-destructive-ink"
        >
          {dropError}
        </p>
      ) : null}

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
      {/* La copie qui suit reellement le curseur. Rendue dans un portail, elle
          echappe au `overflow` des cartes et reste lisible par-dessus tout. */}
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <span
            className={cn(
              'inline-flex cursor-grabbing items-center gap-1.5 rounded-full border py-0.5 pe-2.5 ps-0.5',
              'text-xs shadow-lg',
              dragging.tone === 'warn'
                ? 'border-warning bg-warning-soft text-warning-ink'
                : 'border-primary bg-card text-foreground',
            )}
          >
            <Avatar className="size-[21px]">
              <AvatarFallback className="text-[0.55rem] font-bold">
                {initials(dragging.label)}
              </AvatarFallback>
            </Avatar>
            {dragging.label}
          </span>
        ) : null}
      </DragOverlay>
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
                <span className="text-sm font-semibold text-foreground">
                  {teamLabel(team, group.city)}
                </span>
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

    {/* Cette zone est TOUJOURS rendue des qu'il existe une equipe : c'est la
        cible ou l'on depose quelqu'un pour l'en retirer. Ne l'afficher que
        lorsqu'elle contient deja du monde la rendait inatteignable dans une
        ville entierement couverte — on ne pouvait donc jamais desassigner. */}
    {group.teams.length > 0 || group.unassigned.length > 0 ? (
      <Section
        title={t('portfolios.byCity.unassignedTitle', 'Rattachés à la ville, dans aucune équipe')}
        count={group.unassigned.length}
      >
        <DropZone
          id="unassigned"
          accepts={['person']}
          className={cn(
            'flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border p-3',
            group.unassigned.length === 0 && 'justify-center',
          )}
        >
          {group.unassigned.length === 0 ? (
            <Hint>
              {t(
                'portfolios.byCity.dropToDetach',
                'Déposez ici un intervenant pour le retirer de son équipe.',
              )}
            </Hint>
          ) : (
            group.unassigned.map((user) => (
              // Le corps de metier est ce qui decide dans quelle equipe la
              // personne peut aller : il doit se lire sur la pastille, pas se
              // deviner au moment du depot.
              <span key={user.id} className="inline-flex items-center gap-1">
                <DraggablePerson
                  id={`free-${user.id}`}
                  payload={{ kind: 'person', userId: user.id, fromTeamId: null }}
                  label={fullName(user)}
                  tone="warn"
                />
                <StatusChip
                  tone={tradeOf(user.role) === 'BOTH' ? 'info' : 'neutral'}
                  label={TRADE_LABEL[tradeOf(user.role)]}
                  className="h-[18px] text-[0.55rem]"
                />
              </span>
            ))
          )}
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
