import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Link,
} from '@mui/material';
import { Close, Send } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import apiClient from '../../../services/apiClient';

// ── Service type options (mirrored from backend ServiceType enum) ────────────
const SERVICE_TYPE_OPTIONS: { value: string; label: string; category: 'cleaning' | 'maintenance' | 'other' }[] = [
  { value: 'CLEANING', label: 'Ménage', category: 'cleaning' },
  { value: 'EXPRESS_CLEANING', label: 'Ménage express', category: 'cleaning' },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en profondeur', category: 'cleaning' },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des vitres', category: 'cleaning' },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des sols', category: 'cleaning' },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la cuisine', category: 'cleaning' },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des sanitaires', category: 'cleaning' },
  { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance préventive', category: 'maintenance' },
  { value: 'EMERGENCY_REPAIR', label: "Réparation d'urgence", category: 'maintenance' },
  { value: 'ELECTRICAL_REPAIR', label: 'Réparation électrique', category: 'maintenance' },
  { value: 'PLUMBING_REPAIR', label: 'Réparation plomberie', category: 'maintenance' },
  { value: 'HVAC_REPAIR', label: 'Réparation climatisation', category: 'maintenance' },
  { value: 'APPLIANCE_REPAIR', label: 'Réparation électroménager', category: 'maintenance' },
  { value: 'GARDENING', label: 'Jardinage', category: 'other' },
  { value: 'EXTERIOR_CLEANING', label: 'Nettoyage extérieur', category: 'other' },
  { value: 'PEST_CONTROL', label: 'Désinsectisation', category: 'other' },
  { value: 'DISINFECTION', label: 'Désinfection', category: 'other' },
  { value: 'RESTORATION', label: 'Remise en état', category: 'other' },
  { value: 'OTHER', label: 'Autre', category: 'other' },
];

const PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Normale' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'CRITICAL', label: 'Critique' },
];

const DEFAULT_DURATIONS: Record<string, number> = {
  CLEANING: 2,
  EXPRESS_CLEANING: 1,
  DEEP_CLEANING: 4,
  WINDOW_CLEANING: 1.5,
  FLOOR_CLEANING: 1,
  KITCHEN_CLEANING: 1.5,
  BATHROOM_CLEANING: 1,
  PREVENTIVE_MAINTENANCE: 2,
  EMERGENCY_REPAIR: 3,
  ELECTRICAL_REPAIR: 2.5,
  PLUMBING_REPAIR: 2.5,
  HVAC_REPAIR: 3,
  APPLIANCE_REPAIR: 2,
  GARDENING: 2,
  EXTERIOR_CLEANING: 2.5,
  PEST_CONTROL: 1.5,
  DISINFECTION: 2,
  RESTORATION: 6,
  OTHER: 2,
};

// ── Props ────────────────────────────────────────────────────────────────────
interface CreateServiceRequestDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  propertyName: string;
  /** Pre-select a service type category */
  defaultServiceType?: string;
  /** Pre-fill desired date (e.g. reservation checkOut) */
  defaultDesiredDate?: string;
  /** Callback after successful creation */
  onCreated?: (serviceRequestId: number) => void;
}

const CreateServiceRequestDialog: React.FC<CreateServiceRequestDialogProps> = ({
  open,
  onClose,
  propertyId,
  propertyName,
  defaultServiceType,
  defaultDesiredDate,
  onCreated,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [serviceType, setServiceType] = useState(defaultServiceType || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [desiredDate, setDesiredDate] = useState(defaultDesiredDate || today);
  const [estimatedDurationHours, setEstimatedDurationHours] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setServiceType(defaultServiceType || '');
      setTitle('');
      setDescription('');
      setPriority('NORMAL');
      setDesiredDate(defaultDesiredDate || today);
      setEstimatedDurationHours(defaultServiceType ? (DEFAULT_DURATIONS[defaultServiceType] || 2) : 2);
      setError(null);
      setCreatedId(null);
    }
  }, [open, defaultServiceType, defaultDesiredDate, today]);

  // Auto-generate title when service type changes
  useEffect(() => {
    if (serviceType && !title) {
      const typeLabel = SERVICE_TYPE_OPTIONS.find((o) => o.value === serviceType)?.label || serviceType;
      setTitle(`${typeLabel} - ${propertyName}`);
    }
  }, [serviceType, propertyName, title]);

  // Update duration when service type changes
  useEffect(() => {
    if (serviceType) {
      setEstimatedDurationHours(DEFAULT_DURATIONS[serviceType] || 2);
    }
  }, [serviceType]);

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = async () => {
    if (!serviceType) {
      setError('Le type de service est obligatoire');
      return;
    }
    if (!title.trim()) {
      setError('Le titre est obligatoire');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const desiredDateISO = desiredDate ? new Date(desiredDate).toISOString() : null;

      const backendData: Record<string, string | number | boolean | null> = {
        title: title.trim(),
        description: description.trim() || '',
        propertyId,
        serviceType,
        priority,
        estimatedDurationHours,
        desiredDate: desiredDateISO,
        userId: user?.databaseId ?? null,
        status: 'PENDING',
      };

      const result = await apiClient.post<{ id: number }>('/service-requests', backendData);
      const newId = result?.id;
      setCreatedId(newId || null);
      onCreated?.(newId);
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Send sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Nouvelle demande de service
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
        {/* Property info */}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
          Logement : <strong>{propertyName}</strong>
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Service Type */}
          <TextField
            select
            label="Type de service"
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value);
              // Reset title so it auto-generates
              setTitle('');
            }}
            size="small"
            fullWidth
            required
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          >
            <MenuItem disabled value="">
              <em>Sélectionner un type</em>
            </MenuItem>
            {SERVICE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          {/* Title */}
          <TextField
            label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
            required
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Instructions, détails, accès..."
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />

          {/* Priority & Desired Date */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              select
              label="Priorité"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Date souhaitée"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>

          {/* Duration */}
          <TextField
            type="number"
            label="Durée estimée (heures)"
            value={estimatedDurationHours}
            onChange={(e) => setEstimatedDurationHours(Math.max(0.5, Number(e.target.value)))}
            size="small"
            fullWidth
            inputProps={{ min: 0.5, step: 0.5 }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />
        </Box>

        {/* Info: workflow explanation */}
        <Alert severity="info" sx={{ fontSize: '0.6875rem', mt: 2, '& .MuiAlert-message': { fontSize: '0.6875rem' } }}>
          La demande sera soumise au workflow : validation → assignation → paiement → intervention planifiée.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
            {error}
          </Alert>
        )}

        {createdId && (
          <Alert severity="success" sx={{ fontSize: '0.75rem', mt: 1.5 }}>
            Demande créée.{' '}
            <Link
              component="button"
              onClick={() => navigate(`/service-requests/${createdId}`)}
              sx={{ fontSize: '0.75rem' }}
            >
              Voir la demande
            </Link>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
        <Button onClick={handleClose} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          size="small"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} /> : <Send sx={{ fontSize: 16 }} />}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Créer la demande
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceRequestDialog;
