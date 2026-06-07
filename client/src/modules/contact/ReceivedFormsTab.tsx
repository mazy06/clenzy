import React, { useState, useMemo, useEffect } from 'react';
import { CONTACT_LIST_WIDTH } from '../channels/channelConfig';
import { usePageHeaderFilters } from '../../components/PageHeaderActionsContext';
import FilterChipRow from '../../components/FilterChipRow';
import InboxListItem from '../../components/InboxListItem';
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
  Check as CheckIcon,
  DoneAll as CheckCheckIcon,
  Circle as CircleIcon,
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
  Warning as AlertTriangleIcon,
} from '../../icons';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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

// Icône de statut — progression lisible : non lu (cercle) → lu (check) →
// traité (double-check) → archivé (archive). Couleur appliquée par le parent.
function renderStatusIcon(status: string, size = 15): React.ReactNode {
  switch (status) {
    case 'READ': return <CheckIcon size={size} strokeWidth={2.25} />;
    case 'PROCESSED': return <CheckCheckIcon size={size} strokeWidth={2.25} />;
    case 'ARCHIVED': return <ArchiveIcon size={size} strokeWidth={1.75} />;
    default: return <CircleIcon size={size} strokeWidth={2} />; // NEW
  }
}

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
  // Capacité voyageurs : c'est un intervalle (ex. "1-2"). Le remplacement
  // tiret→espace ci-dessous le rendrait "1 2" (lu comme "12"). On formate
  // explicitement l'intervalle en "X à Y" pour lever l'ambiguïté.
  if (key === 'guestCapacity') {
    const labeled = DEVIS_VALUE_LABELS[key]?.[str];
    if (labeled) return labeled;
    const range = str.match(/^\s*(\d+)\s*[-–\s]\s*(\d+)\s*$/);
    return range ? `${range[1]} à ${range[2]}` : str;
  }
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

// ─── Échelle typo unifiée (skill ui-ux-pro-max, modular scale 12/16) ───
// Tous les blocs d'info partagent la même échelle : libellé 12px uppercase,
// valeur 16px regular. Une seule icône par info, jamais de check redondant.
const LABEL_SX = { fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 } as const;
const VALUE_SX = { fontSize: '1rem', fontWeight: 400, color: 'text.primary', lineHeight: 1.4 } as const;

// Eyebrow de section — 12px uppercase + filet. Pas d'icône (réservée aux
// infos). `icon`/`accentColor` gardés pour compat appelants (ignorés).
function SectionHeader({ title }: { icon?: React.ReactNode; title: string; accentColor?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Box>
  );
}

// Tuile KPI à plat — libellé 12px + icône 16px en tête, valeur 16px en
// tabular-nums. Même échelle que FeatureRow. `color` conservé (ignoré).
function KpiTile({
  icon, label, value, span = 1,
}: { icon: React.ReactNode; label: string; value: string; color?: string; span?: number }) {
  return (
    <Box sx={{ gridColumn: `span ${span}`, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Box sx={{ display: 'inline-flex', color: 'text.disabled' }}>
          {icon}
        </Box>
        <Typography sx={{ ...LABEL_SX }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ ...VALUE_SX, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

// Ligne d'info à plat — icône 16px + libellé 12px + valeur 16px. Une seule
// icône par info (pas de check redondant). `color` conservé (ignoré).
function FeatureRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
      <Box sx={{ display: 'inline-flex', color: 'text.disabled', flexShrink: 0, mt: '2px' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...LABEL_SX }}>
          {label}
        </Typography>
        <Typography sx={{ ...VALUE_SX, mt: 0.25 }}>
          {value}
        </Typography>
      </Box>
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
  if (has('propertyCount')) bienTiles.push({ key: 'propertyCount', icon: <ApartmentIcon size={16} strokeWidth={1.75} />, label: 'Logements', value: String(get('propertyCount')), color: '#5C6BC0' });

  // SERVICES
  const serviceRows: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];
  if (has('services')) serviceRows.push({ icon: <CleaningIcon size={16} strokeWidth={1.75} />, label: 'Services forfait', value: formatFieldValue('services', get('services')), color: '#4A9B8E' });
  if (has('servicesDevis')) serviceRows.push({ icon: <QuoteIcon size={16} strokeWidth={1.75} />, label: 'Services sur devis', value: formatFieldValue('servicesDevis', get('servicesDevis')), color: '#E65100' });
  if (has('calendarSync')) serviceRows.push({ icon: <SyncIcon size={16} strokeWidth={1.75} />, label: 'Synchro calendrier', value: formatFieldValue('calendarSync', get('calendarSync')), color: '#1565C0' });

  // PLANNING
  const planningRows: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];
  if (has('bookingFrequency')) planningRows.push({ icon: <EventRepeatIcon size={16} strokeWidth={1.75} />, label: 'Fréquence des réservations', value: formatFieldValue('bookingFrequency', get('bookingFrequency')), color: '#F4511E' });
  if (has('cleaningSchedule')) planningRows.push({ icon: <ScheduleIcon size={16} strokeWidth={1.75} />, label: 'Planning ménage', value: formatFieldValue('cleaningSchedule', get('cleaningSchedule')), color: '#8E24AA' });

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

  const works = has('selectedWorks')
    ? (Array.isArray(get('selectedWorks')) ? get('selectedWorks') as unknown[] : [get('selectedWorks')])
        .map((w) => formatFieldValue('selectedWorks', w)).join(' · ')
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {has('urgency') && (
        <Box>
          <SectionHeader icon={<UrgencyIcon size={14} strokeWidth={2} />} title="Niveau d'urgence" accentColor={urgencyColor} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: urgencyColor, flexShrink: 0 }} />
            <Typography sx={{ ...VALUE_SX, color: urgencyColor }}>
              {formatFieldValue('urgency', urgencyValue)}
            </Typography>
          </Box>
        </Box>
      )}

      {works && (
        <Box>
          <SectionHeader icon={<HandymanIcon size={14} strokeWidth={2} />} title="Travaux demandés" accentColor="#EF6C00" />
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
            <Box sx={{ display: 'inline-flex', color: 'text.disabled', flexShrink: 0, mt: '2px' }}>
              <HandymanIcon size={16} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ ...VALUE_SX, flex: 1, minWidth: 0 }}>
              {works}
            </Typography>
          </Box>
        </Box>
      )}

      {(has('customNeed') || has('description')) && (
        <Box>
          <SectionHeader icon={<MessageIcon size={14} strokeWidth={2} />} title="Description" accentColor="#546E7A" />
          <Typography sx={{ ...VALUE_SX, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {(get('customNeed') as string) || (get('description') as string) || ''}
          </Typography>
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
          <Typography sx={{ ...VALUE_SX }}>
            {subject}
          </Typography>
        </Box>
      )}
      {message && (
        <Box>
          <SectionHeader icon={<MessageIcon size={14} strokeWidth={2} />} title="Message" accentColor="#546E7A" />
          <Typography sx={{ ...VALUE_SX, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

const ReceivedFormsTab: React.FC<{ archivedOnly?: boolean; listHeaderSlot?: React.ReactNode }> = ({ archivedOnly = false, listHeaderSlot }) => {
  const theme = useTheme();
  const [selectedForm, setSelectedForm] = useState<ReceivedForm | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  // Éditeur de renvoi du devis (objet + corps modifiables avant renvoi).
  const [resend, setResend] = useState<{
    open: boolean;
    form: ReceivedForm | null;
    subject: string;
    body: string;
    loading: boolean;
  }>({ open: false, form: null, subject: '', body: '', loading: false });
  const rowsPerPage = 20;

  // ─── React Query hooks ─────────────────────────────────────
  const queryParams = useMemo(() => ({
    page,
    size: rowsPerPage,
    type: filterType || undefined,
    status: archivedOnly ? 'ARCHIVED' : undefined,
  }), [page, filterType, archivedOnly]);

  const { data: formsPage, isLoading } = useReceivedForms(queryParams);
  const updateStatusMutation = useUpdateFormStatus();
  const resetAvailabilityMutation = useResetFormsAvailability();

  // Recherche + filtre type + refresh : portés dans la barre filtres du PageHeader (inline).
  const filtersNode = (
    <>
      <TextField
        size="small"
        placeholder="Rechercher…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 0.5 }}><SearchIcon size={18} strokeWidth={1.75} /></Box> }}
        sx={{ width: { xs: 150, sm: 220 }, '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', borderRadius: '8px' } }}
      />
      <FilterChipRow<'DEVIS' | 'MAINTENANCE' | 'SUPPORT'>
        options={[
          { value: 'DEVIS', label: FORM_TYPE_CONFIG.DEVIS.label, color: FORM_TYPE_CONFIG.DEVIS.color },
          { value: 'MAINTENANCE', label: FORM_TYPE_CONFIG.MAINTENANCE.label, color: FORM_TYPE_CONFIG.MAINTENANCE.color },
          { value: 'SUPPORT', label: FORM_TYPE_CONFIG.SUPPORT.label, color: FORM_TYPE_CONFIG.SUPPORT.color },
        ]}
        value={filterType as '' | 'DEVIS' | 'MAINTENANCE' | 'SUPPORT'}
        onChange={(v) => { setFilterType(v); setPage(0); }}
        allLabel="Tous"
        size="compact"
      />
      <Tooltip title="Rafraîchir">
        <IconButton size="small" onClick={() => resetAvailabilityMutation.mutate()}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><RefreshIcon size={18} strokeWidth={1.75} /></Box>
        </IconButton>
      </Tooltip>
    </>
  );
  const headerFilters = usePageHeaderFilters(filtersNode);
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

  // ─── Génération du PDF (+ envoi email UNIQUEMENT sur validation explicite) ─
  // « Générer PDF » (send=false) génère et prévisualise le document SANS envoyer
  // le moindre email. L'envoi au prospect ne part QUE via « Renvoyer » (send=true),
  // qui passe par un éditeur de validation (objet + corps). forceResend
  // court-circuite la dédup serveur — on veut toujours partir d'une validation.
  const handleGeneratePdf = async (
    form: ReceivedForm,
    opts: { send?: boolean; forceResend?: boolean; overrides?: { subject?: string; body?: string } } = {},
  ) => {
    const { send = false, forceResend = false, overrides } = opts;
    const tpl = findActiveTemplate(form.formType);
    if (!tpl) {
      notify.error('Aucun template actif trouvé pour ce type de formulaire');
      return;
    }
    const emailTo = form.email?.trim() || '';
    const hasValidEmail = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(emailTo);
    // L'email ne part QUE si l'utilisateur a validé l'envoi (send) ET que l'adresse
    // est valide. La simple génération de PDF n'envoie jamais rien.
    const wantsEmail = send && hasValidEmail;
    try {
      const generation = await generateDocumentMutation.mutateAsync({
        documentType: tpl.documentType,
        referenceId: form.id,
        referenceType: 'RECEIVED_FORM',
        sendEmail: wantsEmail,
        emailTo: wantsEmail ? emailTo : undefined,
        forceResend,
        emailSubject: overrides?.subject,
        emailBody: overrides?.body,
      });
      if (generation?.id) {
        if (!send) {
          notify.success("PDF généré — non envoyé. Utilisez « Renvoyer » pour l'adresser au client.");
        } else if (!hasValidEmail) {
          notify.warning('PDF généré, mais email non envoyé : adresse manquante ou invalide.');
        } else if (generation.emailStatus === 'SENT') {
          notify.success(`Devis envoyé à ${emailTo}`);
        } else if (generation.emailStatus === 'SKIPPED') {
          notify.info(`Le devis avait déjà été envoyé à ${emailTo}.`);
        } else if (generation.emailStatus === 'FAILED') {
          notify.warning("L'envoi de l'email a échoué — réessayez.");
        } else {
          notify.success(`Devis envoyé à ${emailTo}`);
        }
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

  // Ouvre l'éditeur de renvoi : précharge l'objet + le corps du mail devis.
  const openResendModal = async (form: ReceivedForm) => {
    setResend({ open: true, form, subject: '', body: '', loading: true });
    try {
      const tpl = await documentsApi.getQuoteEmailTemplate();
      setResend((r) => ({ ...r, subject: tpl.subject ?? '', body: tpl.body ?? '', loading: false }));
    } catch {
      setResend((r) => ({ ...r, loading: false }));
    }
  };

  // Valide et envoie le devis avec l'objet + le corps (conservés, modifiés ou vidés).
  const confirmResend = async () => {
    const { form, subject, body } = resend;
    if (!form) return;
    setResend((r) => ({ ...r, open: false }));
    await handleGeneratePdf(form, { send: true, forceResend: true, overrides: { subject, body } });
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
      {headerFilters}

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

          {/* ─── Liste gauche (largeur fixe, adaptée au texte) ─── */}
          <Box sx={{ width: CONTACT_LIST_WIDTH, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {listHeaderSlot}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {filteredForms.map(form => {
                const typeConf = FORM_TYPE_CONFIG[form.formType] || FORM_TYPE_CONFIG.DEVIS;
                const statusConf = STATUS_CONFIG[form.status] || STATUS_CONFIG.NEW;
                const isSelected = selectedForm?.id === form.id;

                const formInitials = form.fullName
                  .split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
                return (
                  <InboxListItem
                    key={form.id}
                    active={isSelected}
                    onClick={() => handleSelect(form)}
                    avatar={
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: typeConf.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 600 }}>
                        {formInitials}
                      </Box>
                    }
                    title={form.fullName}
                    time={formatDate(form.createdAt)}
                    meta={
                      <>
                        <Tooltip title={typeConf.label} arrow placement="top">
                          <Box component="span" sx={{ display: 'inline-flex', color: typeConf.color, flexShrink: 0 }}>
                            {React.cloneElement(typeConf.icon as React.ReactElement, { size: 13 })}
                          </Box>
                        </Tooltip>
                        {form.city && (
                          <>
                            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', flexShrink: 0 }}><LocationIcon size={10} strokeWidth={1.75} /></Box>
                            <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {form.city}
                            </Typography>
                          </>
                        )}
                      </>
                    }
                    preview={form.subject}
                    trailing={
                      <Tooltip title={statusConf.label} arrow placement="top">
                        <Box component="span" sx={{ display: 'inline-flex', color: statusConf.color }}>
                          {renderStatusIcon(form.status)}
                        </Box>
                      </Tooltip>
                    }
                  />
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

          {/* ─── Detail droite (remplit l'espace restant) ─── */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedForm ? (
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>

                {/* ── Hero header (avatar + identité + contacts) ─────────── */}
                {(() => {
                  const tc = FORM_TYPE_CONFIG[selectedForm.formType] || FORM_TYPE_CONFIG.DEVIS;
                  const name = selectedForm.fullName || 'Anonyme';
                  const initials = name
                    .split(/[\s.-]+/)
                    .filter(Boolean)
                    .map((w) => w.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join('') || '?';
                  return (
                    <Box sx={{ mb: 3, pb: 2.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {/* Identité : avatar + colonne (nom + chips + date / sujet / contact) */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box
                          sx={{
                            width: 60, height: 60, borderRadius: '18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: tc.color, color: '#fff',
                            fontSize: '1.375rem', fontWeight: 600, letterSpacing: '0.04em',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography sx={{ flex: 1, minWidth: 0, fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.2, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500, flexShrink: 0, ml: 'auto' }}>
                              {formatDate(selectedForm.createdAt)}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.25 }}>
                            {selectedForm.subject || `Formulaire #${selectedForm.id}`}
                          </Typography>
                          {/* Contact info — aligné avec le nom et le sujet */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mt: 1 }}>
                        <Box
                          component="a"
                          href={`mailto:${selectedForm.email}`}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75,
                            color: 'text.primary', textDecoration: 'none',
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
                                color: 'text.primary', textDecoration: 'none',
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
                        {selectedForm.ipAddress && (
                          <Typography sx={{ ml: 'auto', fontSize: '0.625rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                            IP : {selectedForm.ipAddress}
                          </Typography>
                        )}
                          </Box>
                        </Box>
                      </Box>
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
                            color="primary"
                            sx={{
                              textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                              borderRadius: '10px', px: 2.5, py: 0.75,
                              boxShadow: 'none', '&:hover': { boxShadow: 'none' },
                            }}
                          >
                            {generateDocumentMutation.isPending ? 'Génération…' : 'Générer PDF'}
                          </Button>
                        </Tooltip>
                      )}

                      {/* Renvoyer : valide et envoie le devis (le backend déduplique
                          sinon). Visible si un devis a déjà été généré pour ce
                          formulaire et que l'email est valide. C'est le chemin d'envoi
                          — « Générer PDF » seul n'envoie rien. */}
                      {tpl
                        && (priorGenerations?.length ?? 0) > 0
                        && /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(selectedForm.email?.trim() || '') && (
                        <Tooltip
                          title={`Renvoyer le devis à ${selectedForm.email}`}
                          placement="top"
                          arrow
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PdfIcon size={16} strokeWidth={1.75} />}
                            onClick={() => openResendModal(selectedForm)}
                            disabled={generateDocumentMutation.isPending}
                            sx={{
                              textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                              borderRadius: '10px', px: 2.5, py: 0.75,
                              color: 'text.secondary', borderColor: 'divider',
                              '&:hover': { borderColor: 'text.disabled', bgcolor: 'action.hover' },
                            }}
                          >
                            Renvoyer
                          </Button>
                        </Tooltip>
                      )}

                      {selectedForm.status !== 'PROCESSED' && selectedForm.status !== 'ARCHIVED' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<CheckCircleIcon size={16} strokeWidth={1.75} />}
                          onClick={() => handleUpdateStatus('PROCESSED')}
                          disabled={updateStatusMutation.isPending}
                          sx={{
                            textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                            borderRadius: '10px', px: 2.5, py: 0.75,
                          }}
                        >
                          Marquer traite
                        </Button>
                      )}
                      {selectedForm.status !== 'ARCHIVED' && (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ArchiveIcon size={16} strokeWidth={1.75} />}
                          onClick={() => handleUpdateStatus('ARCHIVED')}
                          disabled={updateStatusMutation.isPending}
                          sx={{
                            textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                            borderRadius: '10px', px: 2, py: 0.75,
                            color: 'text.secondary',
                            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                          }}
                        >
                          Archiver
                        </Button>
                      )}
                      {selectedForm.status === 'ARCHIVED' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<RefreshIcon size={16} strokeWidth={1.75} />}
                          onClick={() => handleUpdateStatus('READ')}
                          disabled={updateStatusMutation.isPending}
                          sx={{
                            textTransform: 'none', fontSize: '0.8125rem', fontWeight: 500,
                            borderRadius: '10px', px: 2.5, py: 0.75,
                          }}
                        >
                          Restaurer
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
                      {priorGenerations.slice(0, 5).map((gen) => {
                        // Une generation peut etre en echec (FAILED) : la ligne devient un
                        // diagnostic (icone alerte + message d'erreur), sans lien de preview
                        // trompeur — il n'existe aucun PDF a previsualiser.
                        const isFailed = gen.status === 'FAILED';
                        return (
                          <Box
                            key={gen.id}
                            onClick={isFailed ? undefined : () => openPreview(gen)}
                            sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75, px: 1,
                              borderRadius: '8px', border: '1px solid',
                              borderColor: isFailed ? (t) => alpha(t.palette.error.main, 0.35) : 'divider',
                              bgcolor: isFailed
                                ? (t) => alpha(t.palette.error.main, t.palette.mode === 'dark' ? 0.12 : 0.05)
                                : 'transparent',
                              cursor: isFailed ? 'default' : 'pointer',
                              transition: 'all 150ms',
                              ...(isFailed ? {} : { '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }),
                            }}
                          >
                            <Box component="span" sx={{ display: 'inline-flex', mt: '1px', color: isFailed ? 'error.main' : '#d32f2f' }}>
                              {isFailed
                                ? <AlertTriangleIcon size={16} strokeWidth={1.75} />
                                : <PdfIcon size={16} strokeWidth={1.75} />}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{
                                fontSize: '0.8125rem', fontWeight: 600,
                                color: isFailed ? 'error.main' : 'text.primary',
                                overflow: 'hidden',
                                textOverflow: isFailed ? 'clip' : 'ellipsis',
                                whiteSpace: isFailed ? 'normal' : 'nowrap',
                              }}>
                                {isFailed ? 'Échec de génération' : (gen.fileName || `document-${gen.id}.pdf`)}
                              </Typography>
                              <Typography sx={{
                                fontSize: '0.6875rem', color: 'text.disabled',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: isFailed ? 'normal' : 'nowrap',
                              }}>
                                {isFailed
                                  ? `${gen.errorMessage || 'Cause inconnue'}${gen.createdAt ? ` · ${formatDate(gen.createdAt)}` : ''}`
                                  : `${gen.legalNumber ? `${gen.legalNumber} · ` : ''}${gen.createdAt ? formatDate(gen.createdAt) : ''}`}
                              </Typography>
                            </Box>
                            {!isFailed && (
                              <Typography sx={{ fontSize: '0.6875rem', color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                Aperçu →
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
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

      {/* Éditeur de renvoi du devis : objet + corps modifiables (conserver /
          modifier / vider). info@clenzy.fr est ajouté en CC côté serveur. */}
      <Dialog
        open={resend.open}
        onClose={() => setResend((r) => ({ ...r, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Renvoyer le devis
          {resend.form?.email ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              À {resend.form.email} — info@clenzy.fr en copie
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {resend.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={22} />
            </Box>
          ) : (
            <>
              <TextField
                label="Objet"
                value={resend.subject}
                onChange={(e) => setResend((r) => ({ ...r, subject: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Corps du message"
                value={resend.body}
                onChange={(e) => setResend((r) => ({ ...r, body: e.target.value }))}
                fullWidth
                multiline
                minRows={6}
                helperText="Conservez, modifiez ou videz le contenu. Le PDF du devis est joint automatiquement."
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setResend((r) => ({ ...r, body: '' }))}
            disabled={resend.loading}
            sx={{ textTransform: 'none', color: 'text.secondary', mr: 'auto' }}
          >
            Vider le contenu
          </Button>
          <Button
            onClick={() => setResend((r) => ({ ...r, open: false }))}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={confirmResend}
            disabled={resend.loading || generateDocumentMutation.isPending || !resend.subject.trim()}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', boxShadow: 'none' }}
          >
            Renvoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReceivedFormsTab;
