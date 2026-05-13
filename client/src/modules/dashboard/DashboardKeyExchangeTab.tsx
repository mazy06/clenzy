import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Button,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  VpnKey,
  Store as StoreIcon,
  CheckCircleOutline,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy,
  QrCode2,
  History as HistoryIcon,
  ArrowBack,
  PersonOutline,
  CalendarToday,
  Cancel as CancelIcon,
  Search as SearchIcon,
  LocationOn,
  AccessTime,
  LinkOff,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useKeyExchange, type KeyExchangeView } from '../../hooks/useKeyExchange';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi, keyExchangeApi } from '../../services/api';
import { extractApiList } from '../../types';
import type { Property } from '../../services/api/propertiesApi';
import type { KeyExchangePointDto, KeyExchangeCodeDto, KeyNestStoreDto } from '../../services/api/keyExchangeApi';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import type { GeocodedAddress } from '../../services/geocoderApi';
import {
  OpeningHoursEditor,
  EMPTY_HOURS,
  serializeOpeningHours,
  formatOpeningHoursDisplay,
  type OpeningHoursMap,
} from '../../components/OpeningHoursEditor';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker } from '../../components/MapboxPropertyMap';

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircleOutline size={16} strokeWidth={1.75} /></Box>
      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
        {text}
      </Typography>
    </Box>
  );
}

// ─── Status chip helper ─────────────────────────────────────────────────────

const CODE_STATUS_HEX: Record<string, string> = {
  ACTIVE: '#4A9B8E',
  USED: '#0288d1',
  EXPIRED: '#757575',
  CANCELLED: '#d32f2f',
};

const EVENT_TYPE_HEX: Record<string, string> = {
  KEY_DEPOSITED: '#4A9B8E',
  KEY_COLLECTED: '#0288d1',
  KEY_RETURNED: '#7B61FF',
  CODE_GENERATED: '#4A9B8E',
  CODE_CANCELLED: '#d32f2f',
  CODE_EXPIRED: '#757575',
};

// ═══════════════════════════════════════════════════════════════════════════
// Offers View
// ═══════════════════════════════════════════════════════════════════════════

interface OffersViewProps {
  onChooseKeyVault: () => void;
  onChooseKeyNest: () => void;
}

function KeyExchangeOffersView({ onChooseKeyVault, onChooseKeyNest }: OffersViewProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><VpnKey size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('dashboard.keyExchange.title') || 'Gestion des clés'}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.82rem' }}>
        {t('dashboard.keyExchange.subtitle') || 'Configurez un point de gardiennage de clés pour vos logements sans serrure connectée.'}
      </Typography>

      <Grid container spacing={2}>
        {/* ─── Card: Clenzy KeyVault ──────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: '0 2px 12px rgba(107, 138, 154, 0.1)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StoreIcon size={22} strokeWidth={1.75} color='#6B8A9A' />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Clenzy KeyVault
              </Typography>
              <Chip
                label="Gratuit"
                size="small"
                sx={{
                  fontSize: '0.6875rem', height: 22, fontWeight: 600,
                  backgroundColor: '#4A9B8E18', color: '#4A9B8E',
                  border: '1px solid #4A9B8E40', borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              Gérez votre propre réseau de gardiens de clés — commerçants ou particuliers à proximité. Solution intégrée au PMS, sans coût supplémentaire.
            </Typography>

            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text="Enregistrez vos partenaires de confiance" />
              <FeatureItem text="Commerçants et particuliers dans le quartier" />
              <FeatureItem text="Codes à 6 chiffres avec durée de validité" />
              <FeatureItem text="Page de vérification pour le gardien (sans appli)" />
              <FeatureItem text="Suivi en temps réel des mouvements de clés" />
            </Box>

            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4A9B8E' }}>
                Inclus dans votre abonnement
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Partenaires & codes illimités
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              startIcon={<StoreIcon size={16} strokeWidth={1.75} />}
              onClick={onChooseKeyVault}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Configurer un gardien
            </Button>
          </Paper>
        </Grid>

        {/* ─── Card: KeyNest ─────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              height: '100%',
              border: '1.5px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: '#D4A574',
                boxShadow: '0 2px 12px rgba(212, 165, 116, 0.1)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VpnKey size={22} strokeWidth={1.75} color='#D4A574' />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                KeyNest
              </Typography>
              <Chip
                label="Externe"
                size="small"
                sx={{
                  fontSize: '0.6875rem', height: 22, fontWeight: 600,
                  backgroundColor: '#D4A57418', color: '#D4A574',
                  border: '1px solid #D4A57440', borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              Réseau de 5 500+ points de dépôt dans les commerces de proximité. Service professionnel avec API intégrée.
            </Typography>

            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text="5 500+ points de dépôt en Europe" />
              <FeatureItem text="Intégration automatique des codes" />
              <FeatureItem text="Notifications en temps réel (webhooks)" />
              <FeatureItem text="Compatible toutes plateformes de location" />
            </Box>

            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>À la collecte</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4A574' }}>~7,14 €</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Mensuel</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4A574' }}>29,94 €/clé/mois</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Annuel</Typography>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#D4A574' }}>23,94 €/clé/mois</Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<VpnKey size={16} strokeWidth={1.75} />}
              onClick={onChooseKeyNest}
              sx={{
                textTransform: 'none', fontWeight: 600,
                borderColor: '#D4A574', color: '#D4A574',
                '&:hover': { borderColor: '#C4956A', backgroundColor: '#D4A57408' },
              }}
            >
              Configurer KeyNest
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KeyVault View (CRUD commerçants + codes)
// ═══════════════════════════════════════════════════════════════════════════

interface KeyVaultViewProps {
  points: KeyExchangePointDto[];
  activeCodes: KeyExchangeCodeDto[];
  loadingCodes: boolean;
  submitting: boolean;
  error: string | null;
  properties: Property[];
  onCreatePoint: (data: any) => Promise<any>;
  onDeletePoint: (id: number) => void;
  onFetchCodes: (pointId: number) => void;
  onGenerateCode: (data: any) => Promise<any>;
  onCancelCode: (id: number) => void;
  onBack: () => void;
  onHistory: () => void;
}

function KeyVaultView({
  points, activeCodes, loadingCodes, submitting, error, properties,
  onCreatePoint, onDeletePoint, onFetchCodes, onGenerateCode, onCancelCode, onBack, onHistory,
}: KeyVaultViewProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);

  // Add guardian form
  const [formPropertyId, setFormPropertyId] = useState<number | ''>('');
  const [formGuardianType, setFormGuardianType] = useState<'MERCHANT' | 'INDIVIDUAL'>('MERCHANT');
  const [formStoreName, setFormStoreName] = useState('');
  const [formStoreAddress, setFormStoreAddress] = useState('');
  const [formStoreLat, setFormStoreLat] = useState<number | null>(null);
  const [formStoreLng, setFormStoreLng] = useState<number | null>(null);
  const [formStorePhone, setFormStorePhone] = useState('');
  const [formOpeningHoursMap, setFormOpeningHoursMap] = useState<OpeningHoursMap>({ ...EMPTY_HOURS });

  // Code form
  const [codeGuestName, setCodeGuestName] = useState('');

  const handleAddressSelect = (address: GeocodedAddress) => {
    setFormStoreAddress(address.label);
    setFormStoreLat(address.latitude);
    setFormStoreLng(address.longitude);
  };

  const handleAddGuardian = async () => {
    if (!formPropertyId || !formStoreName.trim()) return;
    // Serialize structured hours — only include if at least one day is active
    const hasAnyHours = Object.values(formOpeningHoursMap).some(v => v !== null);
    try {
      await onCreatePoint({
        propertyId: formPropertyId as number,
        provider: 'CLENZY_KEYVAULT',
        guardianType: formGuardianType,
        storeName: formStoreName,
        storeAddress: formStoreAddress,
        storePhone: formStorePhone,
        storeOpeningHours: hasAnyHours ? serializeOpeningHours(formOpeningHoursMap) : undefined,
        ...(formStoreLat != null && formStoreLng != null ? { storeLat: formStoreLat, storeLng: formStoreLng } : {}),
      });
      setAddDialogOpen(false);
      setFormGuardianType('MERCHANT');
      setFormStoreName('');
      setFormStoreAddress('');
      setFormStoreLat(null);
      setFormStoreLng(null);
      setFormStorePhone('');
      setFormOpeningHoursMap({ ...EMPTY_HOURS });
      setFormPropertyId('');
    } catch { /* error handled in hook */ }
  };

  const handleGenerateCode = async () => {
    if (!selectedPointId) return;
    try {
      await onGenerateCode({
        pointId: selectedPointId,
        guestName: codeGuestName,
        codeType: 'COLLECTION',
      });
      setCodeDialogOpen(false);
      setCodeGuestName('');
    } catch { /* error handled in hook */ }
  };

  const openCodeDialog = (pointId: number) => {
    setSelectedPointId(pointId);
    onFetchCodes(pointId);
    setCodeDialogOpen(true);
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><StoreIcon size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          Clenzy KeyVault — Gardiens de clés
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          <Button
            size="small"
            startIcon={<HistoryIcon size={14} strokeWidth={1.75} />}
            onClick={onHistory}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            Historique
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon size={14} strokeWidth={1.75} />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            Ajouter un gardien
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ fontSize: '0.75rem', mb: 2 }}>{error}</Alert>}

      {/* Points list */}
      {points.length === 0 ? (
        <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
          Aucun gardien configuré. Ajoutez votre premier partenaire (commerçant ou particulier).
        </Alert>
      ) : (
        <Grid container spacing={1.5}>
          {points.map((point) => (
            <Grid item xs={12} md={6} key={point.id}>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {point.guardianType === 'INDIVIDUAL'
                    ? <PersonOutline size={18} strokeWidth={1.75} color='#7B61FF' />
                    : <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><StoreIcon size={18} strokeWidth={1.75} /></Box>
                  }
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, flex: 1 }}>
                    {point.storeName}
                  </Typography>
                  {(() => {
                    const isIndividual = point.guardianType === 'INDIVIDUAL';
                    const label = isIndividual ? 'Particulier' : 'Commerçant';
                    const color = isIndividual ? '#7B61FF' : '#4A9B8E';
                    return (
                      <Chip
                        label={label}
                        size="small"
                        sx={{
                          fontSize: '0.5625rem', height: 18, fontWeight: 600,
                          backgroundColor: `${color}18`, color,
                          border: `1px solid ${color}40`, borderRadius: '6px',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    );
                  })()}
                  <Tooltip title="Supprimer">
                    <IconButton size="small" onClick={() => onDeletePoint(point.id)}>
                      <DeleteIcon size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {point.storeAddress && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                    {point.storeAddress}
                  </Typography>
                )}
                {point.storePhone && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                    Tél : {point.storePhone}
                  </Typography>
                )}
                {point.storeOpeningHours && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                    {point.guardianType === 'INDIVIDUAL' ? 'Disponibilités' : 'Horaires'} : {formatOpeningHoursDisplay(point.storeOpeningHours)}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    {point.propertyName}
                  </Typography>
                  {(() => { const c = '#4A9B8E'; return (
                    <Chip
                      label={`${point.activeCodesCount} codes actifs`}
                      size="small"
                      sx={{
                        fontSize: '0.5625rem', height: 18, fontWeight: 600,
                        backgroundColor: `${c}18`, color: c,
                        border: `1px solid ${c}40`, borderRadius: '6px',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  ); })()}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VpnKey size={14} strokeWidth={1.75} />}
                    onClick={() => openCodeDialog(point.id)}
                    sx={{ textTransform: 'none', fontSize: '0.6875rem' }}
                  >
                    Codes
                  </Button>
                  {point.verificationToken && (
                    <Tooltip title="Copier le lien de vérification">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const url = `${window.location.origin}/verify-key/${point.verificationToken}`;
                          navigator.clipboard.writeText(url);
                        }}
                      >
                        <ContentCopy size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {point.verificationToken && (
                    <Tooltip title="QR Code">
                      <IconButton size="small">
                        <QrCode2 size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add guardian dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>Ajouter un gardien de clés</DialogTitle>
        <DialogContent>
          {/* Guardian type selector */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <Paper
              elevation={0}
              onClick={() => setFormGuardianType('MERCHANT')}
              sx={{
                flex: 1, p: 1.5, cursor: 'pointer', textAlign: 'center',
                border: '2px solid',
                borderColor: formGuardianType === 'MERCHANT' ? '#4A9B8E' : 'divider',
                borderRadius: 1.5,
                backgroundColor: formGuardianType === 'MERCHANT' ? '#4A9B8E08' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: formGuardianType === 'MERCHANT' ? '#4A9B8E' : 'text.secondary', mb: 0.5 }}><StoreIcon size={24} strokeWidth={1.75} /></Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: formGuardianType === 'MERCHANT' ? 700 : 500 }}>
                Commerçant
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                Tabac, boulangerie...
              </Typography>
            </Paper>
            <Paper
              elevation={0}
              onClick={() => setFormGuardianType('INDIVIDUAL')}
              sx={{
                flex: 1, p: 1.5, cursor: 'pointer', textAlign: 'center',
                border: '2px solid',
                borderColor: formGuardianType === 'INDIVIDUAL' ? '#7B61FF' : 'divider',
                borderRadius: 1.5,
                backgroundColor: formGuardianType === 'INDIVIDUAL' ? '#7B61FF08' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: formGuardianType === 'INDIVIDUAL' ? '#7B61FF' : 'text.secondary', mb: 0.5 }}><PersonOutline size={24} strokeWidth={1.75} /></Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: formGuardianType === 'INDIVIDUAL' ? 700 : 500 }}>
                Particulier
              </Typography>
              <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                Voisin, gardien...
              </Typography>
            </Paper>
          </Box>

          <TextField
            select
            fullWidth
            size="small"
            label="Logement"
            value={formPropertyId}
            onChange={(e) => setFormPropertyId(Number(e.target.value) || '')}
            SelectProps={{ native: true }}
            sx={{ mb: 2 }}
          >
            <option value="" />
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </TextField>
          <TextField
            fullWidth size="small"
            label={formGuardianType === 'INDIVIDUAL' ? 'Nom du gardien' : 'Nom du commerçant'}
            value={formStoreName}
            onChange={(e) => setFormStoreName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 2 }}>
            <AddressAutocomplete
              value={formStoreAddress}
              onSelect={handleAddressSelect}
              onChange={(val) => { setFormStoreAddress(val); setFormStoreLat(null); setFormStoreLng(null); }}
              label="Adresse"
              placeholder="Rechercher une adresse..."
              size="small"
            />
          </Box>
          <TextField fullWidth size="small" label="Téléphone" value={formStorePhone} onChange={(e) => setFormStorePhone(e.target.value)} sx={{ mb: 2 }} />
          <OpeningHoursEditor
            value={formOpeningHoursMap}
            onChange={setFormOpeningHoursMap}
            label={formGuardianType === 'INDIVIDUAL' ? 'Disponibilités' : "Horaires d'ouverture"}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} size="small">Annuler</Button>
          <Button
            variant="contained"
            size="small"
            disabled={!formPropertyId || !formStoreName.trim() || submitting}
            startIcon={submitting ? <CircularProgress size={14} /> : undefined}
            onClick={handleAddGuardian}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Codes dialog */}
      <Dialog open={codeDialogOpen} onClose={() => setCodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>
          Codes d'échange
          {selectedPointId && (
            <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
              (Point #{selectedPointId})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {/* Generate new code */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              label="Nom du voyageur"
              value={codeGuestName}
              onChange={(e) => setCodeGuestName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddIcon size={14} strokeWidth={1.75} />}
              onClick={handleGenerateCode}
              disabled={submitting}
              sx={{ textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              Générer code
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Active codes */}
          {loadingCodes ? (
            <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box>
          ) : activeCodes.length === 0 ? (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Aucun code actif
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Code</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Voyageur</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Statut</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Créé le</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeCodes.map((code) => {
                    const c = CODE_STATUS_HEX[code.status] || '#757575';
                    return (
                      <TableRow key={code.id}>
                        <TableCell sx={{ fontSize: '0.875rem', fontWeight: 700, p: 0.5, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                          {code.code}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.6875rem', p: 0.5 }}>{code.guestName || '—'}</TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Chip
                            label={code.status}
                            size="small"
                            sx={{
                              fontSize: '0.5rem', height: 18, fontWeight: 600,
                              backgroundColor: `${c}18`, color: c,
                              border: `1px solid ${c}40`, borderRadius: '6px',
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.6875rem', p: 0.5 }}>
                          {code.createdAt ? new Date(code.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          {code.status === 'ACTIVE' && (
                            <Tooltip title="Annuler">
                              <IconButton size="small" onClick={() => onCancelCode(code.id)}>
                                <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><CancelIcon size={14} strokeWidth={1.75} /></Box>
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeDialogOpen(false)} size="small">Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// KeyNest View (store search, point association, code management)
// ═══════════════════════════════════════════════════════════════════════════

interface KeyNestViewProps {
  points: KeyExchangePointDto[];
  activeCodes: KeyExchangeCodeDto[];
  loadingCodes: boolean;
  submitting: boolean;
  error: string | null;
  properties: Property[];
  onCreatePoint: (data: any) => Promise<any>;
  onDeletePoint: (id: number) => void;
  onFetchCodes: (pointId: number) => void;
  onGenerateCode: (data: any) => Promise<any>;
  onCancelCode: (id: number) => void;
  onBack: () => void;
  onHistory: () => void;
}

function KeyNestView({
  points, activeCodes, loadingCodes, submitting, error, properties,
  onCreatePoint, onDeletePoint, onFetchCodes, onGenerateCode, onCancelCode, onBack, onHistory,
}: KeyNestViewProps) {
  // Store search state
  const [searchPropertyId, setSearchPropertyId] = useState<number | ''>('');
  const [searchResults, setSearchResults] = useState<KeyNestStoreDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  // Code dialog
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [codeGuestName, setCodeGuestName] = useState('');

  // Find the selected property to extract lat/lng
  const selectedProperty = properties.find(p => p.id === searchPropertyId);

  const handleSearch = async () => {
    if (!selectedProperty) return;

    // Use property coordinates if available, otherwise show message
    const lat = (selectedProperty as any).latitude ?? (selectedProperty as any).lat;
    const lng = (selectedProperty as any).longitude ?? (selectedProperty as any).lng;

    if (lat == null || lng == null) {
      setSearchError('Ce logement n\'a pas de coordonnées GPS. Veuillez les renseigner dans les paramètres du logement.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await keyExchangeApi.searchKeyNestStores(lat, lng, 5);
      setSearchResults(Array.isArray(results) ? results : []);
      setSearchDone(true);
    } catch (e: any) {
      setSearchError(e?.message || 'Erreur lors de la recherche des points KeyNest');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectStore = async (store: KeyNestStoreDto) => {
    if (!searchPropertyId) return;
    try {
      await onCreatePoint({
        propertyId: searchPropertyId as number,
        provider: 'KEYNEST',
        providerStoreId: store.storeId,
        storeName: store.name,
        storeAddress: store.address,
        storeLat: store.lat,
        storeLng: store.lng,
        storeOpeningHours: store.openingHours || '',
      });
      setSearchResults([]);
      setSearchDone(false);
      setSearchPropertyId('');
    } catch { /* error handled in hook */ }
  };

  const handleGenerateCode = async () => {
    if (!selectedPointId) return;
    try {
      await onGenerateCode({
        pointId: selectedPointId,
        guestName: codeGuestName,
        codeType: 'COLLECTION',
      });
      setCodeDialogOpen(false);
      setCodeGuestName('');
    } catch { /* error handled in hook */ }
  };

  const openCodeDialog = (pointId: number) => {
    setSelectedPointId(pointId);
    onFetchCodes(pointId);
    setCodeDialogOpen(true);
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <VpnKey size={20} strokeWidth={1.75} color='#D4A574' />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          KeyNest — Réseau de points de dépôt
        </Typography>
        <Button
          size="small"
          startIcon={<HistoryIcon size={14} strokeWidth={1.75} />}
          onClick={onHistory}
          sx={{ ml: 'auto', textTransform: 'none', fontSize: '0.75rem' }}
        >
          Historique
        </Button>
      </Box>

      {(error || searchError) && (
        <Alert severity="error" sx={{ fontSize: '0.75rem', mb: 2 }}>{error || searchError}</Alert>
      )}

      {/* ─── Configured KeyNest points ─────────────────────────── */}
      {points.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 1, color: 'text.primary' }}>
            Points KeyNest configurés
          </Typography>

          {/* Carte des points configurés */}
          {(() => {
            const configuredMarkers: PropertyMarker[] = points
              .filter((pt) => pt.storeLat != null && pt.storeLng != null)
              .map((pt) => ({
                lat: pt.storeLat!,
                lng: pt.storeLng!,
                name: `${pt.storeName} — ${pt.propertyName}`,
                id: pt.id,
                type: 'key_exchange' as const,
              }));
            return configuredMarkers.length > 0 ? (
              <Box sx={{ mb: 1.5, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <MapboxPropertyMap properties={configuredMarkers} height={240} />
              </Box>
            ) : null;
          })()}

          <Grid container spacing={1.5}>
            {points.map((point) => {
              const c = '#D4A574';
              return (
                <Grid item xs={12} md={6} key={point.id}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                      <VpnKey size={16} strokeWidth={1.75} color='#D4A574' />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, flex: 1 }}>
                        {point.storeName}
                      </Typography>
                      <Tooltip title="Dissocier ce point">
                        <IconButton size="small" onClick={() => onDeletePoint(point.id)}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><LinkOff size={15} strokeWidth={1.75} /></Box>
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {point.storeAddress && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><LocationOn size={13} strokeWidth={1.75} /></Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {point.storeAddress}
                        </Typography>
                      </Box>
                    )}
                    {point.storeOpeningHours && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AccessTime size={13} strokeWidth={1.75} /></Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatOpeningHoursDisplay(point.storeOpeningHours)}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                        {point.propertyName}
                      </Typography>
                      <Chip
                        label={`${point.activeCodesCount} codes actifs`}
                        size="small"
                        sx={{
                          fontSize: '0.5625rem', height: 18, fontWeight: 600,
                          backgroundColor: `${c}18`, color: c,
                          border: `1px solid ${c}40`, borderRadius: '6px',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VpnKey size={14} strokeWidth={1.75} />}
                        onClick={() => openCodeDialog(point.id)}
                        sx={{
                          textTransform: 'none', fontSize: '0.6875rem',
                          borderColor: '#D4A574', color: '#D4A574',
                          '&:hover': { borderColor: '#C4956A', backgroundColor: '#D4A57408' },
                        }}
                      >
                        Codes
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* ─── Search for KeyNest stores ─────────────────────────── */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 1.5 }}>
          Rechercher un point KeyNest proche d'un logement
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-end' }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Logement"
            value={searchPropertyId}
            onChange={(e) => {
              setSearchPropertyId(Number(e.target.value) || '');
              setSearchResults([]);
              setSearchDone(false);
              setSearchError(null);
            }}
            SelectProps={{ native: true }}
            sx={{ flex: 1 }}
          >
            <option value="" />
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </TextField>
          <Button
            variant="contained"
            size="small"
            disabled={!searchPropertyId || searching}
            startIcon={searching ? <CircularProgress size={14} color="inherit" /> : <SearchIcon size={14} strokeWidth={1.75} />}
            onClick={handleSearch}
            sx={{
              textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap',
              backgroundColor: '#D4A574', '&:hover': { backgroundColor: '#C4956A' },
            }}
          >
            Rechercher
          </Button>
        </Box>

        {/* Search results */}
        {searchDone && searchResults.length === 0 && (
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            Aucun point KeyNest trouvé à proximité de ce logement.
          </Alert>
        )}

        {searchResults.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
              {searchResults.length} point{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''} à proximité
            </Typography>

            {/* Carte Mapbox : propriété + magasins KeyNest */}
            {(() => {
              const lat = (selectedProperty as any)?.latitude ?? (selectedProperty as any)?.lat;
              const lng = (selectedProperty as any)?.longitude ?? (selectedProperty as any)?.lng;
              const markers: PropertyMarker[] = [
                ...(lat != null && lng != null
                  ? [{ lat: lat as number, lng: lng as number, name: selectedProperty?.name ?? 'Logement', type: 'property' as const }]
                  : []),
                ...searchResults.map((s) => ({
                  lat: s.lat,
                  lng: s.lng,
                  name: s.name,
                  type: 'key_exchange' as const,
                })),
              ];
              return markers.length > 0 ? (
                <Box sx={{ mb: 2, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <MapboxPropertyMap
                    properties={markers}
                    height={280}
                  />
                </Box>
              ) : null;
            })()}

            {searchResults.map((store) => (
              <Paper
                key={store.storeId}
                elevation={0}
                sx={{
                  p: 1.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: '#D4A574' },
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    {store.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><LocationOn size={12} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                      {store.address}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                    {store.distanceKm != null && (
                      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                        {store.distanceKm.toFixed(1)} km
                      </Typography>
                    )}
                    {store.openingHours && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AccessTime size={11} strokeWidth={1.75} /></Box>
                        <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                          {store.openingHours}
                        </Typography>
                      </Box>
                    )}
                    {store.type && (() => {
                      const ct = '#D4A574';
                      return (
                        <Chip
                          label={store.type}
                          size="small"
                          sx={{
                            fontSize: '0.5rem', height: 16, fontWeight: 600,
                            backgroundColor: `${ct}18`, color: ct,
                            border: `1px solid ${ct}40`, borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      );
                    })()}
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={12} /> : <AddIcon size={14} strokeWidth={1.75} />}
                  onClick={() => handleSelectStore(store)}
                  sx={{
                    textTransform: 'none', fontSize: '0.6875rem', whiteSpace: 'nowrap',
                    borderColor: '#D4A574', color: '#D4A574',
                    '&:hover': { borderColor: '#C4956A', backgroundColor: '#D4A57408' },
                  }}
                >
                  Associer
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* ─── Pricing info ──────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 1 }}>Tarification KeyNest</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Pay-as-you-go</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#D4A574' }}>~7,14 € / collecte</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Mensuel (illimité)</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#D4A574' }}>29,94 €/clé/mois</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Annuel (illimité)</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#D4A574' }}>23,94 €/clé/mois</Typography>
        </Box>
      </Paper>

      {/* ─── Codes dialog (shared) ─────────────────────────────── */}
      <Dialog open={codeDialogOpen} onClose={() => setCodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>
          Codes KeyNest
          {selectedPointId && (
            <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
              (Point #{selectedPointId})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              label="Nom du voyageur"
              value={codeGuestName}
              onChange={(e) => setCodeGuestName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddIcon size={14} strokeWidth={1.75} />}
              onClick={handleGenerateCode}
              disabled={submitting}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap',
                backgroundColor: '#D4A574', '&:hover': { backgroundColor: '#C4956A' },
              }}
            >
              Générer code
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {loadingCodes ? (
            <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box>
          ) : activeCodes.length === 0 ? (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Aucun code actif
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Code</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Voyageur</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Statut</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }}>Créé le</TableCell>
                    <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.5 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeCodes.map((code) => {
                    const c = CODE_STATUS_HEX[code.status] || '#757575';
                    return (
                      <TableRow key={code.id}>
                        <TableCell sx={{ fontSize: '0.875rem', fontWeight: 700, p: 0.5, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                          {code.code}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.6875rem', p: 0.5 }}>{code.guestName || '—'}</TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Chip
                            label={code.status}
                            size="small"
                            sx={{
                              fontSize: '0.5rem', height: 18, fontWeight: 600,
                              backgroundColor: `${c}18`, color: c,
                              border: `1px solid ${c}40`, borderRadius: '6px',
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.6875rem', p: 0.5 }}>
                          {code.createdAt ? new Date(code.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          {code.status === 'ACTIVE' && (
                            <Tooltip title="Annuler">
                              <IconButton size="small" onClick={() => onCancelCode(code.id)}>
                                <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><CancelIcon size={14} strokeWidth={1.75} /></Box>
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeDialogOpen(false)} size="small">Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// History View (unified paginated event table)
// ═══════════════════════════════════════════════════════════════════════════

const EVENT_TYPE_LABEL: Record<string, string> = {
  KEY_DEPOSITED: 'Clé déposée',
  KEY_COLLECTED: 'Clé récupérée',
  KEY_RETURNED: 'Clé retournée',
  CODE_GENERATED: 'Code généré',
  CODE_CANCELLED: 'Code annulé',
  CODE_EXPIRED: 'Code expiré',
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manuel',
  WEBHOOK: 'Webhook',
  API_POLL: 'API',
  PUBLIC_PAGE: 'Page publique',
};

interface HistoryViewProps {
  properties: Property[];
  onBack: () => void;
}

function HistoryView({ properties, onBack }: HistoryViewProps) {
  const [page, setPage] = useState(0);
  const [filterPropertyId, setFilterPropertyId] = useState<number | ''>('');

  const eventsQuery = useQuery({
    queryKey: ['key-exchange-events', filterPropertyId, page],
    queryFn: () => keyExchangeApi.getEvents({
      propertyId: filterPropertyId || undefined,
      page,
      size: 15,
    }),
    staleTime: 30_000,
  });

  const events = (eventsQuery.data as any)?.content ?? [];
  const totalPages = (eventsQuery.data as any)?.totalPages ?? 0;
  const totalElements = (eventsQuery.data as any)?.totalElements ?? 0;

  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBack size={18} strokeWidth={1.75} />
        </IconButton>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><HistoryIcon size={20} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          Historique des mouvements de clés
        </Typography>
        {totalElements > 0 && (
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
            ({totalElements} événement{totalElements > 1 ? 's' : ''})
          </Typography>
        )}
      </Box>

      {/* Filter */}
      <Box sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Filtrer par logement"
          value={filterPropertyId}
          onChange={(e) => {
            setFilterPropertyId(Number(e.target.value) || '');
            setPage(0);
          }}
          SelectProps={{ native: true }}
          sx={{ minWidth: 220, fontSize: '0.75rem' }}
        >
          <option value="">Tous les logements</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </TextField>
      </Box>

      {/* Table */}
      {eventsQuery.isLoading ? (
        <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
      ) : events.length === 0 ? (
        <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
          Aucun événement enregistré.
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(107, 138, 154, 0.04)' }}>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Type</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Point</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Logement</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Acteur</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Source</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Notes</TableCell>
                  <TableCell sx={{ fontSize: '0.625rem', fontWeight: 700, p: 0.75 }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event: any) => {
                  const eventColor = EVENT_TYPE_HEX[event.eventType] || '#757575';
                  const sourceColor = event.source === 'WEBHOOK' ? '#0288d1' : event.source === 'PUBLIC_PAGE' ? '#7B61FF' : '#757575';
                  return (
                    <TableRow key={event.id} sx={{ '&:hover': { backgroundColor: 'rgba(107, 138, 154, 0.02)' } }}>
                      <TableCell sx={{ p: 0.75 }}>
                        <Chip
                          label={EVENT_TYPE_LABEL[event.eventType] || event.eventType}
                          size="small"
                          sx={{
                            fontSize: '0.5rem', height: 20, fontWeight: 600,
                            backgroundColor: `${eventColor}18`, color: eventColor,
                            border: `1px solid ${eventColor}40`, borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.6875rem', p: 0.75 }}>
                        {event.pointName || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.6875rem', p: 0.75 }}>
                        {event.propertyName || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.6875rem', p: 0.75 }}>
                        {event.actorName || '—'}
                      </TableCell>
                      <TableCell sx={{ p: 0.75 }}>
                        <Chip
                          label={SOURCE_LABEL[event.source] || event.source}
                          size="small"
                          sx={{
                            fontSize: '0.5rem', height: 18, fontWeight: 600,
                            backgroundColor: `${sourceColor}18`, color: sourceColor,
                            border: `1px solid ${sourceColor}40`, borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.6875rem', p: 0.75, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.notes || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.6875rem', p: 0.75, whiteSpace: 'nowrap' }}>
                        {event.createdAt ? new Date(event.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <Button
                size="small"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                sx={{ textTransform: 'none', fontSize: '0.6875rem', minWidth: 32 }}
              >
                ←
              </Button>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                Page {page + 1} / {totalPages}
              </Typography>
              <Button
                size="small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                sx={{ textTransform: 'none', fontSize: '0.6875rem', minWidth: 32 }}
              >
                →
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component (view router)
// ═══════════════════════════════════════════════════════════════════════════

const DashboardKeyExchangeTab: React.FC = () => {
  const ke = useKeyExchange();

  // Properties query (for adding merchants and KeyNest search)
  const propertiesQuery = useQuery({
    queryKey: ['properties-for-key-exchange'],
    queryFn: () => propertiesApi.getAll({ size: 1000 }),
    enabled: ke.currentView === 'keyvault' || ke.currentView === 'keynest' || ke.currentView === 'history',
    staleTime: 60_000,
  });

  const properties = useMemo(
    () => extractApiList<Property>(propertiesQuery.data),
    [propertiesQuery.data],
  );

  switch (ke.currentView) {
    case 'offers':
      return (
        <KeyExchangeOffersView
          onChooseKeyVault={() => ke.setView('keyvault')}
          onChooseKeyNest={() => ke.setView('keynest')}
        />
      );

    case 'keyvault':
      return (
        <KeyVaultView
          points={ke.keyvaultPoints}
          activeCodes={ke.activeCodes}
          loadingCodes={ke.loadingCodes}
          submitting={ke.submitting}
          error={ke.error}
          properties={properties}
          onCreatePoint={ke.createPoint}
          onDeletePoint={ke.deletePoint}
          onFetchCodes={ke.fetchCodes}
          onGenerateCode={ke.generateCode}
          onCancelCode={ke.cancelCode}
          onBack={() => ke.setView('offers')}
          onHistory={() => ke.setView('history')}
        />
      );

    case 'keynest':
      return (
        <KeyNestView
          points={ke.keynestPoints}
          activeCodes={ke.activeCodes}
          loadingCodes={ke.loadingCodes}
          submitting={ke.submitting}
          error={ke.error}
          properties={properties}
          onCreatePoint={ke.createPoint}
          onDeletePoint={ke.deletePoint}
          onFetchCodes={ke.fetchCodes}
          onGenerateCode={ke.generateCode}
          onCancelCode={ke.cancelCode}
          onBack={() => ke.setView('offers')}
          onHistory={() => ke.setView('history')}
        />
      );

    case 'history':
      return <HistoryView properties={properties} onBack={() => ke.setView('offers')} />;

    default:
      return (
        <KeyExchangeOffersView
          onChooseKeyVault={() => ke.setView('keyvault')}
          onChooseKeyNest={() => ke.setView('keynest')}
        />
      );
  }
};

export default DashboardKeyExchangeTab;
