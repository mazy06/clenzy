import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Button,
  TablePagination,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Description as DescriptionIcon,
  Build as BuildIcon,
  SupportAgent as SupportIcon,
  CheckCircle as CheckCircleIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
  Inbox as InboxIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Home as HomeIcon,
  SquareFoot as SquareFootIcon,
  People as PeopleIcon,
  CalendarMonth as CalendarIcon,
  CleaningServices as CleaningIcon,
  MiscellaneousServices as ServicesIcon,
  RequestQuote as QuoteIcon,
  Sync as SyncIcon,
  EventRepeat as EventRepeatIcon,
  Schedule as ScheduleIcon,
  Handyman as HandymanIcon,
  PriorityHigh as UrgencyIcon,
  Subject as SubjectIcon,
  ChatBubbleOutline as MessageIcon,
  Apartment as ApartmentIcon,
} from '@mui/icons-material';
import type { ReceivedForm } from '../../services/api/receivedFormsApi';
import { useReceivedForms, useUpdateFormStatus, useResetFormsAvailability } from '../../hooks/useReceivedForms';

// ─── Config types & statuts (PMS soft-filled design system) ─────────────────

const FORM_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DEVIS: { label: 'Devis', color: '#0288d1', icon: <DescriptionIcon sx={{ fontSize: 14 }} /> },
  MAINTENANCE: { label: 'Maintenance', color: '#ED6C02', icon: <BuildIcon sx={{ fontSize: 14 }} /> },
  SUPPORT: { label: 'Support', color: '#4A9B8E', icon: <SupportIcon sx={{ fontSize: 14 }} /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Nouveau', color: '#ED6C02' },
  READ: { label: 'Lu', color: '#0288d1' },
  PROCESSED: { label: 'Traite', color: '#4A9B8E' },
  ARCHIVED: { label: 'Archive', color: '#757575' },
};

// ─── Labels devis ────────────────────────────────────────────────────────────

const DEVIS_LABELS: Record<string, string> = {
  propertyType: 'Type de bien', propertyCount: 'Nombre de logements', guestCapacity: 'Capacite voyageurs',
  surface: 'Surface (m\u00B2)', bookingFrequency: 'Frequence reservations', cleaningSchedule: 'Planning menage',
  services: 'Services forfait', servicesDevis: 'Services sur devis', calendarSync: 'Synchro calendrier',
  fullName: 'Nom complet', email: 'Email', phone: 'Telephone', city: 'Ville', postalCode: 'Code postal',
};

const MAINTENANCE_LABELS: Record<string, string> = {
  selectedWorks: 'Travaux demandes', customNeed: 'Besoin personnalise', description: 'Description',
  urgency: 'Urgence', fullName: 'Nom complet', email: 'Email', phone: 'Telephone',
  city: 'Ville', postalCode: 'Code postal',
};

const SUPPORT_LABELS: Record<string, string> = {
  name: 'Nom', email: 'Email', phone: 'Telephone', subject: 'Sujet', message: 'Message',
};

// ─── Field icons & colors ────────────────────────────────────────────────────

const FIELD_META: Record<string, { icon: React.ReactNode; color: string }> = {
  propertyType: { icon: <HomeIcon />, color: '#0288d1' },
  propertyCount: { icon: <ApartmentIcon />, color: '#5C6BC0' },
  guestCapacity: { icon: <PeopleIcon />, color: '#AB47BC' },
  surface: { icon: <SquareFootIcon />, color: '#00897B' },
  bookingFrequency: { icon: <EventRepeatIcon />, color: '#F4511E' },
  cleaningSchedule: { icon: <ScheduleIcon />, color: '#8E24AA' },
  services: { icon: <CleaningIcon />, color: '#4A9B8E' },
  servicesDevis: { icon: <QuoteIcon />, color: '#E65100' },
  calendarSync: { icon: <SyncIcon />, color: '#1565C0' },
  selectedWorks: { icon: <HandymanIcon />, color: '#EF6C00' },
  customNeed: { icon: <ServicesIcon />, color: '#7B1FA2' },
  description: { icon: <MessageIcon />, color: '#546E7A' },
  urgency: { icon: <UrgencyIcon />, color: '#D32F2F' },
  subject: { icon: <SubjectIcon />, color: '#1565C0' },
  message: { icon: <MessageIcon />, color: '#546E7A' },
};

const DEFAULT_FIELD_META = { icon: <ServicesIcon />, color: '#78909C' };

// ─── Value formatters ────────────────────────────────────────────────────────

const DEVIS_VALUE_LABELS: Record<string, Record<string, string>> = {
  propertyType: {
    studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4+', maison: 'Maison', villa: 'Villa',
  },
  bookingFrequency: {
    'tres-frequent': 'Tres frequent', frequent: 'Frequent', occasionnel: 'Occasionnel', rare: 'Rare',
  },
  cleaningSchedule: {
    'apres-depart': 'Apres chaque depart', quotidien: 'Quotidien', hebdomadaire: 'Hebdomadaire',
  },
  calendarSync: {
    sync: 'Synchronise', manual: 'Manuel', none: 'Aucun',
  },
  urgency: {
    low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique',
  },
};

function formatFieldValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map(v => formatFieldValue(key, v)).join(', ');
  const str = String(value);
  return DEVIS_VALUE_LABELS[key]?.[str] || str.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Grouping devis fields into sections ─────────────────────────────────────

interface FieldGroup {
  title: string;
  fields: string[];
  color: string;
}

const DEVIS_GROUPS: FieldGroup[] = [
  { title: 'Bien', fields: ['propertyType', 'surface', 'guestCapacity', 'propertyCount'], color: '#0288d1' },
  { title: 'Services', fields: ['services', 'servicesDevis', 'calendarSync'], color: '#4A9B8E' },
  { title: 'Planning', fields: ['bookingFrequency', 'cleaningSchedule'], color: '#8E24AA' },
];

const MAINTENANCE_GROUPS: FieldGroup[] = [
  { title: 'Demande', fields: ['selectedWorks', 'customNeed', 'description', 'urgency'], color: '#EF6C00' },
];

const SUPPORT_GROUPS: FieldGroup[] = [
  { title: 'Message', fields: ['subject', 'message'], color: '#1565C0' },
];

// ─── Composant principal ─────────────────────────────────────────────────────

const ReceivedFormsTab: React.FC = () => {
  const theme = useTheme();
  const [selectedForm, setSelectedForm] = useState<ReceivedForm | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  // ─── React Query hooks ─────────────────────────────────────
  const queryParams = useMemo(() => ({
    page,
    size: rowsPerPage,
    type: filterType || undefined,
  }), [page, filterType]);

  const { data: formsPage, isLoading } = useReceivedForms(queryParams);
  const updateStatusMutation = useUpdateFormStatus();
  const resetAvailabilityMutation = useResetFormsAvailability();

  const forms = formsPage?.content ?? [];
  const totalElements = formsPage?.totalElements ?? 0;

  // ─── Filtrage client ─────────────────────────────────────────

  const filteredForms = search.trim()
    ? forms.filter(f => {
        const q = search.toLowerCase();
        return f.fullName.toLowerCase().includes(q)
          || f.email.toLowerCase().includes(q)
          || (f.subject && f.subject.toLowerCase().includes(q))
          || (f.city && f.city.toLowerCase().includes(q));
      })
    : forms;

  // ─── Handlers ────────────────────────────────────────────────

  const handleSelect = (form: ReceivedForm) => {
    setSelectedForm(form);
    if (form.status === 'NEW') {
      updateStatusMutation.mutate({ id: form.id, status: 'READ' });
    }
  };

  const handleUpdateStatus = (status: string) => {
    if (!selectedForm) return;
    updateStatusMutation.mutate(
      { id: selectedForm.id, status },
      {
        onSuccess: (updated) => {
          if (updated) {
            setSelectedForm(prev => prev && prev.id === selectedForm.id ? { ...prev, ...updated } : prev);
          }
        },
      },
    );
  };

  // ─── Format date ─────────────────────────────────────────────

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  // ─── Parse & render payload (redesigned) ───────────────────

  const renderPayload = (form: ReceivedForm) => {
    let data: Record<string, unknown>;
    try { data = JSON.parse(form.payload); } catch { return <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Donnees non lisibles</Typography>; }

    const labels = form.formType === 'DEVIS' ? DEVIS_LABELS
      : form.formType === 'MAINTENANCE' ? MAINTENANCE_LABELS
      : SUPPORT_LABELS;

    const groups = form.formType === 'DEVIS' ? DEVIS_GROUPS
      : form.formType === 'MAINTENANCE' ? MAINTENANCE_GROUPS
      : SUPPORT_GROUPS;

    const skipKeys = ['fullName', 'name', 'email', 'phone', 'city', 'postalCode'];

    // Collect all grouped field keys
    const groupedKeys = new Set(groups.flatMap(g => g.fields));

    // Find ungrouped entries
    const ungroupedEntries = Object.entries(data).filter(([k, v]) =>
      !skipKeys.includes(k) && !groupedKeys.has(k)
      && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {groups.map((group) => {
          const groupEntries = group.fields
            .filter(k => data[k] !== null && data[k] !== undefined && data[k] !== '' && !(Array.isArray(data[k]) && (data[k] as unknown[]).length === 0))
            .map(k => [k, data[k]] as [string, unknown]);

          if (groupEntries.length === 0) return null;

          return (
            <Box key={group.title}>
              {/* Section title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{
                  width: 3, height: 16, borderRadius: 1,
                  bgcolor: group.color,
                }} />
                <Typography sx={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  color: 'text.secondary',
                }}>
                  {group.title}
                </Typography>
              </Box>

              {/* Fields grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 1.25,
              }}>
                {groupEntries.map(([key, value]) => {
                  const meta = FIELD_META[key] || DEFAULT_FIELD_META;
                  const isLongText = key === 'description' || key === 'message' || key === 'customNeed' || key === 'selectedWorks';

                  return (
                    <Box
                      key={key}
                      sx={{
                        gridColumn: isLongText ? '1 / -1' : undefined,
                        display: 'flex',
                        gap: 1.25,
                        p: 1.25,
                        borderRadius: '10px',
                        bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                        border: '1px solid',
                        borderColor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.15 : 0.1),
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.12 : 0.07),
                          borderColor: alpha(meta.color, 0.25),
                        },
                      }}
                    >
                      {/* Icon */}
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '8px',
                        bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        '& .MuiSvgIcon-root': { fontSize: 16, color: meta.color },
                      }}>
                        {meta.icon}
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontSize: '0.625rem', fontWeight: 600,
                          color: 'text.secondary', textTransform: 'uppercase',
                          letterSpacing: '0.3px', lineHeight: 1.2, mb: 0.25,
                        }}>
                          {labels[key] || key}
                        </Typography>
                        <Typography sx={{
                          fontSize: '0.8125rem', fontWeight: 600,
                          color: 'text.primary', lineHeight: 1.4,
                          ...(isLongText ? {} : {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }),
                        }}>
                          {formatFieldValue(key, value)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}

        {/* Ungrouped fields */}
        {ungroupedEntries.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box sx={{ width: 3, height: 16, borderRadius: 1, bgcolor: 'text.disabled' }} />
              <Typography sx={{
                fontSize: '0.6875rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.8px',
                color: 'text.secondary',
              }}>
                Autres
              </Typography>
            </Box>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 1.25,
            }}>
              {ungroupedEntries.map(([key, value]) => {
                const meta = FIELD_META[key] || DEFAULT_FIELD_META;
                return (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex', gap: 1.25, p: 1.25,
                      borderRadius: '10px',
                      bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                      border: '1px solid',
                      borderColor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.15 : 0.1),
                    }}
                  >
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '8px',
                      bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      '& .MuiSvgIcon-root': { fontSize: 16, color: meta.color },
                    }}>
                      {meta.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: '0.625rem', fontWeight: 600,
                        color: 'text.secondary', textTransform: 'uppercase',
                        letterSpacing: '0.3px', lineHeight: 1.2, mb: 0.25,
                      }}>
                        {labels[key] || key}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.8125rem', fontWeight: 600,
                        color: 'text.primary', lineHeight: 1.4,
                      }}>
                        {formatFieldValue(key, value)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} /> }}
          sx={{
            minWidth: 180, flex: 1,
            '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', borderRadius: '8px' },
          }}
        />
        {['', 'DEVIS', 'MAINTENANCE', 'SUPPORT'].map(t => {
          const conf = t ? FORM_TYPE_CONFIG[t] : null;
          const chipColor = conf?.color || '#0288d1';
          const isActive = filterType === t;
          return (
            <Chip
              key={t || 'all'}
              label={conf ? conf.label : 'Tous'}
              size="small"
              onClick={() => { setFilterType(t); setPage(0); }}
              sx={{
                fontSize: '0.6875rem', height: 26, borderRadius: '6px', cursor: 'pointer',
                fontWeight: 600,
                '& .MuiChip-label': { px: 1 },
                backgroundColor: isActive ? chipColor : `${chipColor}18`,
                color: isActive ? '#fff' : chipColor,
                border: `1px solid ${chipColor}40`,
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: isActive ? chipColor : `${chipColor}28`,
                },
              }}
            />
          );
        })}
        <Tooltip title="Rafraichir">
          <IconButton size="small" onClick={() => resetAvailabilityMutation.mutate()}>
            <RefreshIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={32} color="primary" />
        </Box>
      ) : filteredForms.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1.5 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InboxIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>Aucun formulaire recu</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Les formulaires soumis depuis la landing page apparaitront ici.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ─── Liste gauche (35%) ─── */}
          <Box sx={{ width: '35%', borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {filteredForms.map(form => {
                const typeConf = FORM_TYPE_CONFIG[form.formType] || FORM_TYPE_CONFIG.DEVIS;
                const statusConf = STATUS_CONFIG[form.status] || STATUS_CONFIG.NEW;
                const isSelected = selectedForm?.id === form.id;
                const isNew = form.status === 'NEW';

                return (
                  <Box
                    key={form.id}
                    onClick={() => handleSelect(form)}
                    sx={{
                      px: 1.5, py: 1.25,
                      cursor: 'pointer',
                      borderBottom: 1, borderColor: 'divider',
                      bgcolor: isSelected
                        ? alpha(typeConf.color, theme.palette.mode === 'dark' ? 0.1 : 0.04)
                        : 'transparent',
                      borderLeft: 3,
                      borderLeftColor: isSelected ? typeConf.color : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected
                          ? alpha(typeConf.color, theme.palette.mode === 'dark' ? 0.12 : 0.06)
                          : 'action.hover',
                      },
                    }}
                  >
                    {/* Row 1: Type chip + status badge + new dot */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                      <Chip
                        icon={typeConf.icon as React.ReactElement}
                        label={typeConf.label}
                        size="small"
                        sx={{
                          fontSize: '0.625rem', height: 22, borderRadius: '6px',
                          fontWeight: 600, '& .MuiChip-label': { px: 0.75 },
                          backgroundColor: `${typeConf.color}18`,
                          color: typeConf.color,
                          border: `1px solid ${typeConf.color}40`,
                          '& .MuiChip-icon': { color: typeConf.color, ml: 0.5 },
                        }}
                      />
                      {form.status !== 'NEW' && (
                        <Chip
                          label={statusConf.label}
                          size="small"
                          sx={{
                            fontSize: '0.5625rem', height: 18, borderRadius: '4px',
                            fontWeight: 600, '& .MuiChip-label': { px: 0.5 },
                            backgroundColor: `${statusConf.color}18`,
                            color: statusConf.color,
                            border: `1px solid ${statusConf.color}30`,
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      {isNew && (
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          bgcolor: '#ED6C02', flexShrink: 0,
                          boxShadow: '0 0 0 2px rgba(237,108,2,0.2)',
                        }} />
                      )}
                    </Box>

                    {/* Row 2: Name */}
                    <Typography sx={{
                      fontSize: '0.8125rem',
                      fontWeight: isNew ? 700 : 600,
                      color: 'text.primary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}>
                      {form.fullName}
                    </Typography>

                    {/* Row 3: Subject */}
                    <Typography sx={{
                      fontSize: '0.6875rem', color: 'text.secondary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'block', lineHeight: 1.4, mt: 0.25,
                    }}>
                      {form.subject}
                    </Typography>

                    {/* Row 4: Date + city */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography sx={{
                        fontSize: '0.625rem', color: 'text.disabled',
                        lineHeight: 1,
                      }}>
                        {formatDate(form.createdAt)}
                      </Typography>
                      {form.city && (
                        <>
                          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <LocationIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                            <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', lineHeight: 1 }}>
                              {form.city}
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[]}
              sx={{
                borderTop: 1, borderColor: 'divider', flexShrink: 0,
                '& .MuiTablePagination-displayedRows': { fontSize: '0.75rem', color: 'text.secondary' },
              }}
            />
          </Box>

          {/* ─── Detail droite (65%) ─── */}
          <Box sx={{ width: '65%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedForm ? (
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>

                {/* ── Header card ── */}
                <Box sx={{
                  mb: 2.5, p: 2, borderRadius: '12px',
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
                }}>
                  {/* Badges (PMS soft-filled) */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    {(() => {
                      const tc = FORM_TYPE_CONFIG[selectedForm.formType] || FORM_TYPE_CONFIG.DEVIS;
                      return (
                        <Chip
                          icon={tc.icon as React.ReactElement}
                          label={tc.label}
                          size="small"
                          sx={{
                            fontSize: '0.6875rem', height: 24, borderRadius: '6px',
                            fontWeight: 600, '& .MuiChip-label': { px: 0.75 },
                            backgroundColor: `${tc.color}18`,
                            color: tc.color,
                            border: `1px solid ${tc.color}40`,
                            '& .MuiChip-icon': { color: tc.color, ml: 0.5 },
                          }}
                        />
                      );
                    })()}
                    {(() => {
                      const sc = STATUS_CONFIG[selectedForm.status] || STATUS_CONFIG.NEW;
                      return (
                        <Chip
                          label={sc.label}
                          size="small"
                          sx={{
                            fontSize: '0.6875rem', height: 24, borderRadius: '6px',
                            fontWeight: 600, '& .MuiChip-label': { px: 0.75 },
                            backgroundColor: `${sc.color}18`,
                            color: sc.color,
                            border: `1px solid ${sc.color}40`,
                          }}
                        />
                      );
                    })()}
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                      {formatDate(selectedForm.createdAt)}
                    </Typography>
                  </Box>

                  {/* Title */}
                  <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: 'text.primary', mb: 1.5, lineHeight: 1.3 }}>
                    {selectedForm.subject || `Formulaire #${selectedForm.id}`}
                  </Typography>

                  {/* Contact info chips */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.75,
                      px: 1.25, py: 0.5, borderRadius: '8px',
                      bgcolor: alpha(theme.palette.text.primary, 0.04),
                      border: '1px solid', borderColor: 'divider',
                    }}>
                      <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                        {selectedForm.email}
                      </Typography>
                    </Box>
                    {selectedForm.phone && (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.75,
                        px: 1.25, py: 0.5, borderRadius: '8px',
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                        border: '1px solid', borderColor: 'divider',
                      }}>
                        <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                          {selectedForm.phone}
                        </Typography>
                      </Box>
                    )}
                    {(selectedForm.city || selectedForm.postalCode) && (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.75,
                        px: 1.25, py: 0.5, borderRadius: '8px',
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                        border: '1px solid', borderColor: 'divider',
                      }}>
                        <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                          {[selectedForm.city, selectedForm.postalCode].filter(Boolean).join(' ')}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {selectedForm.ipAddress && (
                    <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.disabled', display: 'block', mt: 1 }}>
                      IP: {selectedForm.ipAddress}
                    </Typography>
                  )}
                </Box>

                {/* ── Payload data (redesigned) ── */}
                {renderPayload(selectedForm)}

                {/* ── Actions ── */}
                <Divider sx={{ my: 2.5 }} />
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {selectedForm.status !== 'PROCESSED' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleUpdateStatus('PROCESSED')}
                      disabled={updateStatusMutation.isPending}
                      sx={{
                        textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600,
                        borderRadius: '10px', px: 2.5, py: 0.75,
                        boxShadow: 'none', '&:hover': { boxShadow: 'none' },
                      }}
                    >
                      Marquer traite
                    </Button>
                  )}
                  {selectedForm.status !== 'ARCHIVED' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ArchiveIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleUpdateStatus('ARCHIVED')}
                      disabled={updateStatusMutation.isPending}
                      sx={{
                        textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        borderRadius: '10px', px: 2.5, py: 0.75,
                      }}
                    >
                      Archiver
                    </Button>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  Selectionnez un formulaire pour voir son contenu
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ReceivedFormsTab;
