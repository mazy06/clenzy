import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, Button, Card } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Home, LocationOn } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
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
    <div className="flex flex-col gap-3">
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

        {current ? <CityDetail group={current} t={t} /> : null}
      </div>
    </div>
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

const CityDetail: React.FC<{ group: CityGroup; t: Translate }> = ({ group, t }) => (
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
            <div
              key={property.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-2"
            >
              <span className="text-sm font-semibold text-foreground">{property.name}</span>
              {property.address ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <LocationOn size={12} strokeWidth={1.75} aria-hidden="true" />
                  {property.address}
                </span>
              ) : null}
              <span className="ms-auto text-xs text-muted-foreground">{property.ownerName}</span>
            </div>
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
            <Card key={team.id} className="flex flex-col gap-2 border-border p-3">
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
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pe-2.5 ps-0.5 text-xs text-foreground"
                    >
                      <Avatar className="size-[21px]">
                        <AvatarFallback className="text-[0.55rem] font-bold">
                          {initials(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      {member.fullName}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Section>

    {group.unassigned.length > 0 ? (
      <Section
        title={t('portfolios.byCity.unassignedTitle', 'Rattachés à la ville, dans aucune équipe')}
        count={group.unassigned.length}
      >
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-border p-3">
          {group.unassigned.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-warning bg-warning-soft py-0.5 pe-2.5 ps-0.5 text-xs text-warning-ink"
            >
              <Avatar className="size-[21px]">
                <AvatarFallback className="text-[0.55rem] font-bold">
                  {initials(fullName(user))}
                </AvatarFallback>
              </Avatar>
              {fullName(user)}
            </span>
          ))}
        </div>
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
