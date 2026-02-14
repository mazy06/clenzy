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
  Stepper,
  Step,
  StepLabel,
  Alert,
  Switch,
  FormControlLabel,
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
  Block as BlockIcon,
} from '@mui/icons-material';
import { iCalApi } from '../../services/api/iCalApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import type { ICalPreviewResponse, ICalImportResponse, ICalEventPreview } from '../../services/api/iCalApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ICalImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

const SOURCES = [
  { value: 'Airbnb', label: 'Airbnb' },
  { value: 'Booking.com', label: 'Booking.com' },
  { value: 'Vrbo', label: 'Vrbo' },
  { value: 'Google Calendar', label: 'Google Calendar' },
  { value: 'Autre', label: 'Autre' },
];

const STEPS = ['Configuration', 'Apercu', 'Resultat'];

// ─── Component ───────────────────────────────────────────────────────────────

const ICalImportModal: React.FC<ICalImportModalProps> = ({ open, onClose, onImportSuccess }) => {
  // Stepper
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: Config
  const [url, setUrl] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [sourceName, setSourceName] = useState('Airbnb');
  const [autoCreateInterventions, setAutoCreateInterventions] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [hasAccess, setHasAccess] = useState(true);

  // Step 2: Preview
  const [preview, setPreview] = useState<ICalPreviewResponse | null>(null);

  // Step 3: Result
  const [importResult, setImportResult] = useState<ICalImportResponse | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load properties + check access on open ───────────────────────────

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  const loadInitialData = async () => {
    try {
      const [propertiesPage, accessCheck] = await Promise.all([
        propertiesApi.getAll({ size: 500, sort: 'name,asc' }),
        iCalApi.checkAccess(),
      ]);
      // getAll() returns a Spring Page object — extract the content array
      const list = Array.isArray(propertiesPage) ? propertiesPage : (propertiesPage as any).content ?? [];
      setProperties(list);
      setHasAccess(accessCheck.allowed);
    } catch (err) {
      console.error('Erreur chargement donnees initiales:', err);
    }
  };

  // ─── Reset on close ────────────────────────────────────────────────────

  const handleClose = () => {
    setActiveStep(0);
    setUrl('');
    setPropertyId('');
    setSourceName('Airbnb');
    setAutoCreateInterventions(false);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  // ─── Step 1 → 2 : Preview ─────────────────────────────────────────────

  const handlePreview = async () => {
    if (!url.trim() || !propertyId) {
      setError('Veuillez renseigner l\'URL du calendrier et selectionner une propriete.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await iCalApi.previewFeed({ url: url.trim(), propertyId: propertyId as number });
      setPreview(response);
      setActiveStep(1);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la previsualisation du calendrier.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2 → 3 : Import ──────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview || !propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await iCalApi.importFeed({
        url: url.trim(),
        propertyId: propertyId as number,
        sourceName,
        autoCreateInterventions,
      });
      setImportResult(response);
      setActiveStep(2);
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import du calendrier.');
    } finally {
      setLoading(false);
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
        <Alert severity="warning" sx={{ mb: 1 }}>
          L'import iCal est disponible avec les forfaits Confort et Premium.
          Mettez a jour votre forfait pour acceder a cette fonctionnalite.
        </Alert>
      )}

      <Alert severity="info" icon={<InfoIcon />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
        <Typography variant="body2">
          Collez le lien iCal de votre calendrier externe pour importer vos reservations.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Airbnb : Annonce &rarr; Tarification et disponibilite &rarr; Exporter le calendrier
        </Typography>
      </Alert>

      <TextField
        label="Lien iCal (.ics)"
        placeholder="https://www.airbnb.fr/calendar/ical/12345.ics?s=..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        fullWidth
        required
        disabled={!hasAccess}
        helperText="Copiez le lien iCal depuis votre plateforme de reservation"
        InputProps={{
          startAdornment: <CalendarIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
        }}
      />

      <FormControl fullWidth required disabled={!hasAccess}>
        <InputLabel>Propriete</InputLabel>
        <Select
          value={propertyId}
          label="Propriete"
          onChange={(e) => setPropertyId(e.target.value as number)}
        >
          {properties.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} — {p.city}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth disabled={!hasAccess}>
        <InputLabel>Source</InputLabel>
        <Select
          value={sourceName}
          label="Source"
          onChange={(e) => setSourceName(e.target.value)}
        >
          {SOURCES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        bgcolor: autoCreateInterventions ? 'primary.50' : 'transparent',
        transition: 'background-color 0.2s',
      }}>
        <FormControlLabel
          control={
            <Tooltip
              title={
                !hasAccess
                  ? 'Disponible avec le forfait Confort ou Premium'
                  : ''
              }
              arrow
            >
              <span>
                <Switch
                  checked={autoCreateInterventions}
                  onChange={(e) => setAutoCreateInterventions(e.target.checked)}
                  disabled={!hasAccess}
                  color="primary"
                />
              </span>
            </Tooltip>
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Menage automatique fin de sejour
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Planifie automatiquement un menage le jour du checkout a 11h00 pour chaque reservation importee
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', ml: 0 }}
        />
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );

  // ─── Render Step 2: Preview ────────────────────────────────────────────

  const renderPreviewStep = () => {
    if (!preview) return null;

    const reservations = preview.events.filter((e: ICalEventPreview) => e.type === 'reservation');
    const blocked = preview.events.filter((e: ICalEventPreview) => e.type === 'blocked');

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {preview.propertyName}
          </Typography>
          <Chip
            icon={<EventIcon sx={{ fontSize: 16 }} />}
            label={`${preview.totalReservations} reservation${preview.totalReservations > 1 ? 's' : ''}`}
            color="primary"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<BlockIcon sx={{ fontSize: 16 }} />}
            label={`${preview.totalBlocked} date${preview.totalBlocked > 1 ? 's' : ''} bloquee${preview.totalBlocked > 1 ? 's' : ''}`}
            color="default"
            size="small"
            variant="outlined"
          />
        </Box>

        {preview.totalReservations === 0 && (
          <Alert severity="info">
            Aucune reservation trouvee dans ce calendrier. Seules des dates bloquees ont ete detectees.
          </Alert>
        )}

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Arrivee</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Depart</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Nuits</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Guest</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.map((event: ICalEventPreview, index: number) => (
                <TableRow key={`res-${index}`} hover>
                  <TableCell>{formatDate(event.dtStart)}</TableCell>
                  <TableCell>{formatDate(event.dtEnd)}</TableCell>
                  <TableCell align="center">{event.nights || '-'}</TableCell>
                  <TableCell>
                    {event.guestName || '-'}
                    {event.confirmationCode && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {event.confirmationCode}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label="Reservation" color="success" size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
              {blocked.map((event: ICalEventPreview, index: number) => (
                <TableRow key={`blk-${index}`} hover sx={{ opacity: 0.6 }}>
                  <TableCell>{formatDate(event.dtStart)}</TableCell>
                  <TableCell>{formatDate(event.dtEnd)}</TableCell>
                  <TableCell align="center">{event.nights || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      {event.summary || 'Date bloquee'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label="Bloquee" color="default" size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {autoCreateInterventions && preview.totalReservations > 0 && (
          <Alert severity="info" icon={<SyncIcon />}>
            {preview.totalReservations} intervention{preview.totalReservations > 1 ? 's' : ''} de menage
            {preview.totalReservations > 1 ? ' seront' : ' sera'} automatiquement planifiee{preview.totalReservations > 1 ? 's' : ''} a 11h00 chaque jour de checkout.
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 2 }}>
        {!hasErrors ? (
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
        ) : (
          <ErrorIcon sx={{ fontSize: 64, color: 'warning.main' }} />
        )}

        <Typography variant="h6" textAlign="center">
          Import termine
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${importResult.imported} importee${importResult.imported > 1 ? 's' : ''}`}
            color="success"
            variant="outlined"
          />
          <Chip
            label={`${importResult.skipped} doublon${importResult.skipped > 1 ? 's' : ''} ignore${importResult.skipped > 1 ? 's' : ''}`}
            color="default"
            variant="outlined"
          />
          {hasErrors && (
            <Chip
              icon={<ErrorIcon />}
              label={`${importResult.errors.length} erreur${importResult.errors.length > 1 ? 's' : ''}`}
              color="error"
              variant="outlined"
            />
          )}
        </Box>

        {hasErrors && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
              Certains evenements n'ont pas pu etre importes :
            </Typography>
            {importResult.errors.map((err, i) => (
              <Typography key={i} variant="caption" display="block" color="text.secondary">
                &bull; {err}
              </Typography>
            ))}
          </Alert>
        )}

        <Alert severity="info" sx={{ width: '100%' }}>
          <Typography variant="body2">
            Votre calendrier sera automatiquement re-synchronise toutes les 3 heures.
            Les doublons sont ignores automatiquement.
          </Typography>
        </Alert>
      </Box>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          minHeight: 400,
        },
      }}
    >
      {/* ─── Title ──────────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <CalendarIcon color="primary" />
          <Typography variant="h6" component="div">
            Import Calendrier iCal
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ─── Stepper ────────────────────────────────────────────────────── */}
      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {activeStep === 0 && renderConfigStep()}
        {activeStep === 1 && renderPreviewStep()}
        {activeStep === 2 && renderResultStep()}
      </DialogContent>

      {/* ─── Actions ────────────────────────────────────────────────────── */}
      <DialogActions sx={{ px: 3, pb: 3, gap: 1, justifyContent: 'flex-end' }}>
        {activeStep === 0 && (
          <>
            <Button onClick={handleClose} variant="outlined" sx={{ minWidth: 100 }}>
              Annuler
            </Button>
            <Button
              onClick={handlePreview}
              variant="contained"
              disabled={loading || !hasAccess || !url.trim() || !propertyId}
              startIcon={loading ? <CircularProgress size={18} /> : <ImportIcon />}
              sx={{ minWidth: 140 }}
            >
              {loading ? 'Chargement...' : 'Previsualiser'}
            </Button>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Button
              onClick={() => { setActiveStep(0); setError(null); }}
              variant="outlined"
              disabled={loading}
              sx={{ minWidth: 100 }}
            >
              Retour
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              color="primary"
              disabled={loading || !preview || preview.totalReservations === 0}
              startIcon={loading ? <CircularProgress size={18} /> : <ImportIcon />}
              sx={{ minWidth: 180 }}
            >
              {loading
                ? 'Import en cours...'
                : `Importer ${preview?.totalReservations || 0} reservation${(preview?.totalReservations || 0) > 1 ? 's' : ''}`}
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <Button onClick={handleClose} variant="contained" sx={{ minWidth: 100 }}>
            Fermer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ICalImportModal;
