import React, { useState, useMemo, useEffect } from 'react';
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
} from '../../icons';
import type { ReceivedForm } from '../../services/api/receivedFormsApi';
import { useReceivedForms, useUpdateFormStatus, useResetFormsAvailability } from '../../hooks/useReceivedForms';
import { useTemplates, useGenerateDocument, useGenerationsByReference } from '../documents/hooks/useDocuments';
import { documentsApi } from '../../services/api/documentsApi';
import {
  PictureAsPdf as PdfIcon,
  Close as CloseIconBase,
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
} from '../../icons';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import { useNotification } from '../../hooks/useNotification';

// ─── Config types & statuts (PMS soft-filled design system) ─────────────────

const FORM_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DEVIS: { label: 'Devis', color: '#0288d1', icon: <DescriptionIcon size={14} strokeWidth={1.75} /> },
  MAINTENANCE: { label: 'Maintenance', color: '#ED6C02', icon: <BuildIcon size={14} strokeWidth={1.75} /> },
  SUPPORT: { label: 'Support', color: '#4A9B8E', icon: <SupportIcon size={14} strokeWidth={1.75} /> },
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

// ─── Sous-composants de rendu (par type de formulaire) ─────────────────────

function SectionHeader({ icon, title, accentColor }: { icon: React.ReactNode; title: string; accentColor: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box
        sx={{
          width: 24, height: 24, borderRadius: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor,
          bgcolor: (t) => alpha(accentColor, t.palette.mode === 'dark' ? 0.18 : 0.12),
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'text.secondary' }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: 'divider', ml: 1 }} />
    </Box>
  );
}

function KpiTile({
  icon, label, value, color, span = 1,
}: { icon: React.ReactNode; label: string; value: string; color: string; span?: number }) {
  return (
    <Box
      sx={{
        gridColumn: `span ${span}`,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.06 : 0.03),
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 200ms, transform 200ms',
        '&:hover': {
          borderColor: color,
          transform: 'translateY(-1px)',
        },
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, bottom: 0,
          width: 3, bgcolor: color, opacity: 0.7,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </Typography>
        <Box sx={{ display: 'inline-flex', color, opacity: 0.8 }}>
          {icon}
        </Box>
      </Box>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

function FeatureRow({
  icon, label, value, color, checked = true,
}: { icon: React.ReactNode; label: string; value: string; color: string; checked?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        p: 1.25, borderRadius: 1.5,
        bgcolor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.05 : 0.025),
        border: '1px solid',
        borderColor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.15 : 0.1),
      }}
    >
      <Box
        sx={{
          width: 28, height: 28, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.2 : 0.12),
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.3, mt: 0.25 }}>
          {value}
        </Typography>
      </Box>
      {checked && (
        <Box sx={{ display: 'inline-flex', color }}>
          <CheckCircleIcon size={18} strokeWidth={2} />
        </Box>
      )}
    </Box>
  );
}

function DevisDetails({ data }: { data: Record<string, unknown> }) {
  const get = (k: string) => data[k];
  const has = (k: string) => {
    const v = get(k);
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  };

  // BIEN — KPI tiles
  const bienTiles: { key: string; icon: React.ReactNode; label: string; value: string; color: string }[] = [];
  if (has('propertyType')) bienTiles.push({ key: 'propertyType', icon: <HomeIcon size={16} strokeWidth={1.75} />, label: 'Type de bien', value: formatFieldValue('propertyType', get('propertyType')), color: '#0288d1' });
  if (has('surface')) bienTiles.push({ key: 'surface', icon: <SquareFootIcon size={16} strokeWidth={1.75} />, label: 'Surface', value: `${get('surface')} m²`, color: '#00897B' });
  if (has('guestCapacity')) bienTiles.push({ key: 'guestCapacity', icon: <PeopleIcon size={16} strokeWidth={1.75} />, label: 'Voyageurs', value: formatFieldValue('guestCapacity', get('guestCapacity')), color: '#AB47BC' });
  if (has('propertyCount')) bienTiles.push({ key: 'propertyCount', icon: <ApartmentIcon size={16} strokeWidth={1.75} />, label: 'Nombre de logements', value: String(get('propertyCount')), color: '#5C6BC0' });

  // SERVICES
  const serviceRows: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];
  if (has('services')) serviceRows.push({ icon: <CleaningIcon size={14} strokeWidth={1.75} />, label: 'Services forfait', value: formatFieldValue('services', get('services')), color: '#4A9B8E' });
  if (has('servicesDevis')) serviceRows.push({ icon: <QuoteIcon size={14} strokeWidth={1.75} />, label: 'Services sur devis', value: formatFieldValue('servicesDevis', get('servicesDevis')), color: '#E65100' });
  if (has('calendarSync')) serviceRows.push({ icon: <SyncIcon size={14} strokeWidth={1.75} />, label: 'Synchro calendrier', value: formatFieldValue('calendarSync', get('calendarSync')), color: '#1565C0' });

  // PLANNING
  const planningRows: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];
  if (has('bookingFrequency')) planningRows.push({ icon: <EventRepeatIcon size={14} strokeWidth={1.75} />, label: 'Fréquence des réservations', value: formatFieldValue('bookingFrequency', get('bookingFrequency')), color: '#F4511E' });
  if (has('cleaningSchedule')) planningRows.push({ icon: <ScheduleIcon size={14} strokeWidth={1.75} />, label: 'Planning ménage', value: formatFieldValue('cleaningSchedule', get('cleaningSchedule')), color: '#8E24AA' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* APERÇU DU BIEN */}
      {bienTiles.length > 0 && (
        <Box>
          <SectionHeader icon={<HomeIcon size={14} strokeWidth={2} />} title="Aperçu du bien" accentColor="#0288d1" />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.25 }}>
            {bienTiles.map((t) => (
              <KpiTile key={t.key} icon={t.icon} label={t.label} value={t.value} color={t.color} />
            ))}
          </Box>
        </Box>
      )}

      {/* SERVICES */}
      {serviceRows.length > 0 && (
        <Box>
          <SectionHeader icon={<ServicesIcon size={14} strokeWidth={2} />} title="Services souhaités" accentColor="#4A9B8E" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
            {serviceRows.map((r) => (
              <FeatureRow key={r.label} icon={r.icon} label={r.label} value={r.value} color={r.color} />
            ))}
          </Box>
        </Box>
      )}

      {/* PLANNING */}
      {planningRows.length > 0 && (
        <Box>
          <SectionHeader icon={<CalendarIcon size={14} strokeWidth={2} />} title="Planning" accentColor="#8E24AA" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
            {planningRows.map((r) => (
              <FeatureRow key={r.label} icon={r.icon} label={r.label} value={r.value} color={r.color} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function MaintenanceDetails({ data }: { data: Record<string, unknown> }) {
  const get = (k: string) => data[k];
  const has = (k: string) => {
    const v = get(k);
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  };

  const urgencyValue = get('urgency') as string | undefined;
  const urgencyColor =
    urgencyValue === 'critical' ? '#d32f2f' :
    urgencyValue === 'high' ? '#ef6c00' :
    urgencyValue === 'medium' ? '#f59e0b' :
    '#10b981';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {has('urgency') && (
        <Box>
          <SectionHeader icon={<UrgencyIcon size={14} strokeWidth={2} />} title="Niveau d'urgence" accentColor={urgencyColor} />
          <Box
            sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: (t) => alpha(urgencyColor, t.palette.mode === 'dark' ? 0.12 : 0.08),
              border: '1px solid', borderColor: alpha(urgencyColor, 0.4),
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: urgencyColor, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: urgencyColor }}>
              {formatFieldValue('urgency', urgencyValue)}
            </Typography>
          </Box>
        </Box>
      )}

      {has('selectedWorks') && (
        <Box>
          <SectionHeader icon={<HandymanIcon size={14} strokeWidth={2} />} title="Travaux demandés" accentColor="#EF6C00" />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {(Array.isArray(get('selectedWorks')) ? get('selectedWorks') as unknown[] : [get('selectedWorks')]).map((w, i) => (
              <Chip
                key={i}
                label={formatFieldValue('selectedWorks', w)}
                size="small"
                icon={<HandymanIcon size={12} strokeWidth={1.75} />}
                sx={{
                  fontSize: '0.75rem', fontWeight: 600, height: 26, borderRadius: '6px',
                  bgcolor: '#EF6C0018', color: '#EF6C00',
                  border: '1px solid #EF6C0040',
                  '& .MuiChip-icon': { color: '#EF6C00', ml: 0.5 },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {(has('customNeed') || has('description')) && (
        <Box>
          <SectionHeader icon={<MessageIcon size={14} strokeWidth={2} />} title="Description" accentColor="#546E7A" />
          <Box
            sx={{
              p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              borderLeftWidth: 3, borderLeftColor: '#546E7A',
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {(get('customNeed') as string) || (get('description') as string) || ''}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function SupportDetails({ data }: { data: Record<string, unknown> }) {
  const subject = data.subject as string | undefined;
  const message = data.message as string | undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {subject && (
        <Box>
          <SectionHeader icon={<SubjectIcon size={14} strokeWidth={2} />} title="Sujet" accentColor="#1565C0" />
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.primary', pl: 0.5 }}>
            {subject}
          </Typography>
        </Box>
      )}
      {message && (
        <Box>
          <SectionHeader icon={<MessageIcon size={14} strokeWidth={2} />} title="Message" accentColor="#546E7A" />
          <Box
            sx={{
              p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              borderLeftWidth: 3, borderLeftColor: '#546E7A',
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {message}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

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
  const { data: templates } = useTemplates();
  const generateDocumentMutation = useGenerateDocument();
  const { notify } = useNotification();

  // ─── PDF preview state ─────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ generationId: number; filename: string; createdAt?: string } | null>(null);

  // Fetch previous generations for the selected form so we can offer to re-open them.
  const { data: priorGenerations } = useGenerationsByReference(
    'RECEIVED_FORM',
    selectedForm?.id ?? 0,
  );

  // Liberer le blob URL au close pour ne pas leak de la memoire.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openPreview = async (gen: { id: number; fileName?: string; createdAt?: string }) => {
    try {
      const url = await documentsApi.fetchGenerationBlobUrl(gen.id);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewMeta({
        generationId: gen.id,
        filename: gen.fileName || `document-${gen.id}.pdf`,
        createdAt: gen.createdAt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible de charger le document';
      notify.error(msg);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewMeta(null);
  };

  // ─── Active template lookup per form type ─────────────────────
  // Map des types de formulaire vers le documentType côté serveur
  const FORM_TO_DOC_TYPE: Record<string, string> = {
    DEVIS: 'DEVIS',
    MAINTENANCE: 'AUTORISATION_TRAVAUX',
    SUPPORT: '',
  };

  const findActiveTemplate = (formType: string) => {
    const docType = FORM_TO_DOC_TYPE[formType];
    if (!docType || !templates) return null;
    return templates.find((tpl) => tpl.documentType === docType && tpl.active) ?? null;
  };

  // ─── Generate PDF using a document template ───────────────────
  const handleGeneratePdf = async (form: ReceivedForm) => {
    const tpl = findActiveTemplate(form.formType);
    if (!tpl) {
      notify.error('Aucun template actif trouvé pour ce type de formulaire');
      return;
    }
    try {
      const generation = await generateDocumentMutation.mutateAsync({
        documentType: tpl.documentType,
        referenceId: form.id,
        referenceType: 'RECEIVED_FORM',
        sendEmail: false,
      });
      if (generation?.id) {
        notify.success('PDF généré');
        // Affiche l'apercu inline au lieu de tenter un window.open
        // (souvent bloque par le popup blocker des navigateurs).
        await openPreview({
          id: generation.id,
          fileName: generation.fileName,
          createdAt: generation.createdAt,
        });
      } else {
        notify.error('Génération impossible — vérifie que le template DEVIS est compatible avec ce type de formulaire');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération du PDF';
      notify.error(message);
    }
  };

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

    if (form.formType === 'DEVIS') {
      return <DevisDetails data={data} />;
    }
    if (form.formType === 'MAINTENANCE') {
      return <MaintenanceDetails data={data} />;
    }
    if (form.formType === 'SUPPORT') {
      return <SupportDetails data={data} />;
    }
    return null;
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
          InputProps={{ startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 0.5 }}><SearchIcon size={18} strokeWidth={1.75} /></Box> }}
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><RefreshIcon size={18} strokeWidth={1.75} /></Box>
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><InboxIcon size={28} strokeWidth={1.75} /></Box>
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
                            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><LocationIcon size={10} strokeWidth={1.75} /></Box>
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

                {/* ── Hero header (avatar + identité + contacts) ─────────── */}
                {(() => {
                  const tc = FORM_TYPE_CONFIG[selectedForm.formType] || FORM_TYPE_CONFIG.DEVIS;
                  const sc = STATUS_CONFIG[selectedForm.status] || STATUS_CONFIG.NEW;
                  const name = selectedForm.fullName || 'Anonyme';
                  const initials = name
                    .split(/[\s.-]+/)
                    .filter(Boolean)
                    .map((w) => w.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join('') || '?';
                  return (
                    <Box
                      sx={{
                        mb: 3, p: 2.5, borderRadius: 2,
                        position: 'relative', overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        background: (t) =>
                          t.palette.mode === 'dark'
                            ? `linear-gradient(135deg, ${t.palette.background.paper} 0%, ${alpha(tc.color, 0.1)} 100%)`
                            : `linear-gradient(135deg, #fff 0%, ${alpha(tc.color, 0.06)} 100%)`,
                      }}
                    >
                      {/* Top row : type chip à gauche + date + statut à droite */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        <Chip
                          icon={tc.icon as React.ReactElement}
                          label={tc.label}
                          size="small"
                          sx={{
                            fontSize: '0.6875rem', height: 24, borderRadius: '6px',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                            '& .MuiChip-label': { px: 0.75 },
                            backgroundColor: tc.color, color: '#fff',
                            '& .MuiChip-icon': { color: '#fff !important', ml: 0.5 },
                          }}
                        />
                        <Chip
                          label={sc.label}
                          size="small"
                          icon={
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: sc.color, ml: 0.5 }} />
                          }
                          sx={{
                            fontSize: '0.6875rem', height: 24, borderRadius: '6px',
                            fontWeight: 600, '& .MuiChip-label': { px: 0.75 },
                            backgroundColor: `${sc.color}18`, color: sc.color,
                            border: `1px solid ${sc.color}40`,
                          }}
                        />
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                          {formatDate(selectedForm.createdAt)}
                        </Typography>
                      </Box>

                      {/* Identité : avatar + nom + sujet */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box
                          sx={{
                            width: 52, height: 52, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: tc.color, color: '#fff',
                            fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.05em',
                            flexShrink: 0,
                            boxShadow: `0 2px 6px ${tc.color}40`,
                          }}
                        >
                          {initials}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
                            {name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.25 }}>
                            {selectedForm.subject || `Formulaire #${selectedForm.id}`}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Contact info — clean list horizontal */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        <Box
                          component="a"
                          href={`mailto:${selectedForm.email}`}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75,
                            textDecoration: 'none',
                            '&:hover': { color: tc.color },
                            transition: 'color 150ms',
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                            <EmailIcon size={14} strokeWidth={1.75} />
                          </Box>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'inherit', fontWeight: 500 }}>
                            {selectedForm.email}
                          </Typography>
                        </Box>
                        {selectedForm.phone && (
                          <>
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                            <Box
                              component="a"
                              href={`tel:${selectedForm.phone.replace(/\s/g, '')}`}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 0.75,
                                textDecoration: 'none',
                                '&:hover': { color: tc.color },
                                transition: 'color 150ms',
                              }}
                            >
                              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                                <PhoneIcon size={14} strokeWidth={1.75} />
                              </Box>
                              <Typography sx={{ fontSize: '0.8125rem', color: 'inherit', fontWeight: 500 }}>
                                {selectedForm.phone}
                              </Typography>
                            </Box>
                          </>
                        )}
                        {(selectedForm.city || selectedForm.postalCode) && (
                          <>
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                                <LocationIcon size={14} strokeWidth={1.75} />
                              </Box>
                              <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                                {[selectedForm.city, selectedForm.postalCode].filter(Boolean).join(' ')}
                              </Typography>
                            </Box>
                          </>
                        )}
                      </Box>

                      {selectedForm.ipAddress && (
                        <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', mt: 1.5, fontFamily: 'monospace' }}>
                          IP : {selectedForm.ipAddress}
                        </Typography>
                      )}
                    </Box>
                  );
                })()}

                {/* ── Payload data (redesigned) ── */}
                {renderPayload(selectedForm)}

                {/* ── Actions ── */}
                <Divider sx={{ my: 2.5 }} />
                {(() => {
                  const tpl = findActiveTemplate(selectedForm.formType);
                  return (
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Generate PDF (only if a matching template exists) */}
                      {tpl && (
                        <Tooltip
                          title={`Génère un PDF à partir du template « ${tpl.name} »`}
                          placement="top"
                          arrow
                        >
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={
                              generateDocumentMutation.isPending ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <PdfIcon size={16} strokeWidth={1.75} />
                              )
                            }
                            onClick={() => handleGeneratePdf(selectedForm)}
                            disabled={generateDocumentMutation.isPending}
                            sx={{
                              textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600,
                              borderRadius: '10px', px: 2.5, py: 0.75,
                              bgcolor: '#d32f2f',
                              '&:hover': { bgcolor: '#b71c1c' },
                              boxShadow: 'none',
                            }}
                          >
                            {generateDocumentMutation.isPending ? 'Génération…' : 'Générer PDF'}
                          </Button>
                        </Tooltip>
                      )}

                      {selectedForm.status !== 'PROCESSED' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleIcon size={16} strokeWidth={1.75} />}
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
                          startIcon={<ArchiveIcon size={16} strokeWidth={1.75} />}
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

                      {!tpl && selectedForm.formType === 'DEVIS' && (
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontStyle: 'italic' }}>
                            Aucun template DEVIS actif — ajoute-en un dans Documents & Communications pour activer la génération PDF.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })()}

                {/* ── Documents deja generes pour ce formulaire ───────────── */}
                {priorGenerations && priorGenerations.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                        <HistoryIcon size={14} strokeWidth={1.75} />
                      </Box>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                        Documents générés ({priorGenerations.length})
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {priorGenerations.slice(0, 5).map((gen) => (
                        <Box
                          key={gen.id}
                          onClick={() => openPreview(gen)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1,
                            borderRadius: '8px', border: '1px solid', borderColor: 'divider',
                            cursor: 'pointer', transition: 'all 150ms',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', color: '#d32f2f' }}>
                            <PdfIcon size={16} strokeWidth={1.75} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {gen.fileName || `document-${gen.id}.pdf`}
                            </Typography>
                            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                              {gen.legalNumber ? `${gen.legalNumber} · ` : ''}{gen.createdAt ? formatDate(gen.createdAt) : ''}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.6875rem', color: 'primary.main', fontWeight: 600 }}>
                            Aperçu →
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><DescriptionIcon size={48} strokeWidth={1.75} /></Box>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  Selectionnez un formulaire pour voir son contenu
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ── PDF preview dialog ─────────────────────────────────────── */}
      <Dialog
        open={Boolean(previewUrl)}
        onClose={closePreview}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 1.25,
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: '#d32f2f' }}>
            <PdfIcon size={18} strokeWidth={1.75} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {previewMeta?.filename || 'Aperçu du document'}
            </Typography>
            {previewMeta?.createdAt && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                Généré le {formatDate(previewMeta.createdAt)}
              </Typography>
            )}
          </Box>
          {previewUrl && (
            <>
              <Tooltip title="Ouvrir dans un nouvel onglet">
                <IconButton
                  size="small"
                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  sx={{ color: 'text.secondary' }}
                >
                  <OpenInNewIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Télécharger">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (!previewMeta) return;
                    const link = document.createElement('a');
                    link.href = previewUrl;
                    link.download = previewMeta.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  sx={{ color: 'text.secondary' }}
                >
                  <DownloadIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fermer">
                <IconButton size="small" onClick={closePreview} sx={{ color: 'text.secondary' }}>
                  <CloseIconBase size={18} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, bgcolor: '#525659' /* viewer grey */ }}>
          {previewUrl && (
            <Box
              component="iframe"
              src={previewUrl}
              title={previewMeta?.filename || 'PDF'}
              sx={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ReceivedFormsTab;
