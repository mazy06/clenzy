import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ClockIcon, ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Attachment,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  Badge,
  Button,
  Calendar,
  Card,
  CardContent,
  CardFooter,
  Field,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui';
import { Money } from '../Money';
import {
  actionItemsApi,
  refreshActionQueue,
  type AssignableTeam,
} from '../../services/api/actionItemsApi';
import type { DashboardActionItem } from '../../services/api/dashboardOperationsApi';
import { ACTION_CARDS, type Gesture } from './actionCards';
import PayoutRecap from './PayoutRecap';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — la carte de décision d'une action en attente.
 *
 * <p>Une file ne sert à rien si chaque ligne oblige à partir enquêter ailleurs.
 * Cette carte porte donc les trois choses qu'il faut pour <b>décider</b> :</p>
 *
 * <ol>
 *   <li><b>Ce qui s'est passé</b> — en une phrase, sans jargon.</li>
 *   <li><b>Ce que coûte l'inaction</b> — la partie qu'on omet d'ordinaire, et
 *       sans laquelle rien ne distingue l'urgent du reste.</li>
 *   <li><b>Le geste</b> — fait sur place quand c'est possible.</li>
 * </ol>
 *
 * <p>Le contenu de la boîte de dialogue <b>est</b> la carte : pas de
 * {@code Card} imbriqué. Une carte dans une carte ajoute un cadre, une ombre et
 * un rayon de plus sans rien apporter — c'est un anti-patron du systeme de
 * design du projet.</p>
 *
 * <p>Quand aucun geste n'est possible sur place — reconnecter un compte OAuth,
 * terminer une verification bancaire — la carte le dit et renvoie vers l'ecran
 * qui le porte, plutôt que d'afficher un bouton qui ne ferait rien.</p>
 */

export interface ActionCardDialogProps {
  /** Action a traiter. `null` ferme la carte. */
  item: DashboardActionItem | null;
  onClose: () => void;
  /** Cles react-query a invalider apres le geste. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function ActionCardDialog({
  item,
  onClose,
  invalidateKeys = [],
}: ActionCardDialogProps) {
  const { t, isArabic } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const card = item ? ACTION_CARDS[item.kind] : undefined;

  // L'équipe et la date choisies, quand un geste les demande.
  const [assignee, setAssignee] = React.useState<number | null>(null);
  // Minuit local, jamais `new Date()` : l'heure courante rendrait aujourd'hui
  // partiellement indisponible au calendrier.
  const startOfToday = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [day, setDay] = React.useState<Date | undefined>(undefined);
  const [time, setTime] = React.useState('10:00');
  // Construit a la main, jamais via `toISOString()` : celui-ci convertit en UTC
  // et decale la date d'un jour selon le fuseau.
  const scheduledAt = day
    ? `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`
    : '';
  // Le geste en cours : plusieurs peuvent coexister sur une même carte, et le
  // message de succès dépend de celui qu'on a lancé.
  const [running, setRunning] = React.useState<Gesture | null>(null);

  const act = useMutation({
    mutationFn: (gesture: Gesture) => {
      setRunning(gesture);
      return actionItemsApi.act(item!.actionItemId!, gesture.action, assignee, scheduledAt || null);
    },
    onSuccess: () =>
      refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys),
  });

  // Sans remise a zero, le resultat de la carte precedente s'afficherait sur la
  // suivante — un succes vert sur une action a laquelle on n'a pas touche.
  React.useEffect(() => {
    act.reset();
    setAssignee(null);
    setDay(undefined);
    setTime('10:00');
    setRunning(null);
  }, [item?.actionItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsAssignee = card?.gestures?.some((g) => g.needsAssignee) === true;
  // Un reversement se lit avant de s'approuver : le bouton portait un montant
  // et rien d'autre.
  const isPayout = item?.kind === 'OWNER_PAYOUT_PENDING';
  // La preuve photo conditionne le paiement du prestataire : la montrer rend
  // verifiable ce que l'avertissement annonce.
  const isIntervention = item?.kind === 'INTERVENTION_OVERDUE';
  const proof = useQuery({
    queryKey: ['action-items', item?.actionItemId, 'intervention-proof'],
    queryFn: () => actionItemsApi.interventionProof(item!.actionItemId!),
    enabled: isIntervention && item?.actionItemId != null,
  });
  const proofPhotos = React.useMemo(() => parsePhotos(proof.data?.photos), [proof.data]);
  const payout = useQuery({
    queryKey: ['action-items', item?.actionItemId, 'payout-recap'],
    queryFn: () => actionItemsApi.payoutRecap(item!.actionItemId!),
    enabled: isPayout && item?.actionItemId != null,
  });
  // Les suggestions ne se chargent que si la carte en a besoin : une requête
  // par ouverture de carte, sinon, pour rien.
  const teams = useQuery({
    queryKey: ['action-items', item?.actionItemId, 'assignable-teams'],
    queryFn: () => actionItemsApi.assignableTeams(item!.actionItemId!),
    enabled: needsAssignee && item?.actionItemId != null,
  });

  if (!card) return null;

  const gestures = card.gestures ?? [];
  const needsDate = gestures.some((g) => g.needsDate);
  // Le serveur a déjà tranché : cette exécution a-t-elle laissé une trace de
  // tentative ? Lui seul peut le savoir, et il le dit avant le clic.
  const mayHaveSent = item?.actionType === 'MAY_HAVE_SENT';
  // Une action deduite des donnees peut n'avoir aucune ligne persistee derriere
  // elle (fixtures de galerie) : le geste serait alors sans cible.
  /** Un geste ne part que si ce qu'il vise est renseigné. */
  // Ce qui force la largeur : une saisie a cote de laquelle le contexte tient,
  // ou un recapitulatif qui se lit en deux colonnes.
  const wide = needsDate || needsAssignee || isPayout;
  // La grille exterieure ne sert qu'aux saisies : le contexte a gauche, ce que
  // le geste demande a droite. Le recapitulatif porte sa propre repartition.
  const split = needsDate || needsAssignee;

  const canRun = (gesture: Gesture) =>
    item?.actionItemId != null
    && (!gesture.needsAssignee || assignee != null)
    && (!gesture.needsDate || scheduledAt !== '')
    // Approuver avant d'avoir pu lire le detail serait exactement ce qu'on
    // corrige : une signature a l'aveugle.
    && (!isPayout || payout.isSuccess);

  return (
    <Dialog open={item != null} onOpenChange={(next) => !next && !act.isPending && onClose()}>
      {/* Deux colonnes seulement quand la carte porte un element large — un
          calendrier, un selecteur, un recapitulatif. Sinon elle reste etroite :
          deux lignes etalees sur 900 px se lisent plus mal que trop haut. */}
      <DialogContent className={cn(wide ? 'max-w-4xl' : 'max-w-md')}>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item?.severity === 'critical' ? 'destructive' : 'secondary'}>
              {severityLabel(item?.severity, t)}
            </Badge>
            {/* L'echeance passe avant tout le reste : passe le delai, la
                decision ne vaut plus rien. */}
            {item?.badge && <Badge variant="outline">{item.badge}</Badge>}
          </div>
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          {item?.detail && <DialogDescription>{item.detail}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">{t(card.whatKey, card.what)}</p>
          {/* Ce que coute l'inaction — la phrase qui fait decider. */}
          <p className="font-medium text-foreground">
            {t(card.consequenceKey, card.consequence)}
          </p>
        </div>

        <div className={cn(split && 'grid gap-4 md:grid-cols-2 md:items-start')}>
          <div className="space-y-3">

        {!isPayout && (item?.propertyName || item?.amount != null || item?.subject) && (
          <ItemGroup>
            {item?.subject && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.person', 'Personne concernée')}
                  </ItemDescription>
                  <ItemTitle>{item.subject}</ItemTitle>
                </ItemContent>
              </Item>
            )}
            {item?.propertyName && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.property', 'Logement')}
                  </ItemDescription>
                  <ItemTitle>{item.propertyName}</ItemTitle>
                </ItemContent>
              </Item>
            )}
            {item?.amount != null && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.amount', 'Montant en jeu')}
                  </ItemDescription>
                  <ItemTitle className="tabular-nums">
                    <Money value={item.amount} />
                  </ItemTitle>
                </ItemContent>
              </Item>
            )}
          </ItemGroup>
        )}

        {needsAssignee && !act.isSuccess && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('dashboard.actionCard.chooseTeam', 'À qui confier cette intervention ?')}
            </p>
            {teams.isLoading && <Spinner />}
            {teams.isError && (
              <p className="text-sm text-destructive">
                {t('dashboard.actionCard.teamsFailed', 'Les équipes n’ont pas pu être chargées.')}
              </p>
            )}
            {teams.data?.teams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {/* Le TYPE requis est ce qui transforme le constat en action :
                    sans lui, on ne sait pas s'il manque une équipe, une
                    couverture de zone, ou une disponibilité. */}
                {teams.data?.requiredTeamType
                  ? t('dashboard.actionCard.needsTeamType', {
                      type: teamTypeLabel(teams.data.requiredTeamType, t),
                      defaultValue:
                        'Cette intervention demande une équipe de type « {{type}} ». '
                        + 'Votre organisation n’en a aucune.',
                    })
                  : t(
                      'dashboard.actionCard.noTeam',
                      'Aucune équipe ne couvre ce logement. Il faut en rattacher une avant de pouvoir assigner.',
                    )}
              </p>
            )}
            <ItemGroup>
              {teams.data?.teams.map((team) => (
                <Item
                  key={team.teamId}
                  size="sm"
                  variant={assignee === team.teamId ? 'outline' : 'muted'}
                  asChild
                >
                  <button type="button" className="w-full cursor-pointer text-start"
                          onClick={() => setAssignee(team.teamId)}>
                    <ItemContent>
                      <ItemTitle>{team.name}</ItemTitle>
                      <ItemDescription>{teamAvailability(team, t)}</ItemDescription>
                    </ItemContent>
                  </button>
                </Item>
              ))}
            </ItemGroup>
          </div>
        )}

        {isIntervention && proofPhotos.length > 0 && !act.isSuccess && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('dashboard.actionCard.proofPhotos', 'Photos de fin de mission')}
            </p>
            <AttachmentGroup>
              {proofPhotos.map((photo, index) => (
                <Attachment key={index} orientation="vertical">
                  <AttachmentMedia variant="image">
                    <img src={photo} alt="" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>
                      {t('dashboard.actionCard.proofPhoto', {
                        index: index + 1,
                        defaultValue: 'Photo {{index}}',
                      })}
                    </AttachmentTitle>
                  </AttachmentContent>
                </Attachment>
              ))}
            </AttachmentGroup>
          </div>
        )}

        {isIntervention && proof.isSuccess && proofPhotos.length === 0 && !act.isSuccess && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t(
                'dashboard.actionCard.noProof',
                'Aucune photo de fin de mission : le paiement du prestataire restera bloqué même après avoir terminé l’intervention.',
              )}
            </AlertDescription>
          </Alert>
        )}

          </div>

          <div className="space-y-3">

        {isPayout && !act.isSuccess && (
          <PayoutRecap
            recap={payout.data}
            isLoading={payout.isLoading}
            isError={payout.isError}
          />
        )}

        {needsDate && !act.isSuccess && (
          // Meme presentation que la replanification des prestations : deux
          // mois, parce qu'une intervention manquee se reporte souvent au-dela
          // du mois courant, et l'heure en pied de carte.
          <Card size="sm" className="mx-auto w-fit">
            <CardContent>
              <Calendar
                mode="single"
                numberOfMonths={2}
                calendarSystem={isArabic ? 'hijri' : 'gregorian'}
                selected={day}
                onSelect={setDay}
                disabled={{ before: startOfToday }}
                className="p-0"
              />
            </CardContent>
            <CardFooter className="border-t bg-card">
              <Field>
                <FieldLabel htmlFor="action-time">
                  {t('dashboard.actionCard.timeLabel', 'Heure')}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="action-time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <InputGroupAddon>
                    <ClockIcon className="text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </CardFooter>
          </Card>
        )}

          </div>
        </div>

        {act.isSuccess && (
          <Alert>
            <CheckIcon />
            <AlertDescription>
              {running ? t(running.doneKey, running.done) : null}
            </AlertDescription>
          </Alert>
        )}

        {/* La confirmation n'apparaît QUE dans le cas douteux. Une confirmation
            systématique s'apprend à cliquer sans lire, et ne protégerait plus
            rien le jour où elle compte vraiment. */}
        {mayHaveSent && !act.isSuccess && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t(
                'dashboard.actionCard.mayHaveSent',
                'Une tentative d’envoi est déjà partie sans que son issue ait pu être confirmée. Rejouer peut faire recevoir le message une seconde fois au voyageur.',
              )}
            </AlertDescription>
          </Alert>
        )}

        {act.isError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t('dashboard.actionCard.failed', 'Le geste a échoué. L’action reste à traiter.')}
            </AlertDescription>
          </Alert>
        )}

        {/* Dire pourquoi il n'y a rien a cocher evite de chercher le bouton. */}
        {gestures.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t(
              'dashboard.actionCard.elsewhere',
              'Ce geste ne se fait pas depuis ici — la ligne disparaîtra une fois la cause traitée.',
            )}
          </p>
        )}

        <DialogFooter className={card.route ? 'sm:justify-between' : undefined}>
          {card.route && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(card.route!);
              }}
            >
              <ExternalLinkIcon />
              {t(card.linkKey!, card.link!)}
            </Button>
          )}

          {/* Les gestes vont du plus attendu au plus definitif ; l'ordre de la
              table fait foi, et le destructif se distingue par sa teinte. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {gestures.map((gesture) => {
              const button = (
                <Button
                  variant={mayHaveSent || gesture.destructive ? 'destructive' : 'default'}
                  onClick={() => act.mutate(gesture)}
                  disabled={!canRun(gesture) || act.isPending || act.isSuccess}
                >
                  {act.isPending && running?.action === gesture.action
                    ? <Spinner /> : <CheckIcon />}
                  {mayHaveSent
                    ? t('dashboard.actionCard.replayAnyway', 'Rejouer malgré le risque')
                    : t(gesture.labelKey, gesture.label)}
                </Button>
              );

              // Ce qu'un geste declenche au-dela du changement d'etat se lit au
              // survol du bouton concerne, et non en bas de carte : la
              // consequence appartient au geste, pas a la page.
              return gesture.warn ? (
                <Tooltip key={gesture.action}>
                  <TooltipTrigger asChild>
                    {/* Un bouton desactive n'emet pas d'evenement de survol :
                        l'enveloppe porte le declencheur a sa place. */}
                    <span className="inline-flex">{button}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {t(gesture.warnKey!, gesture.warn!)}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <React.Fragment key={gesture.action}>{button}</React.Fragment>
              );
            })}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** L'urgence en un mot, la couleur ne suffisant pas a qui ne la distingue pas. */
function severityLabel(
  severity: string | undefined,
  t: (key: string, fallback: string) => string,
): string {
  if (severity === 'critical') return t('dashboard.actionCard.critical', 'Critique');
  if (severity === 'info') return t('dashboard.actionCard.info', 'Pour information');
  return t('dashboard.actionCard.warning', 'À surveiller');
}

/**
 * Ce qu'il faut savoir d'une équipe avant de lui confier l'intervention.
 *
 * <p>Une équipe occupée reste proposée, en le disant : la masquer ferait croire
 * qu'il n'existe personne, ce qui est faux et bloque l'utilisateur.</p>
 */
function teamAvailability(
  team: AssignableTeam,
  t: (key: string, fallback: string) => string,
): string {
  if (!team.available) {
    return t('dashboard.actionCard.teamBusy', 'Déjà prise sur ce créneau');
  }
  return team.origin === 'ZONE'
    ? t('dashboard.actionCard.teamZone', 'Couvre la zone')
    : t('dashboard.actionCard.teamDefault', 'Équipe du logement');
}

/** Nom lisible d'un type d'équipe — la clé technique n'explique rien. */
function teamTypeLabel(type: string, t: (key: string, fallback: string) => string): string {
  if (type === 'CLEANING') return t('teamType.cleaning', 'Ménage');
  if (type === 'MAINTENANCE') return t('teamType.maintenance', 'Maintenance');
  return t('teamType.other', 'Autre');
}

/** Deux chiffres, pour composer une date locale sans passer par UTC. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Les photos servies par le serveur, en base64.
 *
 * <p>Le format vient de l'écran des interventions : un tableau JSON de données
 * en base64. Une chaîne illisible ne doit pas faire tomber la carte — l'absence
 * de preuve est une information, un plantage n'en est pas une.</p>
 */
function parsePhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}
