/**
 * Channex Property Mapping Dialog
 *
 * Permet a un admin / manager de connecter / deconnecter / re-syncer les
 * properties de l'organisation avec leur equivalent Channex.
 *
 * Flux UX :
 *   1. Au clic sur la card Channex dans IntegrationsSection → ouverture du dialog
 *   2. Liste des properties Clenzy + statut Channex (badge + tooltip)
 *   3. Property non connectee → bouton "Connecter" qui ouvre un sub-form
 *      avec 3 champs (property/room_type/rate_plan IDs Channex)
 *   4. Property connectee → boutons "Resync" + "Deconnecter"
 *
 * Reference : docs/strategy/channex-integration-plan.md (Sprint 5)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import { X, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, PauseCircle, ExternalLink } from 'lucide-react';

import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import {
  channexApi,
  CHANNEX_STATUS_META,
  type ChannexMappingDto,
  type ChannexSyncStatus,
} from '../../../services/api/channexApi';

interface ChannexMappingDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ConnectFormState {
  open: boolean;
  property: Property | null;
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
  submitting: boolean;
  error: string | null;
}

const initialConnectForm: ConnectFormState = {
  open: false,
  property: null,
  channexPropertyId: '',
  channexRoomTypeId: '',
  channexDefaultRatePlanId: '',
  submitting: false,
  error: null,
};

function StatusBadge({ status }: { status: ChannexSyncStatus }) {
  const meta = CHANNEX_STATUS_META[status];
  const icon = useMemo(() => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 size={14} strokeWidth={2} />;
      case 'PENDING':
        return <Clock size={14} strokeWidth={2} />;
      case 'ERROR':
        return <AlertCircle size={14} strokeWidth={2} />;
      case 'DISABLED':
        return <PauseCircle size={14} strokeWidth={2} />;
    }
  }, [status]);

  return (
    <Tooltip title={meta.description} placement="top" arrow>
      <Chip
        size="small"
        icon={icon}
        label={meta.label}
        sx={{
          backgroundColor: `${meta.color}1A`,
          color: meta.color,
          fontWeight: 600,
          fontSize: '0.7rem',
          height: 22,
          '& .MuiChip-icon': { color: meta.color, marginLeft: '6px' },
          '& .MuiChip-label': { paddingLeft: '6px', paddingRight: '8px' },
        }}
      />
    </Tooltip>
  );
}

export default function ChannexMappingDialog({ open, onClose }: ChannexMappingDialogProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [mappings, setMappings] = useState<Map<number, ChannexMappingDto>>(new Map());
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [connectForm, setConnectForm] = useState<ConnectFormState>(initialConnectForm);
  const [busyPropertyId, setBusyPropertyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const [propsRes, mappingsRes] = await Promise.all([
        propertiesApi.getAll({ size: 200 }),
        channexApi.listMappings(),
      ]);
      const list = Array.isArray(propsRes) ? propsRes : [];
      setProperties(list);
      const map = new Map<number, ChannexMappingDto>();
      for (const m of mappingsRes) map.set(m.clenzyPropertyId, m);
      setMappings(map);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleConnectClick = (property: Property) => {
    setConnectForm({ ...initialConnectForm, open: true, property });
  };

  const handleConnectSubmit = async () => {
    if (!connectForm.property) return;
    const ids = {
      channexPropertyId: connectForm.channexPropertyId.trim(),
      channexRoomTypeId: connectForm.channexRoomTypeId.trim(),
      channexDefaultRatePlanId: connectForm.channexDefaultRatePlanId.trim(),
    };
    if (!ids.channexPropertyId || !ids.channexRoomTypeId || !ids.channexDefaultRatePlanId) {
      setConnectForm((s) => ({ ...s, error: 'Les 3 IDs Channex sont obligatoires.' }));
      return;
    }

    setConnectForm((s) => ({ ...s, submitting: true, error: null }));
    try {
      const mapping = await channexApi.connect(connectForm.property.id, ids);
      setMappings((prev) => {
        const next = new Map(prev);
        next.set(mapping.clenzyPropertyId, mapping);
        return next;
      });
      setConnectForm(initialConnectForm);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la connexion a Channex.';
      setConnectForm((s) => ({ ...s, submitting: false, error: message }));
    }
  };

  const handleDisconnect = async (property: Property) => {
    if (!window.confirm(
      `Deconnecter "${property.name}" de Channex ?\n\n` +
      `Le mapping local sera supprime. La property restera presente cote dashboard Channex (a supprimer manuellement si besoin).`,
    )) return;
    setBusyPropertyId(property.id);
    try {
      await channexApi.disconnect(property.id);
      setMappings((prev) => {
        const next = new Map(prev);
        next.delete(property.id);
        return next;
      });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors de la deconnexion.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const handleResync = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      await channexApi.resync(property.id, 6);
      // Refresh juste le mapping concerne
      const fresh = await channexApi.getMapping(property.id);
      if (fresh) {
        setMappings((prev) => {
          const next = new Map(prev);
          next.set(fresh.clenzyPropertyId, fresh);
          return next;
        });
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors du re-sync.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const ACCENT = '#0F766E'; // teal Channex

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
            py: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Channex — Mapping des proprietes
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              Connectez chaque propriete a son equivalent Channex pour activer la sync OTA (Airbnb, Booking, Vrbo, ...)
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {/* Help banner */}
          <Alert
            severity="info"
            icon={<ExternalLink size={16} />}
            sx={{
              mb: 2,
              fontSize: '0.78rem',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Box>
              <strong>Avant de connecter une propriete :</strong> creez son equivalent dans le
              dashboard Channex (Property → Room Type → Rate Plan) et notez les 3 IDs.
              Documentation API :{' '}
              <a
                href="https://docs.channex.io/api-reference"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: ACCENT, fontWeight: 600 }}
              >
                docs.channex.io
              </a>
            </Box>
          </Alert>

          {globalError && (
            <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>
              {globalError}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : properties.length === 0 ? (
            <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: '0.85rem' }}>
              Aucune propriete dans votre organisation.
            </Typography>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {properties.map((property) => {
                const mapping = mappings.get(property.id);
                const isBusy = busyPropertyId === property.id;
                return (
                  <Box
                    key={property.id}
                    sx={{
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }} noWrap>
                        {property.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }} noWrap>
                          {property.city} · {property.type}
                        </Typography>
                        {mapping && <StatusBadge status={mapping.syncStatus} />}
                      </Box>
                      {mapping?.lastSyncError && (
                        <Tooltip title={mapping.lastSyncError} arrow>
                          <Typography
                            sx={{
                              fontSize: '0.7rem',
                              color: '#EF4444',
                              mt: 0.5,
                              fontStyle: 'italic',
                              maxWidth: 360,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {mapping.lastSyncError}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {!mapping ? (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Plus size={14} />}
                          disabled={isBusy}
                          onClick={() => handleConnectClick(property)}
                          sx={{
                            backgroundColor: ACCENT,
                            '&:hover': { backgroundColor: '#0d645e' },
                            textTransform: 'none',
                            fontSize: '0.75rem',
                          }}
                        >
                          Connecter
                        </Button>
                      ) : (
                        <>
                          <Tooltip title="Re-pousser prix + dispo (6 mois)">
                            <span>
                              <IconButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => handleResync(property)}
                                sx={{ color: ACCENT }}
                              >
                                {isBusy ? <CircularProgress size={14} /> : <RefreshCw size={14} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Deconnecter">
                            <span>
                              <IconButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => handleDisconnect(property)}
                                sx={{ color: '#EF4444' }}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: connect form */}
      <Dialog
        open={connectForm.open}
        onClose={() => setConnectForm(initialConnectForm)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
            Connecter "{connectForm.property?.name}" a Channex
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            Renseignez les 3 identifiants Channex (visibles dans votre dashboard)
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {connectForm.error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>
              {connectForm.error}
            </Alert>
          )}

          <Stack spacing={1.5}>
            <TextField
              label="Channex Property ID"
              fullWidth
              size="small"
              value={connectForm.channexPropertyId}
              onChange={(e) =>
                setConnectForm((s) => ({ ...s, channexPropertyId: e.target.value }))
              }
              disabled={connectForm.submitting}
              placeholder="ex: 8f8a2c1a-4b5e-..."
              helperText="UUID de la Property dans Channex"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Channex Room Type ID"
              fullWidth
              size="small"
              value={connectForm.channexRoomTypeId}
              onChange={(e) =>
                setConnectForm((s) => ({ ...s, channexRoomTypeId: e.target.value }))
              }
              disabled={connectForm.submitting}
              placeholder="ex: 1d2e3f4a-..."
              helperText="Room Type rattache a la property"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Channex Default Rate Plan ID"
              fullWidth
              size="small"
              value={connectForm.channexDefaultRatePlanId}
              onChange={(e) =>
                setConnectForm((s) => ({ ...s, channexDefaultRatePlanId: e.target.value }))
              }
              disabled={connectForm.submitting}
              placeholder="ex: 5b6c7d8e-..."
              helperText="Rate Plan par defaut utilise pour pousser les prix"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Alert severity="info" sx={{ mt: 2, fontSize: '0.72rem' }}>
            Apres connexion, un push initial de 6 mois (prix + disponibilites) sera declenche automatiquement.
          </Alert>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button
              size="small"
              onClick={() => setConnectForm(initialConnectForm)}
              disabled={connectForm.submitting}
              sx={{ textTransform: 'none' }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleConnectSubmit}
              disabled={connectForm.submitting}
              startIcon={
                connectForm.submitting ? <CircularProgress size={12} sx={{ color: 'white' }} /> : null
              }
              sx={{
                backgroundColor: ACCENT,
                '&:hover': { backgroundColor: '#0d645e' },
                textTransform: 'none',
              }}
            >
              {connectForm.submitting ? 'Connexion...' : 'Connecter'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
