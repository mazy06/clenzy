import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Switch,
  Tooltip,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  CloudDownload as ImportIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Sync as SyncIcon,
  EventAvailable as EventIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import type { ICalPreviewResponse, ICalImportResponse, ICalEventPreview } from '../../services/api/iCalApi';
import { useAuth } from '../../hooks/useAuth';
import {
  useICalAccess,
  useICalProperties,
  useICalOwners,
  useICalPreview,
  useICalImport,
} from './useICalImport';

// ─── Source logos ─────────────────────────────────────────────────────────────
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.png';
import bookingLogoSmall from '../../assets/logo/logo-booking-planning.png';
import homeAwayLogo from '../../assets/logo/HomeAway-logo.png';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import leboncoinLogo from '../../assets/logo/Leboncoin-logo.png';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ICalImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

interface SourceDef {
  value: string;
  label: string;
  logo?: string;
  patterns: string[];
}

const SOURCES: SourceDef[] = [
  { value: 'Airbnb', label: 'Airbnb', logo: airbnbLogoSmall, patterns: ['airbnb.fr', 'airbnb.com', 'airbnb.co'] },
  { value: 'Booking.com', label: 'Booking.com', logo: bookingLogoSmall, patterns: ['booking.com', 'admin.booking'] },
  { value: 'Vrbo', label: 'Vrbo', logo: homeAwayLogo, patterns: ['vrbo.com', 'homeaway.com', 'abritel.fr'] },
  { value: 'Expedia', label: 'Expedia', logo: expediaLogo, patterns: ['expedia.com', 'expedia.fr'] },
  { value: 'Leboncoin', label: 'Leboncoin', logo: leboncoinLogo, patterns: ['leboncoin.fr'] },
  { value: 'Google Calendar', label: 'Google Calendar', logo: undefined, patterns: ['google.com/calendar', 'calendar.google'] },
  { value: 'Autre', label: 'Autre', logo: undefined, patterns: [] },
];

/** Detect the source platform from an iCal URL */
function detectSourceFromUrl(url: string): SourceDef {
  const lower = url.toLowerCase();
  for (const source of SOURCES) {
    if (source.patterns.some(p => lower.includes(p))) return source;
  }
  return SOURCES[SOURCES.length - 1]; // 'Autre'
}

/** Small circular logo for source display */
const SourceLogoIcon: React.FC<{ logo?: string; label: string; size?: number }> = ({ logo, label, size = 20 }) => {
  if (!logo) return null;
  const imgSize = size * 0.7;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        border: '1.5px solid',
        borderColor: 'divider',
        backgroundColor: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img src={logo} alt={label} width={imgSize} height={imgSize} style={{ objectFit: 'contain', borderRadius: '50%' }} />
    </Box>
  );
};

const STEPS = ['Configuration', 'Aperçu', 'Résultat'];

// ─── Stable sx ───────────────────────────────────────────────────────────────

const SX_FIELD = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.8125rem',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.8125rem',
  },
  '& .MuiFormHelperText-root': {
    fontSize: '0.6875rem',
    mt: 0.5,
  },
} as const;

const SX_SELECT = {
  borderRadius: '10px',
  fontSize: '0.8125rem',
  '& .MuiOutlinedInput-notchedOutline': {
    borderRadius: '10px',
  },
} as const;

// ─── Step indicator component ────────────────────────────────────────────────

const StepIndicator: React.FC<{ steps: string[]; activeStep: number }> = ({ steps, activeStep }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, py: 1.5 }}>
    {steps.map((label, idx) => {
      const isActive = idx === activeStep;
      const isDone = idx < activeStep;
      return (
        <React.Fragment key={label}>
          {idx > 0 && (
            <Box
              sx={{
                width: 48,
                height: 2,
                backgroundColor: isDone ? 'primary.main' : 'divider',
                mx: 0.5,
                borderRadius: 1,
                transition: 'background-color 0.3s',
              }}
            />
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                transition: 'all 0.3s',
                ...(isActive && {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  boxShadow: '0 0 0 3px rgba(107, 138, 154, 0.2)',
                }),
                ...(isDone && {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                }),
                ...(!isActive && !isDone && {
                  backgroundColor: 'action.hover',
                  color: 'text.disabled',
                  border: '1.5px solid',
                  borderColor: 'divider',
                }),
              }}
            >
              {isDone ? '✓' : idx + 1}
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.625rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'text.primary' : 'text.secondary',
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </Typography>
          </Box>
        </React.Fragment>
      );
    })}
  </Box>
);

// ─── Component ───────────────────────────────────────────────────────────────

const ICalImportModal: React.FC<ICalImportModalProps> = ({ open, onClose, onImportSuccess }) => {
  const { user, isAdmin, isManager, isHost } = useAuth();

  // Stepper
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: Config
  const [url, setUrl] = useState('');
  const [ownerId, setOwnerId] = useState<number | ''>('');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [autoCreateInterventions, setAutoCreateInterventions] = useState(false);

  // Auto-detected source from URL
  const detectedSource = detectSourceFromUrl(url);
  const sourceName = detectedSource.value;

  // Step 2: Preview
  const [preview, setPreview] = useState<ICalPreviewResponse | null>(null);

  // Step 3: Result
  const [importResult, setImportResult] = useState<ICalImportResponse | null>(null);

  // Local error for form validation only
  const [formError, setFormError] = useState<string | null>(null);

  const canChangeOwner = isAdmin() || isManager();

  // ─── React Query hooks ──────────────────────────────────────────────

  const accessQuery = useICalAccess(open);
  const propertiesQuery = useICalProperties(open);
  const ownersQuery = useICalOwners(open && canChangeOwner);
  const previewMutation = useICalPreview();
  const importMutation = useICalImport();

  const hasAccess = accessQuery.data?.allowed ?? true;
  const allProperties = propertiesQuery.data ?? [];
  const owners = ownersQuery.data ?? [];

  // Derived loading: any mutation in flight
  const loading = previewMutation.isPending || importMutation.isPending;

  // Derived error: mutation errors or form validation error
  const error =
    formError
    ?? previewMutation.error?.message
    ?? importMutation.error?.message
    ?? null;

  // ─── Auto-set ownerId for host users ────────────────────────────────

  useEffect(() => {
    if (open && isHost() && !canChangeOwner && user?.id && ownerId === '') {
      setOwnerId(Number(user.id));
    }
  }, [open, user?.id]);

  // ─── Proprietes filtrees par proprietaire ────────────────────────────

  const filteredProperties = ownerId
    ? allProperties.filter(p => p.ownerId === Number(ownerId))
    : allProperties;

  useEffect(() => {
    if (propertyId && ownerId) {
      const stillValid = filteredProperties.some(p => p.id === propertyId);
      if (!stillValid) {
        setPropertyId('');
      }
    }
  }, [ownerId]);

  // ─── Nom du proprietaire pour affichage ──────────────────────────────

  const getOwnerDisplayName = (): string => {
    if (!user) return '';
    if (isHost() && !canChangeOwner) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
    }
    if (ownerId) {
      const owner = owners.find(o => o.id === Number(ownerId));
      return owner ? `${owner.firstName} ${owner.lastName}` : '';
    }
    return '';
  };

  // ─── Reset on close ────────────────────────────────────────────────────

  const handleClose = () => {
    setActiveStep(0);
    setUrl('');
    setOwnerId(isHost() && !canChangeOwner && user?.id ? Number(user.id) : '');
    setPropertyId('');
    setAutoCreateInterventions(false);
    setPreview(null);
    setImportResult(null);
    setFormError(null);
    previewMutation.reset();
    importMutation.reset();
    onClose();
  };

  // ─── Step 1 → 2 : Preview ─────────────────────────────────────────────

  const handlePreview = async () => {
    if (!url.trim() || !propertyId) {
      setFormError('Veuillez renseigner l\'URL du calendrier et sélectionner une propriété.');
      return;
    }

    setFormError(null);
    previewMutation.reset();

    try {
      const response = await previewMutation.mutateAsync({
        url: url.trim(),
        propertyId: propertyId as number,
      });
      setPreview(response);
      setActiveStep(1);
    } catch {
      // Error is handled by previewMutation.error
    }
  };

  // ─── Step 2 → 3 : Import ──────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview || !propertyId) return;

    setFormError(null);
    importMutation.reset();

    try {
      const response = await importMutation.mutateAsync({
        url: url.trim(),
        propertyId: propertyId as number,
        sourceName,
        autoCreateInterventions,
      });
      setImportResult(response);
      setActiveStep(2);
      onImportSuccess?.();
    } catch {
      // Error is handled by importMutation.error
    }
  };

  // ─── Format date ──────────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // ─── Render Step 1: Configuration ──────────────────────────────────────

  const renderConfigStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {!hasAccess && (
        <Alert
          severity="warning"
          sx={{ borderRadius: '10px', fontSize: '0.8125rem' }}
        >
          L'import iCal est disponible avec les forfaits Confort et Premium.
        </Alert>
      )}

      {/* Info banner */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          p: 1.5,
          borderRadius: '10px',
          backgroundColor: 'rgba(107, 138, 154, 0.06)',
          border: '1px solid',
          borderColor: 'rgba(107, 138, 154, 0.15)',
        }}
      >
        <InfoIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.25 }} />
        <Box>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}>
            Collez le lien iCal de votre calendrier externe pour importer vos réservations.
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
            Airbnb : Annonce &rarr; Tarification et disponibilité &rarr; Exporter le calendrier
          </Typography>
        </Box>
      </Box>

      {/* URL du calendrier */}
      <TextField
        label="Lien iCal (.ics)"
        placeholder="https://www.airbnb.fr/calendar/ical/12345.ics?s=..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        fullWidth
        required
        disabled={!hasAccess}
        helperText="Copiez le lien iCal depuis votre plateforme de réservation"
        size="small"
        sx={SX_FIELD}
        InputProps={{
          startAdornment: <CalendarIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
        }}
      />

      {/* 2-column grid — champs principaux */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Proprietaire */}
        {canChangeOwner ? (
          <FormControl fullWidth disabled={!hasAccess} size="small" sx={SX_FIELD}>
            <InputLabel>Propriétaire</InputLabel>
            <Select
              value={ownerId}
              label="Propriétaire"
              onChange={(e) => {
                setOwnerId(e.target.value as number);
                setPropertyId('');
              }}
              sx={SX_SELECT}
            >
              {owners.map((owner) => (
                <MenuItem key={owner.id} value={owner.id} sx={{ fontSize: '0.8125rem' }}>
                  {owner.firstName} {owner.lastName} — {owner.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label="Propriétaire"
            value={getOwnerDisplayName()}
            fullWidth
            disabled
            size="small"
            sx={{
              ...SX_FIELD,
              '& .MuiInputBase-input.Mui-disabled': {
                WebkitTextFillColor: 'rgba(0,0,0,0.6)',
              },
            }}
          />
        )}

        {/* Source (auto-detected from URL) */}
        <TextField
          label="Source"
          value={detectedSource.label}
          fullWidth
          disabled
          size="small"
          sx={{
            ...SX_FIELD,
            '& .MuiInputBase-input.Mui-disabled': {
              WebkitTextFillColor: 'rgba(0,0,0,0.7)',
              fontWeight: 600,
            },
          }}
          InputProps={{
            startAdornment: detectedSource.logo ? (
              <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                <SourceLogoIcon logo={detectedSource.logo} label={detectedSource.label} size={22} />
              </Box>
            ) : undefined,
          }}
          helperText="Détecté automatiquement depuis l'URL"
        />

        {/* Propriete */}
        <FormControl fullWidth required disabled={!hasAccess || (canChangeOwner && !ownerId)} size="small" sx={SX_FIELD}>
          <InputLabel>Propriété</InputLabel>
          <Select
            value={propertyId}
            label="Propriété"
            onChange={(e) => setPropertyId(e.target.value as number)}
            sx={SX_SELECT}
          >
            {filteredProperties.map((p) => (
              <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                {p.name} — {p.city}
              </MenuItem>
            ))}
            {filteredProperties.length === 0 && (
              <MenuItem disabled value="">
                <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ fontSize: '0.8125rem' }}>
                  {canChangeOwner && !ownerId
                    ? 'Sélectionnez d\'abord un propriétaire'
                    : 'Aucune propriété disponible'}
                </Typography>
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </Box>

      {/* Menage automatique — ligne inline legere */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          cursor: 'pointer',
        }}
        onClick={() => hasAccess && setAutoCreateInterventions(!autoCreateInterventions)}
      >
        <Tooltip
          title={!hasAccess ? 'Disponible avec le forfait Confort ou Premium' : ''}
          arrow
        >
          <span>
            <Switch
              checked={autoCreateInterventions}
              onChange={(e) => setAutoCreateInterventions(e.target.checked)}
              disabled={!hasAccess}
              color="primary"
              size="small"
            />
          </span>
        </Tooltip>
        <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}>
          Ménage automatique
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
          — Planifie un ménage le jour du checkout à l'heure de départ du voyageur
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => { setFormError(null); previewMutation.reset(); }}
          sx={{ borderRadius: '10px', fontSize: '0.8125rem' }}
        >
          {error}
        </Alert>
      )}
    </Box>
  );

  // ─── Render Step 2: Preview ────────────────────────────────────────────

  const renderPreviewStep = () => {
    if (!preview) return null;

    const allEvents = preview.events;
    const totalCount = allEvents.length;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
            {preview.propertyName}
          </Typography>
          <Chip
            icon={<EventIcon sx={{ fontSize: 14 }} />}
            label={`${totalCount} réservation${totalCount > 1 ? 's' : ''}`}
            color="primary"
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              height: 24,
              '& .MuiChip-icon': { fontSize: 14 },
            }}
          />
        </Box>

        {totalCount === 0 && (
          <Alert severity="info" sx={{ borderRadius: '10px', fontSize: '0.8125rem' }}>
            Aucune réservation trouvée dans ce calendrier.
          </Alert>
        )}

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            maxHeight: 320,
            borderRadius: '10px',
            '& .MuiTableCell-root': { fontSize: '0.8125rem', py: 1, px: 1.5 },
            '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Arrivée</TableCell>
                <TableCell>Départ</TableCell>
                <TableCell align="center">Nuits</TableCell>
                <TableCell>Guest / Détails</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allEvents.map((event: ICalEventPreview, index: number) => (
                <TableRow key={`evt-${index}`} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>{formatDate(event.dtStart)}</TableCell>
                  <TableCell>{formatDate(event.dtEnd)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={event.nights || '-'}
                      size="small"
                      sx={{ fontSize: '0.6875rem', fontWeight: 600, height: 22, minWidth: 28 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                      {event.guestName || event.summary || 'Réservation'}
                    </Typography>
                    {event.confirmationCode && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                        {event.confirmationCode}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {autoCreateInterventions && totalCount > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: '10px',
              backgroundColor: 'rgba(107, 138, 154, 0.06)',
              border: '1px solid',
              borderColor: 'rgba(107, 138, 154, 0.15)',
            }}
          >
            <SyncIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.25 }} />
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              {totalCount} intervention{totalCount > 1 ? 's' : ''} de ménage
              {totalCount > 1 ? ' seront' : ' sera'} automatiquement planifiée{totalCount > 1 ? 's' : ''} à l'heure de départ du voyageur, le jour du checkout.
            </Typography>
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={() => { setFormError(null); importMutation.reset(); }}
            sx={{ borderRadius: '10px', fontSize: '0.8125rem' }}
          >
            {error}
          </Alert>
        )}
      </Box>
    );
  };

  // ─── Render Step 3: Result ─────────────────────────────────────────────

  const renderResultStep = () => {
    if (!importResult) return null;

    const hasErrors = importResult.errors && importResult.errors.length > 0;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'center', py: 3 }}>
        {/* Success/Warning icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hasErrors ? 'rgba(255, 152, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
          }}
        >
          {!hasErrors ? (
            <CheckCircleIcon sx={{ fontSize: 36, color: 'success.main' }} />
          ) : (
            <ErrorIcon sx={{ fontSize: 36, color: 'warning.main' }} />
          )}
        </Box>

        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Import terminé
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={`${importResult.imported} importée${importResult.imported > 1 ? 's' : ''}`}
            color="success"
            variant="outlined"
            size="small"
            sx={{ fontSize: '0.6875rem', fontWeight: 600, height: 28, '& .MuiChip-icon': { fontSize: 14 } }}
          />
          <Chip
            label={`${importResult.skipped} doublon${importResult.skipped > 1 ? 's' : ''} ignoré${importResult.skipped > 1 ? 's' : ''}`}
            variant="outlined"
            size="small"
            sx={{ fontSize: '0.6875rem', fontWeight: 600, height: 28, borderColor: 'divider', color: 'text.secondary' }}
          />
          {hasErrors && (
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 14 }} />}
              label={`${importResult.errors.length} erreur${importResult.errors.length > 1 ? 's' : ''}`}
              color="error"
              variant="outlined"
              size="small"
              sx={{ fontSize: '0.6875rem', fontWeight: 600, height: 28, '& .MuiChip-icon': { fontSize: 14 } }}
            />
          )}
        </Box>

        {hasErrors && (
          <Alert severity="warning" sx={{ width: '100%', borderRadius: '10px', fontSize: '0.8125rem' }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, fontSize: '0.8125rem' }}>
              Certains événements n'ont pas pu être importés :
            </Typography>
            {importResult.errors.map((err, i) => (
              <Typography key={i} variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                &bull; {err}
              </Typography>
            ))}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            p: 1.5,
            borderRadius: '10px',
            backgroundColor: 'rgba(107, 138, 154, 0.06)',
            border: '1px solid',
            borderColor: 'rgba(107, 138, 154, 0.15)',
            width: '100%',
          }}
        >
          <SyncIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.25 }} />
          <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
            Votre calendrier sera automatiquement re-synchronisé toutes les 3 heures.
            Les doublons sont ignorés automatiquement.
          </Typography>
        </Box>
      </Box>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const totalPreviewEvents = preview?.events.length || 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        },
      }}
    >
      {/* ─── Title ──────────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(107, 138, 154, 0.08)',
            }}
          >
            <CalendarIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
            Import Calendrier iCal
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary', '&:hover': { backgroundColor: 'action.hover' } }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* ─── Stepper ────────────────────────────────────────────────────── */}
      <Box sx={{ px: 3, pt: 0.5 }}>
        <StepIndicator steps={STEPS} activeStep={activeStep} />
      </Box>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {activeStep === 0 && renderConfigStep()}
        {activeStep === 1 && renderPreviewStep()}
        {activeStep === 2 && renderResultStep()}
      </DialogContent>

      {/* ─── Actions ────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          gap: 1,
          justifyContent: 'flex-end',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {activeStep === 0 && (
          <>
            <Button
              onClick={handleClose}
              variant="outlined"
              size="small"
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                px: 2.5,
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': { borderColor: 'text.secondary', backgroundColor: 'action.hover' },
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePreview}
              variant="contained"
              size="small"
              disabled={loading || !hasAccess || !url.trim() || !propertyId}
              startIcon={loading ? <CircularProgress size={16} /> : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                px: 2.5,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {loading ? 'Chargement...' : 'Prévisualiser'}
            </Button>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Button
              onClick={() => { setActiveStep(0); setFormError(null); previewMutation.reset(); importMutation.reset(); }}
              variant="outlined"
              size="small"
              disabled={loading}
              startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                px: 2.5,
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': { borderColor: 'text.secondary', backgroundColor: 'action.hover' },
              }}
            >
              Retour
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              size="small"
              disabled={loading || !preview || totalPreviewEvents === 0}
              startIcon={loading ? <CircularProgress size={16} /> : <ImportIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                px: 2.5,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {loading
                ? 'Import en cours...'
                : `Importer ${totalPreviewEvents} réservation${totalPreviewEvents > 1 ? 's' : ''}`}
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <Button
            onClick={handleClose}
            variant="contained"
            size="small"
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              px: 3,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Fermer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ICalImportModal;
