import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Close,
  Info,
  Build,
  AccountBalance,
  History,
  MoreHoriz,
} from '@mui/icons-material';
import type { PlanningEvent, PanelTab, PlanningProperty } from './types';
import type { PlanningIntervention } from '../../services/api';
import PanelReservationInfo from './PlanningActionPanel/PanelReservationInfo';
import PanelOperations from './PlanningActionPanel/PanelOperations';
import PanelFinancial from './PlanningActionPanel/PanelFinancial';
import PanelHistory from './PlanningActionPanel/PanelHistory';
import PanelActions from './PlanningActionPanel/PanelActions';
import { ACTION_PANEL_WIDTH } from './constants';
import { hexToRgba } from './utils/colorUtils';

interface PlanningActionPanelProps {
  open: boolean;
  event: PlanningEvent | null;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  allEvents: PlanningEvent[];
  properties?: PlanningProperty[];
  interventions?: PlanningIntervention[];
  onUpdateReservation?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
  onChangeProperty?: (reservationId: number, newPropertyId: number, newPropertyName: string) => Promise<{ success: boolean; error: string | null }>;
  onCancelReservation?: (reservationId: number) => Promise<{ success: boolean; error: string | null }>;
  onUpdateNotes?: (reservationId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
  // Intervention actions
  onCreateAutoCleaning?: (reservationId: number) => Promise<{ success: boolean; error: string | null }>;
  onCreateIntervention?: (data: {
    propertyId: number;
    propertyName: string;
    type: 'cleaning' | 'maintenance';
    title: string;
    assigneeName: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    estimatedDurationHours: number;
    notes?: string;
    linkedReservationId?: number;
  }) => Promise<{ success: boolean; error: string | null }>;
  onAssignIntervention?: (interventionId: number, assigneeName: string) => Promise<{ success: boolean; error: string | null }>;
  onSetPriority?: (interventionId: number, priority: 'normale' | 'haute' | 'urgente') => Promise<{ success: boolean; error: string | null }>;
  onUpdateInterventionNotes?: (interventionId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
  // Actions (PanelActions)
  onDuplicateReservation?: (reservationId: number, newCheckIn: string, newCheckOut: string) => Promise<{ success: boolean; error: string | null }>;
}

const TAB_CONFIG: { value: PanelTab; label: string; icon: React.ReactElement }[] = [
  { value: 'info', label: 'Infos', icon: <Info sx={{ fontSize: 16 }} /> },
  { value: 'operations', label: 'Operations', icon: <Build sx={{ fontSize: 16 }} /> },
  { value: 'financial', label: 'Financier', icon: <AccountBalance sx={{ fontSize: 16 }} /> },
  { value: 'history', label: 'Historique', icon: <History sx={{ fontSize: 16 }} /> },
];

const PlanningActionPanel: React.FC<PlanningActionPanelProps> = ({
  open,
  event,
  activeTab,
  onTabChange,
  onClose,
  allEvents,
  properties,
  interventions,
  onUpdateReservation,
  onChangeProperty,
  onCancelReservation,
  onUpdateNotes,
  onCreateAutoCleaning,
  onCreateIntervention,
  onAssignIntervention,
  onSetPriority,
  onUpdateInterventionNotes,
  onDuplicateReservation,
}) => {
  const theme = useTheme();

  if (!event) return null;

  const isReservation = event.type === 'reservation';
  const title = isReservation ? event.label : event.label;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: ACTION_PANEL_WIDTH,
          borderLeft: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          boxShadow: theme.palette.mode === 'dark'
            ? '-8px 0 24px rgba(0,0,0,0.3)'
            : '-8px 0 24px rgba(0,0,0,0.08)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: hexToRgba(event.color, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 4,
              height: 32,
              borderRadius: 2,
              backgroundColor: event.color,
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
              {isReservation ? 'Reservation' : event.type === 'cleaning' ? 'Menage' : 'Maintenance'}
              {' · '}
              {event.startDate} → {event.endDate}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ flexShrink: 0 }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => onTabChange(value)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 40,
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: '0.01em',
            py: 0.5,
          },
          '& .MuiTab-root .MuiTab-iconWrapper': {
            marginBottom: 0,
            marginRight: 0.5,
          },
        }}
      >
        {TAB_CONFIG.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
          />
        ))}
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 'info' && (
          event.type === 'reservation'
            ? <PanelReservationInfo event={event} allEvents={allEvents} properties={properties} onUpdateReservation={onUpdateReservation} onChangeProperty={onChangeProperty} onCancelReservation={onCancelReservation} onUpdateNotes={onUpdateNotes} />
            : <PanelOperations event={event} allEvents={allEvents} interventions={interventions} onCreateAutoCleaning={onCreateAutoCleaning} onCreateIntervention={onCreateIntervention} onAssignIntervention={onAssignIntervention} onSetPriority={onSetPriority} onUpdateInterventionNotes={onUpdateInterventionNotes} />
        )}
        {activeTab === 'operations' && <PanelOperations event={event} allEvents={allEvents} interventions={interventions} onCreateAutoCleaning={onCreateAutoCleaning} onCreateIntervention={onCreateIntervention} onAssignIntervention={onAssignIntervention} onSetPriority={onSetPriority} onUpdateInterventionNotes={onUpdateInterventionNotes} />}
        {activeTab === 'financial' && <PanelFinancial event={event} />}
        {activeTab === 'history' && (
          <>
            <PanelHistory event={event} />
            <Divider sx={{ my: 2 }} />
            <PanelActions
              event={event}
              allEvents={allEvents}
              onUpdateReservation={onUpdateReservation}
              onUpdateNotes={onUpdateNotes}
              onCreateIntervention={onCreateIntervention}
              onDuplicateReservation={onDuplicateReservation}
            />
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default PlanningActionPanel;
