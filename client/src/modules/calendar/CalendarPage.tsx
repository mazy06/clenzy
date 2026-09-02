import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { Skeleton, NativeSelect, NativeSelectOption } from '../../components/ui';
import { useIsMobile } from '../../hooks/use-mobile';
import { FilterAltOff as FilterAltOffIcon, CalendarMonth } from '../../icons';
import EmptyState from '../../components/EmptyState';
import './calendarSignature.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import { cn } from '../../utils/cn';
import PageHeader from '../../components/PageHeader';
import CalendarEventDialog from './CalendarEventDialog';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { interventionsApi, Intervention } from '../../services/api/interventionsApi';
import type { ApiError } from '../../services/apiClient';
import {
  INTERVENTION_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../types/statusEnums';
import { INTERVENTION_TYPE_OPTIONS } from '../../types/interventionTypes';

// ---------------------------------------------------------------------------
// Couleur d'un evenement FullCalendar depuis le statut d'INTERVENTION.
//
// Ces statuts empruntaient les hex de la palette des briques du planning, avec
// un commentaire qui s'en reclamait. Deux problemes : ce ne sont pas les memes
// statuts (une intervention n'est pas un sejour), et des hex figes ne suivent
// pas le theme — le calendrier gardait des couleurs de mode clair en sombre.
//
// Ils pointent desormais les jetons SEMANTIQUES, qui disent exactement ce que
// chaque statut signifie et se retintent avec le theme. FullCalendar accepte
// une var() comme couleur d'evenement.
// ---------------------------------------------------------------------------
const getStatusColorHex = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'var(--warn)';
    case 'IN_PROGRESS':
      return 'var(--info)';
    case 'COMPLETED':
      return 'var(--ok)';
    case 'CANCELLED':
      return 'var(--bui-faint)';
    case 'AWAITING_VALIDATION':
      // Pas de jeton semantique pour « en attente de validation » : l'accent
      // marque l'action attendue de l'utilisateur, sans inventer une teinte.
      return 'var(--accent)';
    case 'AWAITING_PAYMENT':
      // Correspondance exacte : le jeton existe pour l'etat « non regle ».
      return 'var(--unpaid)';
    default:
      return 'var(--bui-muted-foreground)';
  }
};

// ---------------------------------------------------------------------------
// Map an Intervention to a FullCalendar EventInput
// ---------------------------------------------------------------------------
const mapToEvent = (intervention: Intervention, compact: boolean): EventInput => {
  const start = new Date(intervention.scheduledDate);
  const end = new Date(
    start.getTime() + (intervention.estimatedDurationHours || 1) * 60 * 60 * 1000,
  );
  const color = getStatusColorHex(intervention.status);

  // Une mission qui deborde sur le lendemain devenait un ruban traversant
  // plusieurs cellules, decoupe en segments : la meme intervention paraissait
  // en etre trois. On la garde dans SA journee et on ecrit sa duree — un
  // nombre de jours se lit mieux qu'il ne se devine a une geometrie.
  const finDeJournee = new Date(start);
  finDeJournee.setHours(23, 59, 59, 999);
  const debordement = end > finDeJournee;
  const joursCouverts = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
  );

  return {
    id: String(intervention.id),
    title: intervention.title,
    start: start.toISOString(),
    // Le MOIS compacte : une mission y reste dans sa cellule, sa duree ecrite
    // en toutes lettres. La semaine et le jour gardent l'etendue reelle — c'est
    // precisement ce qu'on va y lire.
    end: (compact && debordement ? finDeJournee : end).toISOString(),
    // Le rendu passe par `eventContent` : la couleur du statut sert de PASTILLE,
    // pas d'aplat. Un aplat sature par ligne rendait la grille illisible des
    // qu'un jour portait trois missions.
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    extendedProps: {
      intervention,
      statusColor: color,
      // Duree reelle, conservee : seul l'AFFICHAGE est ramene a la journee.
      joursCouverts: compact && debordement ? joursCouverts : 1,
      finReelle: end.toISOString(),
    },
  };
};

/**
 * Une mission dans la grille.
 *
 * <p>Rendu unique pour toutes les vues : une pastille de statut, l'heure en
 * chiffres tabulaires, puis l'intitule tronque proprement. Le libelle etait
 * coupe en plein mot et les couleurs de statut noyaient la grille sous des
 * aplats satures.</p>
 */
function renderEvent(arg: EventContentArg) {
  const couleur = (arg.event.extendedProps.statusColor as string) ?? 'var(--bui-muted-foreground)';
  const jours = (arg.event.extendedProps.joursCouverts as number) ?? 1;

  return (
    <div
      className="flex h-[22px] min-w-0 items-center gap-1.5 overflow-hidden rounded-md border border-solid px-1.5 transition-colors duration-150"
      title={`${arg.timeText} ${arg.event.title}`}
      style={{
        // Teinte de statut discrete + un filet de la meme couleur : la brique
        // se detache de la cellule sans aplat sature, et le libelle reste en
        // encre normale au lieu de passer en blanc sur fond plein.
        backgroundColor: `color-mix(in oklch, ${couleur} 14%, transparent)`,
        borderColor: `color-mix(in oklch, ${couleur} 32%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: couleur }}
      />
      {arg.timeText && (
        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
          {arg.timeText}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
        {arg.event.title}
      </span>
      {/* La mission court au-dela de la journee : on l'ecrit plutot que de
          l'etaler sur les cellules suivantes. */}
      {jours > 1 && (
        <span className="shrink-0 rounded bg-card/70 px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {jours} j
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarPage component
// ---------------------------------------------------------------------------
interface CalendarPageProps {
  /**
   * Monte en ONGLET de la page Interventions (`WorkOrdersPage`) : pas de
   * `PageHeader` propre, les filtres partent dans le slot du header commun.
   * Meme contrat que `InterventionsList` / `IssuesList`.
   */
  embedded?: boolean;
  filtersContainer?: HTMLElement | null;
}

export default function CalendarPage({ embedded = false, filtersContainer }: CalendarPageProps = {}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Le palier `sm` de MUI vaut 600 px — useIsMobile prend le seuil en parametre.
  const isMobile = useIsMobile(600);

  // Data state
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  // -----------------------------------------------------------------------
  // Fetch interventions
  // -----------------------------------------------------------------------
  const loadInterventions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await interventionsApi.getAll();
      setInterventions(data);
    } catch (err: unknown) {
      setInterventions([]);
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as ApiError).status : undefined;
      if (status === 401) {
        setError("Erreur d'authentification. Veuillez vous reconnecter.");
      } else if (status === 403) {
        setError("Acces interdit. Vous n'avez pas les permissions necessaires.");
      } else {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des interventions');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterventions();
  }, [loadInterventions]);

  // -----------------------------------------------------------------------
  // Filter + map to events
  // -----------------------------------------------------------------------
  // Seule la grille du mois compacte les missions ; `datesSet` la suit, y
  // compris quand l'utilisateur change de vue depuis la barre d'outils.
  const [vueCompacte, setVueCompacte] = useState(!isMobile);

  const events = useMemo<EventInput[]>(() => {
    if (!Array.isArray(interventions)) return [];

    return interventions
      .flatMap((intervention) => {
        if (!intervention || !intervention.id) return [];
        if (selectedStatus !== 'all' && intervention.status !== selectedStatus) return [];
        if (selectedType !== 'all' && intervention.type !== selectedType) return [];
        if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) return [];
        if (!intervention.scheduledDate) return [];
        return [mapToEvent(intervention, vueCompacte)];
      });
  }, [interventions, selectedStatus, selectedType, selectedPriority, vueCompacte]);

  // -----------------------------------------------------------------------
  // Event click handler
  // -----------------------------------------------------------------------
  const handleEventClick = useCallback((info: EventClickArg) => {
    const intervention = info.event.extendedProps.intervention as Intervention;
    if (intervention) {
      setSelectedIntervention(intervention);
      setDialogOpen(true);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Filter options
  // -----------------------------------------------------------------------
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les statuts' },
      ...INTERVENTION_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    ],
    [],
  );

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les types' },
      ...INTERVENTION_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    ],
    [],
  );

  const priorityOptions = useMemo(
    () => [
      { value: 'all', label: 'Toutes les priorites' },
      ...PRIORITY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    ],
    [],
  );

  const hasActiveFilters =
    selectedStatus !== 'all' || selectedType !== 'all' || selectedPriority !== 'all';

  const clearFilters = () => {
    setSelectedStatus('all');
    setSelectedType('all');
    setSelectedPriority('all');
  };

  // -----------------------------------------------------------------------
  // Loading / error states
  // -----------------------------------------------------------------------
  if (!user) {
    return <Skeleton className="h-[420px] rounded-lg" />;
  }

  // Filtres : portés par le slot `filters` du PageHeader (pattern des écrans
  // finalisés — pas de Paper de filtres orphelin).
  const filterBar = (
    <div className="flex flex-wrap gap-2 items-center w-full">
      {/* Filtres sans libelle visible : chaque option porte deja son intitule
          (« Tous les statuts », « Tous les types »…), l'aria-label reste la
          seule etiquette accessible — pattern des barres de filtres du PMS. */}
      <NativeSelect
        size="sm"
        className="min-w-[160px]"
        aria-label="Statut"
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
      >
        {statusOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <NativeSelect
        size="sm"
        className="min-w-[160px]"
        aria-label="Type"
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
      >
        {typeOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <NativeSelect
        size="sm"
        className="min-w-[160px]"
        aria-label="Priorite"
        value={selectedPriority}
        onChange={(e) => setSelectedPriority(e.target.value)}
      >
        {priorityOptions.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {hasActiveFilters && (
        <Button size="sm" variant="ghost" onClick={clearFilters}>
          <FilterAltOffIcon size={14} strokeWidth={1.75} />
          Effacer les filtres
        </Button>
      )}

      <div className="ms-auto">
        <p className="text-xs text-muted-foreground tabular-nums">
          {events.length} intervention{events.length > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {embedded ? (
        filtersContainer && createPortal(filterBar, filtersContainer)
      ) : (
        <PageHeader
          className="shrink-0"
          title="Planning des interventions"
          subtitle="Vue calendrier de toutes les interventions planifiees"
          iconBadge={<CalendarMonth />}
          backPath="/interventions"
          showBackButton={false}
          filters={filterBar}
        />
      )}

      {error && (
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Calendar */}
      {loading ? (
        <Skeleton className="min-h-0 flex-1 rounded-lg" />
      ) : !error && interventions.length === 0 ? (
        <EmptyState
          icon={<CalendarMonth />}
          title="Aucune intervention planifiee"
          description="Les interventions planifiees (menage, maintenance, check-in/out) apparaitront ici dans une vue calendrier."
        />
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0 cal-signature p-3">
          {/* La grille prend la hauteur restante : c'est ce conteneur qui la
              porte, pour que le `height="100%"` de FullCalendar se resolve. */}
          <div className="min-h-0 flex-1">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
              locale={frLocale}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: isMobile
                  ? 'listWeek,dayGridMonth'
                  : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              events={events}
              eventClick={handleEventClick}
              // Sans cela, FullCalendar rend un POINT pour un evenement tenant
              // dans la journee et une BARRE pleine pour celui qui franchit
              // minuit : deux styles pour la meme chose, dans la meme grille.
              eventDisplay="block"
              eventContent={renderEvent}
              datesSet={(info) => setVueCompacte(info.view.type === 'dayGridMonth')}
              height={isMobile ? 'auto' : '100%'}
              editable={false}
              selectable={false}
              // `true` = le nombre d'evenements visibles suit la hauteur reelle de
              // la cellule (le reste passe en « +N autres »), au lieu d'un palier fixe.
              dayMaxEvents={isMobile ? 3 : true}
              moreLinkText={(n) => `+${n} autres`}
              noEventsText="Aucune intervention planifiee"
              allDaySlot={false}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false,
              }}
              buttonText={{
                today: "Aujourd'hui",
                month: 'Mois',
                week: 'Semaine',
                day: 'Jour',
                list: 'Liste',
              }}
            />
          </div>
        </Card>
      )}

      {/* Event detail dialog */}
      <CalendarEventDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedIntervention(null);
        }}
        intervention={selectedIntervention}
      />
    </div>
  );
}
