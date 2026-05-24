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
  ButtonBase,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import { X, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, PauseCircle, ExternalLink, Download, Link2, ArrowLeft, ChevronRight, Globe, Home, Sparkles } from 'lucide-react';

import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import {
  channexApi,
  CHANNEX_OTA_OPTIONS,
  CHANNEX_STATUS_META,
  type ChannexConnectMode,
  type ChannexMappingDto,
  type ChannexOtaCode,
  type ChannexSyncStatus,
} from '../../../services/api/channexApi';
import ChannexEmbedDialog from './ChannexEmbedDialog';
import ChannexOtaPickerDialog from './ChannexOtaPickerDialog';
import ChannexImportDiscoveryDialog from './ChannexImportDiscoveryDialog';
import ChannexFullDisconnectDialog from './ChannexFullDisconnectDialog';
import ChannexPreflightBanner from './ChannexPreflightBanner';
import ChannexHealthSummaryPanel from './ChannexHealthSummaryPanel';
import ChannexDiagnoseDialog from './ChannexDiagnoseDialog';
import { OTA_LOGO_BY_CODE } from './OtaSyncBadges';

interface ChannexMappingDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ConnectFormState {
  open: boolean;
  property: Property | null;
  mode: ChannexConnectMode;
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
  submitting: boolean;
  error: string | null;
}

const initialConnectForm: ConnectFormState = {
  open: false,
  property: null,
  mode: 'AUTO_CREATE',
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
  const [pickerDialog, setPickerDialog] = useState<{ open: boolean; property: Property | null }>({
    open: false,
    property: null,
  });
  const [embedDialog, setEmbedDialog] = useState<{
    open: boolean;
    property: Property | null;
    channelCode: ChannexOtaCode | null;
    /** URL iframe pre-fournie (flow auto-create channel via API). null = fetch a la volee. */
    prefetchedUrl: string | null;
  }>({ open: false, property: null, channelCode: null, prefetchedUrl: null });
  /**
   * Smart Disconnect orchestre (Quick Win #2) : remplace l'ancien confirm basique
   * pour la deconnexion. Au lieu d'effacer uniquement le mapping local (= ne
   * touche pas Channex, laisse les OTA bloques cote host), l'orchestrateur
   * desactive les channels OTA cote hub (= libere immediatement Airbnb/Booking),
   * supprime les channels, nettoie la DB locale, et affiche une checklist du
   * resultat par etape pour la transparence.
   */
  const [smartDisconnect, setSmartDisconnect] = useState<{
    open: boolean;
    property: Property | null;
  }>({ open: false, property: null });
  /**
   * Diagnose dialog (Quick Win #5) declenche depuis le HealthSummaryPanel.
   * Permet a l'admin d'agir directement depuis le tableau de bord sans avoir
   * a localiser la property dans la liste.
   */
  const [diagnoseTarget, setDiagnoseTarget] = useState<{
    propertyId: number;
    propertyName: string;
  } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  /**
   * Vue principale du dialog :
   * - 'CHOICE' : ecran de choix initial (3 cards)
   * - 'CONNECT_EXISTING' : liste des proprietes Clenzy avec leur statut (sync, deconnexion, etc.)
   * - 'MANAGE_OTAS' : liste des channels OTA connectes au hub avec bouton Disconnect
   *   (le mode IMPORT_FROM_OTA bascule directement sur le sub-dialog ChannexImportDiscoveryDialog)
   */
  const [view, setView] = useState<'CHOICE' | 'CONNECT_EXISTING' | 'MANAGE_OTAS'>('CHOICE');
  // Etat de la vue MANAGE_OTAS : liste des channels chargee
  const [connectedOtas, setConnectedOtas] = useState<import('../../../services/api/channexApi').ChannexConnectedOta[]>([]);
  const [otasLoading, setOtasLoading] = useState(false);
  const [otasError, setOtasError] = useState<string | null>(null);
  const [disconnectOtaConfirm, setDisconnectOtaConfirm] = useState<
    import('../../../services/api/channexApi').ChannexConnectedOta | null
  >(null);

  // Reset la vue a 'CHOICE' a chaque ouverture du dialog (pour repartir du choix initial)
  useEffect(() => {
    if (open) {
      setView('CHOICE');
    }
  }, [open]);

  // Fetch les OTAs connectes quand on bascule sur la vue MANAGE_OTAS
  const refreshConnectedOtas = useCallback(async () => {
    setOtasLoading(true);
    setOtasError(null);
    try {
      const list = await channexApi.listConnectedOtas();
      setConnectedOtas(list);
    } catch (err) {
      setOtasError(err instanceof Error
        ? err.message
        : 'Impossible de charger la liste des OTAs connectes.');
    } finally {
      setOtasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && view === 'MANAGE_OTAS') {
      void refreshConnectedOtas();
    }
  }, [open, view, refreshConnectedOtas]);

  const handleDisconnectOta = async () => {
    const ota = disconnectOtaConfirm;
    if (!ota) return;
    setDisconnectOtaConfirm(null);
    try {
      await channexApi.disconnectOta(ota.channelId);
      // Recharger la liste apres suppression
      await refreshConnectedOtas();
    } catch (err) {
      setOtasError(err instanceof Error
        ? `Echec de la deconnexion : ${err.message}`
        : 'Echec de la deconnexion.');
    }
  };

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

    // Validation conditionnelle selon le mode
    const payload: import('../../../services/api/channexApi').ChannexConnectRequest = {
      mode: connectForm.mode,
    };

    if (connectForm.mode === 'IMPORT_EXISTING') {
      const ids = {
        channexPropertyId: connectForm.channexPropertyId.trim(),
        channexRoomTypeId: connectForm.channexRoomTypeId.trim(),
        channexDefaultRatePlanId: connectForm.channexDefaultRatePlanId.trim(),
      };
      if (!ids.channexPropertyId || !ids.channexRoomTypeId || !ids.channexDefaultRatePlanId) {
        setConnectForm((s) => ({ ...s, error: 'Les 3 IDs Channex sont obligatoires en mode import.' }));
        return;
      }
      Object.assign(payload, ids);
    }
    // En mode AUTO_CREATE, le backend derive tout depuis la property Clenzy

    setConnectForm((s) => ({ ...s, submitting: true, error: null }));
    try {
      const connectedProperty = connectForm.property;
      const mapping = await channexApi.connect(connectedProperty.id, payload);
      setMappings((prev) => {
        const next = new Map(prev);
        next.set(mapping.clenzyPropertyId, mapping);
        return next;
      });
      setConnectForm(initialConnectForm);

      // Apres connexion reussie -> on enchaine sur le picker OTA pour que
      // l'utilisateur choisisse quel OTA (Airbnb, Booking, ...) connecter en
      // premier. Le picker ouvre ensuite le widget Channex pre-filtre.
      setPickerDialog({ open: true, property: connectedProperty });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la connexion au hub de distribution.';
      setConnectForm((s) => ({ ...s, submitting: false, error: message }));
    }
  };

  /**
   * Ouvre le Smart Disconnect dialog (Quick Win #2). L'ancien confirm basique
   * qui ne nettoyait que la DB locale (sans toucher les channels Channex) est
   * remplace : il laissait Airbnb/Booking bloques cote host parce que le hub
   * continuait a pusher. Le nouveau dialog desactive les OTA d'abord, puis
   * propose un reset complet optionnel.
   */
  const handleDisconnect = (property: Property) => {
    setSmartDisconnect({ open: true, property });
  };

  /**
   * Callback du Smart Disconnect dialog apres succes : on retire le mapping
   * de l'etat local pour que l'UI bascule immediatement la property en mode
   * "non connectee" (bouton Connecter au lieu de Resync/Deconnecter).
   */
  const handleSmartDisconnectSuccess = () => {
    const property = smartDisconnect.property;
    if (!property) return;
    setMappings((prev) => {
      const next = new Map(prev);
      next.delete(property.id);
      return next;
    });
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

  const handlePullBookings = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      const result = await channexApi.pullBookings(property.id);
      const msg = result.totalReceived === 0
        ? `Aucun booking trouve pour "${property.name}". Verifiez que vos OTAs sont bien connectees dans le hub de distribution.`
        : `Import termine : ${result.totalReceived} booking(s) recus de Channex (${result.importedOrIdempotent} traites${result.errors > 0 ? `, ${result.errors} erreur(s)` : ''}).`;
      // Toast simplifie via alert (window) — on peut migrer vers notistack plus tard
      window.alert(msg);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur lors de l'import des bookings.");
    } finally {
      setBusyPropertyId(null);
    }
  };

  const handleResyncContent = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      const result = await channexApi.resyncContent(property.id);
      const renamed = result.scrapedName && result.scrapedName !== property.name;
      const msg = `Re-sync OK pour "${result.propertyName}"`
        + (renamed ? ` (renomme depuis "${property.name}")` : '')
        + ` : ${result.mappedAmenities.length} commodite(s) mappee(s), `
        + `${result.rawAmenitiesRemaining.length} brute(s) en attente`
        + (result.ignoredCount > 0 ? `, ${result.ignoredCount} ignoree(s)` : '')
        + `. Va dans Settings > Commodites OTA pour mapper les restantes.`;
      window.alert(msg);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors du re-sync content.');
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
            gap: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            py: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            {view !== 'CHOICE' && (
              <Tooltip title="Retour au choix initial">
                <IconButton
                  size="small"
                  onClick={() => setView('CHOICE')}
                  sx={{ flexShrink: 0 }}
                >
                  <ArrowLeft size={18} />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
                {view === 'CHOICE'
                  ? 'Distribution OTA — Que voulez-vous faire ?'
                  : 'Connecter mes proprietes aux OTAs'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {view === 'CHOICE'
                  ? 'Choisissez si vous voulez importer une propriete deja en ligne, ou connecter une propriete deja dans Clenzy.'
                  : 'Selectionnez une propriete pour l\'enregistrer dans le hub puis y brancher Airbnb, Booking, etc.'}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {view === 'CHOICE' ? (
            <Stack spacing={1.5}>
              {/* Quick Win #3 : Pre-flight diagnostic — verifie API, hub, capabilities
                  AVANT que l'utilisateur n'investisse 5 minutes dans un wizard OAuth. */}
              <ChannexPreflightBanner defaultCollapsed />

              {/* Phase 2 : Health summary — counts par status + items meritant attention,
                  click sur un item ouvre le diagnose pour cette property. */}
              <ChannexHealthSummaryPanel
                onAttentionItemClick={(item) => setDiagnoseTarget({
                  propertyId: item.clenzyPropertyId,
                  propertyName: item.propertyName,
                })}
              />

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', lineHeight: 1.5, mb: 0.5 }}
              >
                Deux scenarios possibles selon votre situation :
              </Typography>

              {/* Card 1 : Importer une propriete deja en ligne dans un OTA */}
              <ButtonBase
                onClick={() => setImportDialogOpen(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  width: '100%',
                  p: 2,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': {
                    borderColor: ACCENT,
                    bgcolor: `${ACCENT}06`,
                    transform: 'translateX(2px)',
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${ACCENT}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    bgcolor: `${ACCENT}1A`,
                    color: ACCENT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Globe size={22} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>
                    Importer une propriete deja en ligne
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.5 }}
                  >
                    Vous avez deja des listings sur Airbnb / Booking / Vrbo qui ne sont pas
                    encore dans Clenzy. Detectez et importez-les en masse avec leurs metadonnees
                    (nom, devise, capacite) deja pre-remplies.
                  </Typography>
                </Box>
                <Box sx={{ color: 'text.disabled', flexShrink: 0, alignSelf: 'center' }}>
                  <ChevronRight size={18} />
                </Box>
              </ButtonBase>

              {/* Card 2 : Connecter une propriete deja dans le PMS */}
              <ButtonBase
                onClick={() => setView('CONNECT_EXISTING')}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  width: '100%',
                  p: 2,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': {
                    borderColor: ACCENT,
                    bgcolor: `${ACCENT}06`,
                    transform: 'translateX(2px)',
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${ACCENT}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    bgcolor: `${ACCENT}1A`,
                    color: ACCENT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Home size={22} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>
                    Connecter une propriete deja dans Clenzy
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.5 }}
                  >
                    Vous avez une propriete dans Clenzy que vous voulez distribuer sur Airbnb,
                    Booking, Vrbo, etc. Connectez-la au hub puis branchez les OTAs en quelques
                    clics.
                  </Typography>
                </Box>
                <Box sx={{ color: 'text.disabled', flexShrink: 0, alignSelf: 'center' }}>
                  <ChevronRight size={18} />
                </Box>
              </ButtonBase>

              {/* Card 3 : Gerer les OTAs connectes (voir/deconnecter Airbnb, Booking, etc.) */}
              <ButtonBase
                onClick={() => setView('MANAGE_OTAS')}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  width: '100%',
                  p: 2,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': {
                    borderColor: ACCENT,
                    bgcolor: `${ACCENT}06`,
                    transform: 'translateX(2px)',
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${ACCENT}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    bgcolor: `${ACCENT}1A`,
                    color: ACCENT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Link2 size={22} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>
                    Gerer les OTAs connectes
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.5 }}
                  >
                    Voir tous les OTAs (Airbnb, Booking, Vrbo, ...) actuellement connectes au hub,
                    et les deconnecter si besoin (supprime le channel + les tokens OAuth).
                  </Typography>
                </Box>
                <Box sx={{ color: 'text.disabled', flexShrink: 0, alignSelf: 'center' }}>
                  <ChevronRight size={18} />
                </Box>
              </ButtonBase>
            </Stack>
          ) : view === 'MANAGE_OTAS' ? (
            <Stack spacing={1.5}>
              {otasError && (
                <Alert severity="error" variant="outlined" sx={{ fontSize: '0.78rem' }}>
                  {otasError}
                </Alert>
              )}

              {otasLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : connectedOtas.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', px: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: `${ACCENT}10`,
                      color: ACCENT,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5,
                    }}
                  >
                    <Link2 size={24} />
                  </Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    Aucun OTA connecte
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Pour connecter Airbnb / Booking / Vrbo, retournez au choix initial et selectionnez
                    "Importer une propriete deja en ligne".
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setView('CHOICE')}
                    variant="outlined"
                    sx={{ textTransform: 'none' }}
                  >
                    Retour au choix
                  </Button>
                </Box>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {connectedOtas.length} OTA{connectedOtas.length > 1 ? 's' : ''} actuellement connecte{connectedOtas.length > 1 ? 's' : ''} au hub :
                  </Typography>
                  {connectedOtas.map((ota) => {
                    const otaOption = ota.otaName
                      ? CHANNEX_OTA_OPTIONS.find(
                          (o) => o.apiChannelName.toLowerCase() === ota.otaName.toLowerCase()
                            || o.name.toLowerCase() === ota.otaName.toLowerCase()
                        )
                      : null;
                    const brand = otaOption?.brandColor ?? ACCENT;
                    const brandFg = otaOption?.brandColorFg ?? '#FFFFFF';
                    const initials = otaOption?.initials ?? ota.otaName.slice(0, 2);
                    return (
                      <Box
                        key={ota.channelId}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            bgcolor: brand,
                            color: brandFg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                          }}
                        >
                          {initials}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25, flexWrap: 'wrap' }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {otaOption?.name ?? ota.otaName} — {ota.title || 'Sans titre'}
                            </Typography>
                            {ota.isActive ? (
                              <Chip
                                size="small"
                                label="Actif"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: '#10B98115',
                                  color: '#059669',
                                }}
                              />
                            ) : ota.hasOauthToken ? (
                              <Chip
                                size="small"
                                label="OAuth fait, mapping a finaliser"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: '#F59E0B15',
                                  color: '#B45309',
                                }}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="Non authentifie"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: '#EF444415',
                                  color: '#B91C1C',
                                }}
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                            Lie a : {ota.attachedPropertyTitle || '(aucune)'}
                          </Typography>
                        </Box>
                        <Tooltip title="Deconnecter cet OTA (supprime tokens OAuth)">
                          <IconButton
                            size="small"
                            onClick={() => setDisconnectOtaConfirm(ota)}
                            sx={{ color: '#EF4444' }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </>
              )}
            </Stack>
          ) : (
            <>
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

                    <Stack direction="row" spacing={1} alignItems="center">
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
                          {/* Logos OTAs : tous les OTAs supportes (Airbnb / Booking
                              / Vrbo / Expedia / Agoda). En couleur + check vert si
                              cette property est sync sur l'OTA, grise si pas
                              connecte (cliquable pour lancer la connexion). */}
                          {(() => {
                            const propertyOtas = connectedOtas.filter(
                              (o) => o.attachedPropertyId === mapping.channexPropertyId,
                            );
                            return (
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 0.5 }}>
                                {CHANNEX_OTA_OPTIONS.map((opt) => {
                                  const conn = propertyOtas.find(
                                    (o) => o.otaName.toLowerCase() === opt.apiChannelName.toLowerCase()
                                      || o.otaName.toLowerCase() === opt.name.toLowerCase(),
                                  );
                                  const isActive = conn?.isActive ?? false;
                                  const hasToken = conn?.hasOauthToken ?? false;
                                  const tooltipLabel = isActive
                                    ? `${opt.name} · Sync active`
                                    : hasToken
                                      ? `${opt.name} · OAuth fait, mapping a finaliser`
                                      : `${opt.name} · Cliquer pour connecter`;
                                  const logo = OTA_LOGO_BY_CODE[opt.code];
                                  return (
                                    <Tooltip key={opt.code} title={tooltipLabel} arrow>
                                      <Box
                                        component={isActive ? 'div' : 'button'}
                                        onClick={isActive ? undefined : () => setPickerDialog({ open: true, property })}
                                        disabled={isActive ? undefined : isBusy}
                                        sx={{
                                          position: 'relative',
                                          display: 'inline-flex',
                                          width: 22,
                                          height: 22,
                                          p: 0,
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: isActive ? 'default' : 'pointer',
                                          opacity: isActive ? 1 : 0.35,
                                          filter: isActive ? 'none' : 'grayscale(100%)',
                                          transition: 'opacity 150ms ease, filter 150ms ease',
                                          '&:hover': isActive ? {} : { opacity: 0.7, filter: 'grayscale(50%)' },
                                        }}
                                      >
                                        {logo && (
                                          <Box
                                            component="img"
                                            src={logo}
                                            alt={opt.name}
                                            sx={{
                                              width: '100%',
                                              height: '100%',
                                              borderRadius: 0.5,
                                              objectFit: 'contain',
                                              bgcolor: '#FFFFFF',
                                              border: '1px solid rgba(0,0,0,0.08)',
                                              p: '2px',
                                            }}
                                          />
                                        )}
                                        {isActive && (
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              top: -3,
                                              right: -3,
                                              width: 11,
                                              height: 11,
                                              borderRadius: '50%',
                                              bgcolor: '#10B981',
                                              color: '#FFFFFF',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              border: '2px solid #FFFFFF',
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                            }}
                                          >
                                            <CheckCircle2 size={7} strokeWidth={4} />
                                          </Box>
                                        )}
                                        {!isActive && hasToken && (
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              top: -3,
                                              right: -3,
                                              width: 9,
                                              height: 9,
                                              borderRadius: '50%',
                                              bgcolor: '#F59E0B',
                                              border: '2px solid #FFFFFF',
                                            }}
                                          />
                                        )}
                                      </Box>
                                    </Tooltip>
                                  );
                                })}
                              </Stack>
                            );
                          })()}
                          <Tooltip title="Re-sync contenu OTA (nom, commodités) — re-scrape Airbnb + applique vos aliases">
                            <span>
                              <IconButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => handleResyncContent(property)}
                                sx={{ color: '#8B5CF6' }}
                              >
                                <Sparkles size={14} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Re-pousser prix + dispo Clenzy vers les OTAs (6 mois)">
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
                          <Tooltip title="Importer les bookings OTA existants (Airbnb / Booking / ...)">
                            <span>
                              <IconButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => handlePullBookings(property)}
                                sx={{ color: '#3B82F6' }}
                              >
                                <Download size={14} />
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
            </>
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
            Connecter "{connectForm.property?.name}" au hub de distribution
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            {connectForm.mode === 'AUTO_CREATE'
              ? "Clenzy va creer Property + Room Type + Rate Plan automatiquement dans le hub"
              : "Renseignez les 3 identifiants du hub (visibles dans votre dashboard)"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {connectForm.error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem' }}>
              {connectForm.error}
            </Alert>
          )}

          {/* Mode toggle */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => setConnectForm((s) => ({ ...s, mode: 'AUTO_CREATE', error: null }))}
              sx={{
                p: 1.25,
                border: '1.5px solid',
                borderColor: connectForm.mode === 'AUTO_CREATE' ? ACCENT : 'divider',
                borderRadius: 1.5,
                cursor: 'pointer',
                backgroundColor: connectForm.mode === 'AUTO_CREATE' ? `${ACCENT}10` : 'background.paper',
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': { borderColor: ACCENT },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: connectForm.mode === 'AUTO_CREATE' ? ACCENT : 'divider',
                    backgroundColor: connectForm.mode === 'AUTO_CREATE' ? ACCENT : 'transparent',
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Creation automatique <span style={{ color: ACCENT, fontSize: '0.7rem', fontWeight: 700 }}>RECOMMANDE</span>
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 3, mt: 0.5 }}>
                Clenzy cree la Property, le Room Type et le Rate Plan automatiquement dans le hub de distribution en utilisant les infos de votre propriete.
              </Typography>
            </Box>

            <Box
              role="button"
              tabIndex={0}
              onClick={() => setConnectForm((s) => ({ ...s, mode: 'IMPORT_EXISTING', error: null }))}
              sx={{
                p: 1.25,
                border: '1.5px solid',
                borderColor: connectForm.mode === 'IMPORT_EXISTING' ? ACCENT : 'divider',
                borderRadius: 1.5,
                cursor: 'pointer',
                backgroundColor: connectForm.mode === 'IMPORT_EXISTING' ? `${ACCENT}10` : 'background.paper',
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': { borderColor: ACCENT },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: connectForm.mode === 'IMPORT_EXISTING' ? ACCENT : 'divider',
                    backgroundColor: connectForm.mode === 'IMPORT_EXISTING' ? ACCENT : 'transparent',
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Importer des IDs existants
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 3, mt: 0.5 }}>
                Vous avez deja cree la propriete dans le hub de distribution et possedez les 3 UUIDs.
              </Typography>
            </Box>
          </Stack>

          {/* Champs IDs : visibles uniquement en mode IMPORT */}
          {connectForm.mode === 'IMPORT_EXISTING' && (
            <Stack spacing={1.5}>
              <TextField
                label="Property ID (hub)"
                fullWidth
                size="small"
                value={connectForm.channexPropertyId}
                onChange={(e) =>
                  setConnectForm((s) => ({ ...s, channexPropertyId: e.target.value }))
                }
                disabled={connectForm.submitting}
                placeholder="ex: 8f8a2c1a-4b5e-..."
                helperText="UUID de la Property dans le hub de distribution"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Room Type ID (hub)"
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
                label="Default Rate Plan ID (hub)"
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
          )}

          {/* Recap mode AUTO_CREATE */}
          {connectForm.mode === 'AUTO_CREATE' && connectForm.property && (
            <Alert severity="info" sx={{ fontSize: '0.72rem' }}>
              <strong>Sera cree dans le hub de distribution :</strong>
              <Box component="ul" sx={{ margin: 0, paddingInlineStart: 2, mt: 0.5 }}>
                <li>Property : <em>{connectForm.property.name}</em> ({connectForm.property.city}, {connectForm.property.country})</li>
                <li>Room Type : 1 unite, capacite {connectForm.property.maxGuests} personnes</li>
                <li>Rate Plan : Standard Rate, per_room</li>
              </Box>
            </Alert>
          )}

          <Alert severity="info" sx={{ mt: 2, fontSize: '0.72rem' }}>
            Apres connexion, un push initial de 6 mois (prix + disponibilites) sera declenche automatiquement.
            {connectForm.mode === 'AUTO_CREATE' && (
              <> Pour connecter ensuite Airbnb / Booking / Vrbo, utilisez le bouton de connexion (lien) sur la propriete une fois creee.</>
            )}
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

      {/* Picker OTA Clenzy-native : choix de l'OTA avant d'ouvrir la iframe Channex.
          Le wizard Channex s'ouvre filtre sur l'OTA choisi (param available_channels)
          ce qui evite a l'utilisateur de chercher dans 500+ options.

          NOTE : on avait tente une pre-creation via POST /channels + mapping
          automatique, mais le mapping property↔channel n'est pas expose en
          API publique Channex (tous formats testes -> 422/500). Le wizard
          iframe reste l'unique chemin pour finaliser le mapping. Le call
          createOtaChannel reste cote backend pour usage futur (whitelabel
          ou si Channex expose l'endpoint). */}
      <ChannexOtaPickerDialog
        open={pickerDialog.open}
        onClose={() => setPickerDialog({ open: false, property: null })}
        propertyName={pickerDialog.property?.name ?? ''}
        onPick={(code) => {
          // Bascule du picker au widget iframe Channex pre-filtre sur l'OTA choisi
          const property = pickerDialog.property;
          setPickerDialog({ open: false, property: null });
          if (property) {
            setEmbedDialog({
              open: true,
              property,
              channelCode: code,
              prefetchedUrl: null, // pas de pre-create -> ChannexEmbedDialog fetche lui-meme
            });
          }
        }}
      />

      {/* Widget Channex embarque pour la finalisation (login OTA + mapping) */}
      <ChannexEmbedDialog
        open={embedDialog.open}
        onClose={() => setEmbedDialog({ open: false, property: null, channelCode: null, prefetchedUrl: null })}
        clenzyPropertyId={embedDialog.property?.id ?? null}
        propertyName={embedDialog.property?.name ?? ''}
        channelCode={embedDialog.channelCode}
        prefetchedEmbedUrl={embedDialog.prefetchedUrl}
        onClosedAfterConnection={() => {
          // L'utilisateur a connecte un OTA dans la iframe :
          // 1. Push Clenzy -> Channex (resync) car maintenant qu'au moins 1 OTA
          //    est actif, les prix/dispos doivent etre distribues. C'est le
          //    PREMIER push (la connect() initiale ne push pas pour eviter de
          //    polluer Channex tant qu'aucun OTA n'est branche).
          // 2. Pull Channex -> Clenzy (pullBookings) pour rapatrier les
          //    reservations existantes sur l'OTA fraichement connecte (Airbnb
          //    a typiquement deja des bookings actifs).
          if (embedDialog.property) {
            void handleResync(embedDialog.property);
            void handlePullBookings(embedDialog.property);
          }
        }}
      />

      {/* Import en masse depuis le hub (discovery des listings OTAs) */}
      <ChannexImportDiscoveryDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={() => {
          // Refresh la liste des properties + mappings pour faire apparaitre
          // les nouvelles properties Clenzy fraichement importees, et bascule
          // sur la vue CONNECT_EXISTING pour les voir tout de suite.
          void refresh();
          setView('CONNECT_EXISTING');
        }}
        onRequestConnectExisting={() => {
          // CTA depuis l'etat "hub vide" : ferme le sub-dialog et bascule la
          // vue principale sur la liste des proprietes Clenzy (pour que le
          // user puisse en connecter une et faire l'OAuth Airbnb).
          setImportDialogOpen(false);
          setView('CONNECT_EXISTING');
        }}
      />

      {/* Smart Disconnect orchestre (Quick Win #2) — remplace l'ancien confirm
          basique qui n'effacait que le mapping local sans toucher les channels
          Channex (= laissait Airbnb/Booking bloques cote host). */}
      {smartDisconnect.property && (
        <ChannexFullDisconnectDialog
          open={smartDisconnect.open}
          onClose={() => setSmartDisconnect({ open: false, property: null })}
          propertyId={smartDisconnect.property.id}
          propertyName={smartDisconnect.property.name}
          onSuccess={handleSmartDisconnectSuccess}
        />
      )}

      {/* Diagnose dialog (Quick Win #5) declenche depuis le HealthSummaryPanel.
          Reuse les memes handlers que le full disconnect (le user peut faire
          full disconnect direct depuis le diagnose). */}
      {diagnoseTarget && (
        <ChannexDiagnoseDialog
          open={diagnoseTarget !== null}
          onClose={() => setDiagnoseTarget(null)}
          propertyId={diagnoseTarget.propertyId}
          onFullDisconnect={() => {
            // Ouvre le smart disconnect pour la meme property (chaine d'actions
            // depuis le tableau de bord).
            const target = diagnoseTarget;
            setDiagnoseTarget(null);
            if (target) {
              // On a besoin d'une Property pour le smart disconnect. On en
              // construit un stub minimal (l'id + le nom suffisent pour l'UI).
              setSmartDisconnect({
                open: true,
                property: { id: target.propertyId, name: target.propertyName } as Property,
              });
            }
          }}
          onOpenHub={() => {
            // Deja dans la mapping dialog → on bascule sur la vue CONNECT_EXISTING
            // pour que l'admin voie la property en question dans la liste.
            setDiagnoseTarget(null);
            setView('CONNECT_EXISTING');
          }}
          onResyncSuccess={() => { void refresh(); }}
        />
      )}

      {/* Confirmation de deconnexion OTA (suppression channel + tokens OAuth) */}
      <Dialog
        open={disconnectOtaConfirm !== null}
        onClose={() => setDisconnectOtaConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pb: 1 }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            <AlertCircle size={18} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
              Deconnecter cet OTA&nbsp;?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            <strong>{disconnectOtaConfirm?.otaName}</strong> sera deconnecte du hub.
            Les tokens OAuth seront supprimes et vous devrez refaire toute l'authentification
            pour reconnecter cet OTA. Les bookings deja synchronises restent dans Clenzy.
          </Typography>
        </DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, pb: 2 }}>
          <Button
            onClick={() => setDisconnectOtaConfirm(null)}
            size="small"
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleDisconnectOta}
            size="small"
            variant="contained"
            sx={{
              backgroundColor: '#EF4444',
              '&:hover': { backgroundColor: '#DC2626' },
              textTransform: 'none',
            }}
          >
            Deconnecter
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
