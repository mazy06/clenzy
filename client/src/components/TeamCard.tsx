import React from 'react';
import { resolveMediaUrl } from '../config/api';
import StatusChip, { type StatusTone } from './StatusChip';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
  AvatarGroupCount,
  Button,
  Card,
  CardContent,
} from './ui';
import { MoreVert } from '../icons';
import { useNavigate } from 'react-router-dom';
import { teamTypeOption } from '../types/teamTypes';
import type { Team } from '../services/api';
import { formatShortDate } from '../utils/formatUtils';

interface TeamCardProps {
  team: Team;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, team: Team) => void;
  activeInterventionsCount?: number;
  canEdit?: boolean;
}

/**
 * Remplissage d'une pastille d'avatar sans photo.
 *
 * <p>Le fond etait la teinte de categorie a 12 % d'opacite : les pastilles se
 * chevauchent de 8 px, et deux fonds translucides superposes se confondaient
 * en une bouillie ou plus aucune initiale ne se lisait. Ici le fond est
 * OPAQUE — la teinte melangee au fond de carte —, donc chaque pastille masque
 * celle qu'elle recouvre et l'anneau suffit a les separer.</p>
 *
 * <p>Le texte ne reprend pas la teinte vive : une teinte vive sur son propre
 * pastel plafonne vers 2,4:1, sous le seuil AA de 4,5:1. On la fonce vers
 * `--foreground`, ce qui donne une encre teintee de la couleur du metier et
 * suit le theme clair comme le sombre, les deux termes du melange etant des
 * jetons.</p>
 */
const fallbackStyle = (token: string): React.CSSProperties => ({
  backgroundColor: `color-mix(in oklab, ${token} 20%, var(--card))`,
  color: `color-mix(in oklab, ${token} 40%, var(--foreground))`,
});

// ─── Statut ──────────────────────────────────────────────────────────────────

const getTeamStatus = (team: Team): string => {
  if (team.status) return team.status;
  if (team.lastIntervention) {
    const days = Math.floor(
      (Date.now() - new Date(team.lastIntervention).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days > 30) return 'inactive';
    if (days > 7) return 'maintenance';
    return 'active';
  }
  return 'active';
};

/** Le statut passe par les TONS semantiques de la primitive, pas par des hex. */
const STATUS_PRESENTATION: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: 'ok', label: 'Active' },
  inactive: { tone: 'err', label: 'Inactive' },
  maintenance: { tone: 'warn', label: 'Maintenance' },
};

const statusPresentation = (status: string) =>
  STATUS_PRESENTATION[status] ?? { tone: 'neutral' as StatusTone, label: 'Inconnu' };

/** Pastilles d'avatars affichees au maximum, compteur de surplus inclus. */
const MAX_AVATARS = 4;

/**
 * Carte d'equipe.
 *
 * <p>Refonte : la carte portait SIX icones — un badge carre de 38 px repetant
 * le type a cote du titre, la meme icone dans la puce de type, une icone de
 * charge, une cle a molette devant le nombre d'interventions, une icone de
 * GROUPE devant une DATE de creation, plus un oeil et un crayon dans les deux
 * boutons. Le badge-icone accole a chaque titre est un motif « template »
 * caracteristique, et l'icone de groupe devant une date etait un contresens.
 * Il n'en reste qu'UNE, le menu de debordement ; le type se dit desormais par
 * la pastille coloree qu'offre deja `StatusChip` (`dot`), la couleur n'etant
 * jamais le seul signal puisque le libelle l'accompagne.</p>
 *
 * <p>La hierarchie suit ce que la carte sert a savoir : le nom, puis QUI est
 * dans l'equipe — la substance —, la meta datee ensuite, en retrait. Les deux
 * boutons pleine largeur de meme rang lestaient le pied de carte ; ils sont
 * compacts, alignes a droite, et se distinguent par la variante, la carte
 * entiere menant deja au detail.</p>
 */
const TeamCard: React.FC<TeamCardProps> = React.memo(({
  team,
  onMenuOpen,
  activeInterventionsCount = 0,
  canEdit = false,
}) => {
  const navigate = useNavigate();

  const status = getTeamStatus(team);
  const { tone: statusTone, label: statusLabel } = statusPresentation(status);
  // Le vocabulaire des EQUIPES, pas celui des interventions : c'est la
  // confusion qui affichait « MAINTENANCE » brut, en gris, sur 22 cartes.
  const type = teamTypeOption(team.interventionType);
  const members = team.members ?? [];
  // Le groupe d'avatars du kit ne tronque pas : on reproduit le `max={4}` de MUI
  // (4 pastilles au total, la derniere devenant le compteur de surplus).
  const shownMembers = members.slice(
    0,
    members.length > MAX_AVATARS ? MAX_AVATARS - 1 : MAX_AVATARS,
  );
  const surplusMembers = members.length - shownMembers.length;

  const handleViewDetails = () => {
    navigate(`/teams/${team.id}`);
  };

  const totalInterventions = team.totalInterventions ?? 0;

  return (
    // La bordure de survol derive de la teinte de type, connue a l'execution :
    // Tailwind ne peut pas en emettre la classe, on la fait transiter par une
    // custom property posee en style, que la classe de survol consomme.
    <Card
      onClick={handleViewDetails}
      style={
        {
          '--team-accent': `color-mix(in oklab, ${type.token} 45%, transparent)`,
        } as React.CSSProperties
      }
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-solid border-border bg-card shadow-none ring-0 [--card-spacing:0px] transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:-translate-y-px hover:border-[var(--team-accent)] hover:shadow-sm motion-reduce:transition-none"
    >
      <CardContent className="flex grow flex-col gap-2.5 p-3.5 pb-3">
        {/* ── Identite ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold leading-tight text-foreground"
              title={team.name}
            >
              {team.name}
            </p>
            {/* La description ne s'affiche que si elle existe : « Aucune
                description » occupait une ligne permanente pour ne rien dire. */}
            {team.description ? (
              <p
                className="mt-0.5 truncate text-xs leading-snug text-muted-foreground"
                title={team.description}
              >
                {team.description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen(e, team);
            }}
            className="-me-1 -mt-1 shrink-0 text-muted-foreground"
            aria-label="Options"
          >
            <MoreVert size={16} strokeWidth={1.75} />
          </Button>
        </div>

        {/* ── Type, statut, charge : des pastilles, plus d'icones ──────── */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* Le type est une CLASSIFICATION, le statut un ÉTAT : deux registres
              distincts. En puces toutes deux, « Nettoyage » et « Active »
              tombaient d'ailleurs sur le même vert. Le type prend donc la forme
              d'une légende — pastille en `-ink`, libellé en `muted-foreground`
              (4,8:1) — et laisse la forme de puce au seul statut.

              La pastille prend l'encre et non la teinte vive : posée à même le
              fond de carte, la vive tombait à 2,2:1. Et la couleur n'est jamais
              le seul signal, le mot l'accompagne. */}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2.5px]"
              style={{ backgroundColor: type.inkToken }}
            />
            {type.label}
          </span>
          <StatusChip tone={statusTone} label={statusLabel} />
          {activeInterventionsCount > 0 ? (
            <StatusChip
              tone={activeInterventionsCount > 5 ? 'err' : activeInterventionsCount > 2 ? 'warn' : 'info'}
              label={`${activeInterventionsCount} en cours`}
              className="tabular-nums"
            />
          ) : null}
        </div>

        {/* ── Qui compose l'equipe : la substance de la carte ──────────── */}
        {members.length > 0 ? (
          <div className="flex items-center gap-2">
            <AvatarGroup className="*:data-[slot=avatar]:ring-card">
              {shownMembers.map((member) => (
                // Le nom complet au survol : une pastille chevauchee ne peut
                // pas le porter, mais l'information ne doit pas disparaitre.
                <Avatar
                  key={member.id}
                  size="sm"
                  title={`${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()}
                >
                  {/* La photo si elle existe ; `AvatarImage` retombe seul sur
                      l'initiale quand elle manque ou ne charge pas. */}
                  {resolveMediaUrl(member.avatarUrl) ? (
                    <AvatarImage src={resolveMediaUrl(member.avatarUrl)} alt="" />
                  ) : null}
                  <AvatarFallback
                    className="text-2xs font-[family-name:var(--font-display)] font-semibold"
                    style={fallbackStyle(type.token)}
                  >
                    {/* UNE initiale : sur 24 px dont 8 sont recouverts par la
                        pastille suivante, deux lettres se chevauchaient. */}
                    {member.firstName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {surplusMembers > 0 && (
                <AvatarGroupCount
                  className="text-2xs font-[family-name:var(--font-display)] font-semibold tabular-nums ring-card"
                  style={fallbackStyle(type.token)}
                >
                  +{surplusMembers}
                </AvatarGroupCount>
              )}
            </AvatarGroup>
            <p className="m-0 text-xs tabular-nums text-muted-foreground">
              {members.length} {members.length > 1 ? 'membres' : 'membre'}
            </p>
          </div>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">Aucun membre</p>
        )}

        {/* ── Meta, en retrait : ni cle a molette, ni icone de groupe pour
               annoncer une date. Le mot dit ce que l'icone disait mal. ──── */}
        <p className="m-0 mt-auto pt-0.5 text-2xs text-muted-foreground">
          {totalInterventions > 0 ? (
            <span className="tabular-nums">
              {totalInterventions} intervention{totalInterventions > 1 ? 's' : ''}
            </span>
          ) : null}
          {totalInterventions > 0 && team.createdAt ? <span aria-hidden="true"> · </span> : null}
          {team.createdAt ? (
            <span className="tabular-nums">créée le {formatShortDate(team.createdAt)}</span>
          ) : null}
        </p>
      </CardContent>

      {/* Actions compactes, alignees a droite : deux boutons pleine largeur de
          meme rang lestaient le pied et ne hierarchisaient rien. « Détails »
          double le clic sur la carte, il reste donc discret ; « Modifier »
          porte la variante. */}
      <div className="flex items-center justify-end gap-1.5 px-3.5 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetails();
          }}
        >
          Détails
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/teams/${team.id}/edit`);
            }}
          >
            Modifier
          </Button>
        )}
      </div>
    </Card>
  );
});

TeamCard.displayName = 'TeamCard';

export default TeamCard;
