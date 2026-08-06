import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { EventClickArg, EventInput } from '@fullcalendar/core';
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
// Color mapping: intervention status -> couleur d'évènement FullCalendar.
// Palette VALIDÉE planning (constantes locales planning-grid-reference.css) :
// ambre = en attente, bleu = en cours, vert = terminé, mauve = validation.
// Annulée = fantôme neutre (équivalent de la brique hachurée du planning).
// ---------------------------------------------------------------------------
const getStatusColorHex = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return '#C28A52';
    case 'IN_PROGRESS':
      return '#4F86C6';
    case 'COMPLETED':
      return '#3E9C80';
    case 'CANCELLED':
      return 'var(--bui-faint)';
    case 'AWAITING_VALIDATION':
      return '#9A7FA3';
    case 'AWAITING_PAYMENT':
      return '#C28A52';
    default:
      return 'var(--bui-muted-foreground)';
  }
};

// ---------------------------------------------------------------------------
// Map an Intervention to a FullCalendar EventInput
// ---------------------------------------------------------------------------
const mapToEvent = (intervention: Intervention): EventInput => {
  const start = new Date(intervention.scheduledDate);
  const end = new Date(
    start.getTime() + (intervention.estimatedDurationHours || 1) * 60 * 60 * 1000,
  );
  const color = getStatusColorHex(intervention.status);

  return {
    id: String(intervention.id),
    title: intervention.title,
    start: start.toISOString(),
    end: end.toISOString(),
    backgroundColor: color,
    borderColor: color,
    extendedProps: { intervention },
  };
};

// ---------------------------------------------------------------------------
// CalendarPage component
// ---------------------------------------------------------------------------
export default function CalendarPage() {
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
  const events = useMemo<EventInput[]>(() => {
    if (!Array.isArray(interventions)) return [];

    return interventions
      .flatMap((intervention) => {
        if (!intervention || !intervention.id) return [];
        if (selectedStatus !== 'all' && intervention.status !== selectedStatus) return [];
        if (selectedType !== 'all' && intervention.type !== selectedType) return [];
        if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) return [];
        if (!intervention.scheduledDate) return [];
        return [mapToEvent(intervention)];
      });
  }, [interventions, selectedStatus, selectedType, selectedPriority]);

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
    <div>
      <PageHeader
        title="Planning des interventions"
        subtitle="Vue calendrier de toutes les interventions planifiees"
        iconBadge={<CalendarMonth />}
        backPath="/interventions"
        showBackButton={false}
        filters={filterBar}
      />

      {error && (
        <Alert variant="destructive" className="mb-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Calendar */}
      {loading ? (
        <Skeleton className="h-[calc(100vh-320px)] min-h-[400px] rounded-lg" />
      ) : !error && interventions.length === 0 ? (
        <EmptyState
          icon={<CalendarMonth />}
          title="Aucune intervention planifiee"
          description="Les interventions planifiees (menage, maintenance, check-in/out) apparaitront ici dans une vue calendrier."
        />
      ) : (
        <Card className="gap-0 py-0 cal-signature p-3">
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
            height={isMobile ? 'auto' : 'calc(100vh - 320px)'}
            editable={false}
            selectable={false}
            dayMaxEvents={3}
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
