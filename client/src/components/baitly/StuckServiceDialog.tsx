import { useServiceReferenceLabel } from '../ServiceReferenceLabels';
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClockIcon, CheckIcon, ClockIcon, TriangleAlertIcon, XCircleIcon } from '../../icons/glyphs';
import { Alert, AlertDescription, Avatar, AvatarImage, AvatarFallback, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Card, CardContent, CardFooter, Field, FieldGroup, FieldLabel, InputGroup, InputGroupAddon, InputGroupInput, Label, Spinner } from '../ui';
import { Calendar } from '../ui/calendar';
import { serviceRequestsApi } from '../../services/api/serviceRequestsApi';
import { teamsApi, type Team } from '../../services/api/teamsApi';
import { resolveMediaUrl } from '../../config/api';
import { reservationsApi, type Reservation } from '../../services/api/reservationsApi';
import { extractApiList } from '../../types';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { refreshActionQueue } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { dateFnsLocale, weekStartsOnForLanguage } from '../../utils/localeDate';
import { useMediaQuery } from "../../hooks/use-media-query";
import "./baitlyServicePlanning.css";
import { cn } from '../../utils/cn';
import BaitlyFormSteps from '../forms/BaitlyFormSteps';

/**
 * Baitly — une prestation que personne n'assurera : la clore, ou la refaire.
 *
 * <p>Le produit cherche une équipe automatiquement, dix fois, puis s'arrête. La
 * demande reste alors en attente indéfiniment — parfois des mois, jusqu'à porter
 * le nom d'un logement qui a depuis été renommé. Deux issues, et deux seulement,
 * ont un sens à ce stade.</p>
 *
 * <p><b>Clôturer</b> : la prestation n'aura pas lieu, on l'acte. Ce n'est pas une
 * suppression — la demande reste consultable avec son coût et son historique.</p>
 *
 * <p><b>Replanifier</b> : on en refait une, à une nouvelle date, avec le
 * prestataire de son choix. Le rattachement à un séjour est justement un choix :
 * un ménage suit une réservation, une remise en état n'en concerne aucune.
 * L'ancienne est close dans le même geste, côté serveur, pour qu'il n'existe
 * jamais d'instant où l'une est fermée sans que l'autre existe.</p>
 */

export interface StuckServiceDialogProps {
  /** Prestation à ouvrir. `null` ferme la modale. */
  serviceRequestId: number | null;
  onClose: () => void;
  /** Une replanification volontaire ne suppose pas une recherche en échec. */
  schedulingOnly?: boolean;
  service?: {
    title?: string | null;
    propertyId?: number | null;
    propertyName?: string | null;
    /** `critical` quand la date souhaitée est déjà passée. */
    severity?: string | null;
  };
  /** Clés react-query à invalider après action. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function StuckServiceDialog({
  serviceRequestId,
  onClose,
  schedulingOnly = false,
  service,
  invalidateKeys = [],
}: StuckServiceDialogProps) {
  // En arabe, le calendrier hégirien (Umm al-Qura) n'est pas une traduction du
  // grégorien : c'est celui que lisent réellement les utilisateurs. La date
  // envoyée au serveur reste grégorienne — le composant ne change que
  // l'affichage, un `Date` reste un `Date`.
  const { t, isArabic, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const wideCalendar = useMediaQuery("(min-width: 768px)");
  const mobile = useMediaQuery('(max-width: 639px)');
  const [mobileStep, setMobileStep] = React.useState(1);
  const [mode, setMode] = React.useState<'idle' | 'reschedule'>('idle');
  const [day, setDay] = React.useState<Date | undefined>(undefined);
  const [time, setTime] = React.useState('10:00');
  const [assignee, setAssignee] = React.useState<string>('');

  // Le serveur attend « 2026-08-03T10:00 ». On compose à partir du jour cliqué
  // et de l'heure saisie, sans passer par `toISOString()` : celui-ci convertit
  // en UTC et décalerait le créneau d'une ou deux heures selon la saison.
  const desiredDate = React.useMemo(() => {
    if (!day) return '';
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return `${iso}T${time || '10:00'}`;
  }, [day, time]);

  // Chaque ouverture repart d'une page blanche : sans cela, la date saisie pour
  // la prestation precedente s'appliquerait a la suivante.
  React.useEffect(() => {
    setMode(schedulingOnly ? 'reschedule' : 'idle');
    setDay(undefined);
    setTime('10:00');
    setAssignee('');
    setMobileStep(1);
  }, [serviceRequestId, schedulingOnly]);

  // Minuit, et non l'instant présent : `before: new Date()` désactivait le jour
  // même, interdisant de replanifier pour cet après-midi.
  const startOfToday = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const open = serviceRequestId != null;
  const planning = mode === 'reschedule';

  // Chargés seulement quand on replanifie : ouvrir la modale pour clôturer ne
  // doit pas déclencher trois requêtes.
  //
  // `extractApiList` n'est pas une précaution de style : `/teams` et `/users`
  // renvoient une PAGE (`{content: […]}`), alors que leurs méthodes d'API
  // annoncent un tableau. Le type est affirmé à la main sur `apiClient.get<T>`,
  // donc rien ne l'a jamais contredit — et faire confiance à cette annonce
  // faisait tomber tout le bloc « À traiter » sur `teams.filter is not a function`.
  // Les prestataires proposés dépendent du créneau : la requête suit la date.
  const {
    data: assignable,
    isFetching: suggestionsLoading,
    error: suggestionsError,
  } = useQuery({
    queryKey: ['service-request', serviceRequestId, 'assignable-teams', desiredDate],
    queryFn: () => serviceRequestsApi.assignableTeams(serviceRequestId!, desiredDate),
    enabled: open && planning && desiredDate !== '',
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
    enabled: open && planning,
    staleTime: 60_000,
    retry: false,
  });
  const teamsById = React.useMemo(() => new Map(teams.map(team => [team.id, team])), [teams]);
  const suggestions = assignable?.teams ?? [];
  // Quand aucune équipe ne convient, c'est le TYPE requis qui manque à l'écran :
  // sans lui on ne distingue pas un manque d'équipe d'un manque de disponibilité.
  const requiredTeamType = assignable?.requiredTeamType ?? null;
  const requiredServiceLabel = useServiceReferenceLabel(requiredTeamType, requiredTeamType ? teamTypeLabel(requiredTeamType,t) : "");

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', 'by-property', service?.propertyId],
    queryFn: async () => extractApiList<Reservation>(
      await reservationsApi.getAll({ propertyIds: [service!.propertyId!] }),
    ),
    enabled: open && planning && service?.propertyId != null,
  });

  const invalidate = () =>
    // La ligne traitée doit disparaître tout de suite : on demande le recalcul
    // de la file avant d'invalider les vues qui la lisent.
    void refreshActionQueue(
      (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys);

  const close = useMutation({
    mutationFn: () => serviceRequestsApi.cancel(serviceRequestId!),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const reschedule = useMutation({
    mutationFn: () => {
      const [type, id] = assignee ? assignee.split(':') : [];
      return serviceRequestsApi.reschedule(serviceRequestId!, {
        // `datetime-local` rend « 2026-08-03T14:30 » — déjà le format attendu.
        desiredDate,
        assignedToId: id ? Number(id) : null,
        assignedToType: (type as 'user' | 'team') ?? null,
        reservationId: matchingStay?.id ?? null,
      });
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  /**
   * Le séjour qui couvre le jour choisi, s'il y en a un.
   *
   * <p>Bornes incluses des deux côtés : un ménage de départ a lieu le jour du
   * check-out, et une préparation le jour de l'arrivée. Les exclure rattacherait
   * à aucune réservation les deux cas les plus courants.</p>
   *
   * <p>Déduire plutôt que demander : une liste déroulante permettait de choisir
   * un séjour qui ne contient pas la date retenue, ce que le serveur aurait
   * accepté sans broncher.</p>
   */
  const matchingStay = React.useMemo(() => {
    if (!day) return null;
    const chosen = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return reservations.find(
      (stay) => stay.checkIn && stay.checkOut && stay.checkIn <= chosen && chosen <= stay.checkOut,
    ) ?? null;
  }, [day, reservations]);

  // Des candidats existent, mais tous occupés sur le créneau choisi.
  const allBusy = suggestions.length > 0 && suggestions.every((team) => !team.available);
  const busy = close.isPending || reschedule.isPending;
  const overdue = service?.severity === 'critical';
  const error = close.error ?? reschedule.error;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className={cn("baitly-service-dialog", planning && "baitly-service-dialog--planning")}>
        <DialogHeader className="baitly-service-dialog__header">
          <span className="baitly-service-dialog__symbol" aria-hidden="true"><CalendarClockIcon /></span>
          <div className="baitly-service-dialog__heading">
          <DialogTitle className="pe-8">
            {mobile && planning ? t('dashboard.stuckService.reschedule', 'Replanifier') : service?.title ?? t('dashboard.stuckService.fallback', 'Prestation en attente')}
          </DialogTitle>
          {service?.propertyName && <DialogDescription>{service.propertyName}</DialogDescription>}
          </div>
        </DialogHeader>
        {mobile && planning && <BaitlyFormSteps steps={[t('requestComposer.schedule'), t('dashboard.stuckService.assigneeLabel', 'Prestataire')]}
          current={mobileStep} reachable={[true, !!desiredDate]} onStepClick={setMobileStep} />}
        <div className="baitly-service-dialog__body">
        {mobile && planning && mobileStep === 1 && <p className="text-sm font-medium">{service?.title}</p>}

        {!schedulingOnly && (!mobile || mobileStep === 1) && <p className="m-0 text-sm text-muted-foreground">
          {overdue
            ? t(
                'dashboard.stuckService.overdue',
                'La date souhaitée est passée et aucun prestataire n’a été trouvé. La prestation n’a pas eu lieu.',
              )
            : t(
                'dashboard.stuckService.searchExhausted',
                'Aucun prestataire disponible n’a été trouvé. La recherche automatique s’est arrêtée : il faut assigner quelqu’un.',
              )}
        </p>}

        {planning && (
          <div className="baitly-service-planning" data-mobile-step={mobile ? mobileStep : undefined}>
            <div className="baitly-service-planning__schedule">
            {/* Présentation reprise de la galerie (Calendar + heure en pied de
                carte), sur DEUX mois : replanifier une prestation manquée se
                projette souvent au-delà du mois courant, et un seul mois
                obligeait à naviguer pour voir la semaine suivante. */}
            <Card size="sm" className="baitly-service-planning__calendar mx-auto w-fit">
              <CardContent>
                {/* Sans `locale`, react-day-picker retombe sur `enUS` : initiales
                    de jours en anglais et semaine ouverte au dimanche, meme en
                    francais. `weekStartsOn` porte la regle produit. */}
                <Calendar
                  mode="single"
                  numberOfMonths={wideCalendar ? 2 : 1}
                  locale={dateFnsLocale(currentLanguage)}
                  weekStartsOn={weekStartsOnForLanguage(currentLanguage)}
                  calendarSystem={isArabic ? 'hijri' : 'gregorian'}
                  selected={day}
                  onSelect={setDay}
                  disabled={{ before: startOfToday }}
                  className="p-0"
                />
              </CardContent>
              <CardFooter className="border-t bg-card">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="stuck-time">
                      {t('dashboard.stuckService.timeLabel', 'Heure')}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="stuck-time"
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
                </FieldGroup>
              </CardFooter>
            </Card>

            <div className="flex flex-col gap-1.5">
              <Label>{t('dashboard.stuckService.reservationLabel', 'Séjour concerné')}</Label>
              {!day ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {t('dashboard.stuckService.stayPending', 'Le séjour sera déduit de la date choisie.')}
                </p>
              ) : matchingStay ? (
                <p className="m-0 text-sm text-foreground">
                  {t('dashboard.stuckService.stayMatched', {
                    guest: matchingStay.guestName ?? '—',
                    defaultValue: 'Rattachée au séjour de {{guest}}',
                  })}
                  <span className="ms-1 text-muted-foreground">
                    {`(${matchingStay.checkIn} → ${matchingStay.checkOut})`}
                  </span>
                </p>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  {t(
                    'dashboard.stuckService.stayNone',
                    'Aucun séjour ce jour-là : la prestation ne sera rattachée à aucune réservation.',
                  )}
                </p>
              )}
            </div>
            </div>
            <div className="baitly-service-planning__providers">
            <p className="m-0 text-xs text-muted-foreground">
              {t(
                'dashboard.stuckService.availabilityHint',
                'Les prestataires proposés dépendent de ce créneau et de la zone du logement.',
              )}
            </p>

            <div className="flex flex-col gap-1.5">
              <Label>{t('dashboard.stuckService.assigneeLabel', 'Prestataire')}</Label>

              {!desiredDate ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {t('dashboard.stuckService.pickDateFirst', 'Choisissez une date pour voir qui est disponible.')}
                </p>
              ) : suggestionsLoading ? (
                <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> {t('dashboard.stuckService.searching', 'Recherche des disponibilités…')}
                </p>
              ) : suggestionsError ? (
                /* Une requête en échec n'est pas une absence de prestataire :
                   annoncer « aucune équipe » ferait conclure à tort qu'il n'y a
                   personne, alors que la question n'a pas pu être posée. */
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertDescription>
                    {getErrorMessage(
                      suggestionsError,
                      t('dashboard.stuckService.suggestionsFailed',
                        'Impossible de consulter les disponibilités.'),
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-1">
                  {/* Des équipes couvrent bien le logement, mais aucune n'est
                      libre sur ce créneau. Le dire d'un bloc : sans cela,
                      l'opérateur lit une liste de « Occupée » sans comprendre
                      que c'est l'heure choisie qui bloque, pas le logement. */}
                  {allBusy && (
                    <Alert>
                      <TriangleAlertIcon />
                      <AlertDescription>
                        {t(
                          'serviceReference.noneEligible',
                          'Aucune équipe ne remplit les conditions actuelles. Vérifiez le motif indiqué ou choisissez une autre date.',
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  {/* Laisser chercher reste le choix par défaut : c'est le
                      comportement du produit, et il retrouvera un prestataire
                      si l'agenda se libère d'ici là. */}
                  <SuggestionRow
                    label={t('dashboard.stuckService.assigneeAuto', 'Laisser chercher automatiquement')}
                    selected={assignee === ''}
                    onSelect={() => setAssignee('')}
                  />
                  {suggestions.map((team) => (
                    <SuggestionRow
                      key={team.teamId}
                      label={team.name}
                      team={teamsById.get(team.teamId)}
                      badge={
                        team.origin === 'DEFAULT'
                          ? t('dashboard.stuckService.originDefault', 'Attitrée')
                          : team.origin === 'ZONE'
                            ? t('dashboard.stuckService.originZone', 'Zone')
                            : t('dashboard.stuckService.originOther', 'Hors zone')
                      }
                      hint={
                        team.available
                          ? t('dashboard.stuckService.free', 'Disponible')
                          : team.reason ? t('serviceReference.reason.' + team.reason) : t('dashboard.stuckService.busy', {
                              defaultValue: 'Indisponible sur ce créneau',
                            })
                      }
                      muted={!team.available}
                      selected={assignee === `team:${team.teamId}`}
                      onSelect={() => setAssignee(`team:${team.teamId}`)}
                    />
                  ))}
                  {suggestions.length === 0 && (
                    <p className="m-0 text-sm text-muted-foreground">
                      {requiredTeamType
                        ? t('dashboard.stuckService.needsTeamType', {
                            type: requiredServiceLabel,
                            defaultValue:
                              'Cette prestation demande une équipe de type « {{type}} ». '
                              + 'Votre organisation n’en a aucune.',
                          })
                        : t(
                            'dashboard.stuckService.noneAvailable',
                            'Aucune équipe compatible avec ce type de prestation dans votre organisation.',
                          )}
                    </p>
                  )}
                </div>
              )}
            </div>


            </div>
          </div>
        )}

        {error != null && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {getErrorMessage(error, t('dashboard.stuckService.failed', 'L’action a échoué. Réessayez.'))}
            </AlertDescription>
          </Alert>
        )}

        </div>
        <DialogFooter className="sm:justify-between">
          {mobile && planning ? <div className="flex items-center gap-1"><Button variant="ghost" onClick={() => mobileStep > 1 ? setMobileStep(1) : onClose()} disabled={busy}>
            {t(mobileStep > 1 ? 'reservations.dialog.previous' : 'common.cancel')}
          </Button><Button variant="ghost" size="icon" onClick={() => close.mutate()} disabled={busy}
            title={t('dashboard.stuckService.close', 'Clôturer définitivement')}
            aria-label={t('dashboard.stuckService.close', 'Clôturer définitivement')}>
            {close.isPending ? <Spinner /> : <XCircleIcon />}
          </Button></div> :
          <Button variant="ghost" onClick={() => close.mutate()} disabled={busy}>
            {close.isPending ? <Spinner /> : <XCircleIcon />}
            {t('dashboard.stuckService.close', 'Clôturer définitivement')}
          </Button>}

          {planning ? (
            <Button onClick={() => mobile && mobileStep === 1 ? setMobileStep(2) : reschedule.mutate()} disabled={busy || !desiredDate}>
              {reschedule.isPending ? <Spinner /> : <CheckIcon />}
              {mobile && mobileStep === 1 ? t('reservations.dialog.next') : t('dashboard.stuckService.confirmReschedule', 'Replanifier')}
            </Button>
          ) : (
            <Button onClick={() => setMode('reschedule')} disabled={busy}>
              <CalendarClockIcon />
              {t('dashboard.stuckService.reschedule', 'Replanifier')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Une proposition de prestataire.
 *
 * Une ligne cliquable plutôt qu'une liste déroulante : le choix se fait sur
 * trois informations — le nom, pourquoi cette équipe est proposée, et si elle
 * est libre — qu'un `Select` réduirait à une seule.
 */
function SuggestionRow({
  label,
  badge,
  hint,
  muted,
  selected,
  onSelect,
  team,
}: {
  label: string;
  team?: Team;
  badge?: string;
  hint?: string;
  /** Occupée sur le créneau : proposée quand même, mais en retrait. */
  muted?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'baitly-service-planning__suggestion cursor-pointer rounded-md px-3 py-2.5 text-start text-sm outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
        selected && 'is-selected',
        muted && 'text-muted-foreground',
      )}
    >
      {badge ? <ProviderAvatars team={team} label={label} /> : <span className="baitly-service-planning__automatic" aria-hidden="true"><CalendarClockIcon /></span>}
      <span className="baitly-service-planning__identity">
        <span className="baitly-service-planning__name">{label}</span>
        {hint && <span className="baitly-service-planning__reason text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="baitly-service-planning__status">
        {badge && <Badge variant="outline">{badge}</Badge>}
        {selected && <CheckIcon aria-hidden="true" className="size-4" />}
      </span>
    </button>
  );
}

function ProviderAvatars({ team, label }: { team?: Team; label: string }) {
  const members = team?.members ?? [];
  const visible = members.slice(0, 3);
  const remaining = Math.max(0, (team?.memberCount ?? members.length) - visible.length);
  const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return (
    <span className="baitly-service-planning__avatars" aria-hidden="true">
      {visible.length ? visible.map(member => {
        const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.userName || label;
        return <Avatar key={member.id} title={name}>
          {member.avatarUrl && <AvatarImage src={resolveMediaUrl(member.avatarUrl)} alt="" />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>;
      }) : <Avatar><AvatarFallback>{initials(label)}</AvatarFallback></Avatar>}
      {remaining > 0 && <span className="baitly-service-planning__avatar-count">+{remaining}</span>}
    </span>
  );
}

/**
 * Nom lisible d'un type d'équipe.
 *
 * <p>Le serveur renvoie la clé technique ; l'afficher telle quelle
 * (« MAINTENANCE ») donnerait un message d'erreur, pas une explication.</p>
 */
function teamTypeLabel(type: string, t: (key: string, fallback: string) => string): string {
  if (type === 'CLEANING') return t('teamType.cleaning', 'Ménage');
  if (type === 'MAINTENANCE') return t('teamType.maintenance', 'Maintenance');
  return type === 'OTHER' ? t('teamType.other', 'Autre') : type;
}
