import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FilterAltOff as FilterAltOffIcon } from '@mui/icons-material';
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
import { interventionsApi, Intervention } from '../../services/api';
import { extractApiList } from '../../types';
import type { ApiError } from '../../services/apiClient';
import {
  INTERVENTION_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../types/statusEnums';
import { INTERVENTION_TYPE_OPTIONS } from '../../types/interventionTypes';

// ---------------------------------------------------------------------------
// Color mapping: intervention status -> hex color for FullCalendar events
// ---------------------------------------------------------------------------
const getStatusColorHex = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return '#ed6c02';
    case 'IN_PROGRESS':
      return '#0288d1';
    case 'COMPLETED':
      return '#2e7d32';
    case 'CANCELLED':
      return '#d32f2f';
    case 'AWAITING_VALIDATION':
      return '#9c27b0';
    case 'AWAITING_PAYMENT':
      return '#ff9800';
    default:
      return '#757575';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      setInterventions(extractApiList<Intervention>(data));
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
      .filter((intervention) => {
        if (!intervention || !intervention.id) return false;
        if (selectedStatus !== 'all' && intervention.status !== selectedStatus) return false;
        if (selectedType !== 'all' && intervention.type !== selectedType) return false;
        if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) return false;
        return true;
      })
      .filter((intervention) => !!intervention.scheduledDate)
      .map(mapToEvent);
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
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Planning des interventions"
        subtitle="Vue calendrier de toutes les interventions planifiees"
        backPath="/interventions"
        showBackButton={false}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* Filter bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '0.875rem' }}>Statut</InputLabel>
            <Select
              value={selectedStatus}
              label="Statut"
              onChange={(e) => setSelectedStatus(e.target.value)}
              sx={{ fontSize: '0.875rem' }}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.875rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '0.875rem' }}>Type</InputLabel>
            <Select
              value={selectedType}
              label="Type"
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{ fontSize: '0.875rem' }}
            >
              {typeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.875rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '0.875rem' }}>Priorite</InputLabel>
            <Select
              value={selectedPriority}
              label="Priorite"
              onChange={(e) => setSelectedPriority(e.target.value)}
              sx={{ fontSize: '0.875rem' }}
            >
              {priorityOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.875rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<FilterAltOffIcon />}
              onClick={clearFilters}
              sx={{ textTransform: 'none', fontSize: '0.875rem' }}
            >
              Effacer les filtres
            </Button>
          )}

          <Box sx={{ ml: 'auto' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              {events.length} intervention{events.length > 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Calendar */}
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={40} />
        </Box>
      ) : (
        <Paper sx={{ p: 2 }}>
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
        </Paper>
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
    </Box>
  );
}
