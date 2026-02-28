import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CheckCircleOutline,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Home,
  LocationOn,
  MeetingRoom,
  Label as LabelIcon,
  Delete as DeleteIcon,
  BatteryFull,
  BatteryAlert,
  Battery20,
  WifiOff,
  Wifi,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useSmartLocks, type SmartLockView, type SmartLockFormState } from '../../hooks/useSmartLocks';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api';
import { extractApiList } from '../../types';
import type { Property } from '../../services/api/propertiesApi';
import SmartLockAnimation from '../../components/SmartLockAnimation';

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
        {text}
      </Typography>
    </Box>
  );
}

// ─── Room suggestions ────────────────────────────────────────────────────────

const ROOM_SUGGESTIONS = ['Entree', 'Porte principale', 'Chambre 1', 'Chambre 2', 'Bureau', 'Garage'];

// ─── Offers view ─────────────────────────────────────────────────────────────

interface OffersViewProps {
  onConfigure: () => void;
}

function SmartLockOffersView({ onConfigure }: OffersViewProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LockIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('dashboard.smartLock.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.82rem' }}>
        {t('dashboard.smartLock.subtitle')}
      </Typography>

      <Grid container spacing={2}>
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
              <LockIcon sx={{ color: '#6B8A9A', fontSize: 22 }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('dashboard.smartLock.offersTitle')}
              </Typography>
              <Chip
                label="Tuya"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: '0.6875rem', height: 22 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2, lineHeight: 1.5 }}>
              {t('dashboard.smartLock.offersSubtitle')}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ mb: 2, flex: 1 }}>
              <FeatureItem text={t('dashboard.smartLock.feature1')} />
              <FeatureItem text={t('dashboard.smartLock.feature2')} />
              <FeatureItem text={t('dashboard.smartLock.feature3')} />
              <FeatureItem text={t('dashboard.smartLock.feature4')} />
            </Box>

            <Button
              variant="contained"
              size="small"
              onClick={onConfigure}
              sx={{
                textTransform: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                py: 0.75,
                bgcolor: '#6B8A9A',
                '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.9)' },
              }}
            >
              {t('dashboard.smartLock.configure')}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Config form ─────────────────────────────────────────────────────────────

interface ConfigFormProps {
  form: SmartLockFormState;
  setFormField: <K extends keyof SmartLockFormState>(key: K, value: SmartLockFormState[K]) => void;
  configSteps: string[];
  canGoNext: boolean;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  properties: Property[];
  loadingProperties: boolean;
}

function SmartLockConfigForm({
  form,
  setFormField,
  configSteps,
  canGoNext,
  onNext,
  onBack,
  onSubmit,
  onCancel,
  properties,
  loadingProperties,
}: ConfigFormProps) {
  const { t } = useTranslation();

  const renderStepContent = () => {
    switch (form.activeStep) {
      case 0:
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <Home sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.875rem' }}>
                {t('dashboard.smartLock.config.stepProperty')}
              </Typography>
            </Box>
            {loadingProperties ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Grid container spacing={1}>
                {properties.map((prop) => (
                  <Grid item xs={12} sm={6} key={prop.id}>
                    <Card
                      variant="outlined"
                      onClick={() => {
                        setFormField('selectedPropertyId', prop.id);
                        setFormField('selectedPropertyName', prop.name);
                      }}
                      sx={{
                        cursor: 'pointer',
                        borderColor: form.selectedPropertyId === prop.id ? 'primary.main' : 'divider',
                        borderWidth: form.selectedPropertyId === prop.id ? 2 : 1,
                        transition: 'border-color 0.15s',
                        '&:hover': { borderColor: 'primary.light' },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {form.selectedPropertyId === prop.id && (
                            <CheckCircle sx={{ fontSize: 16, color: 'primary.main' }} />
                          )}
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                            {prop.name}
                          </Typography>
                        </Box>
                        {prop.address && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.3 }}>
                            <LocationOn sx={{ fontSize: 12, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                              {prop.address}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <MeetingRoom sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.875rem' }}>
                {t('dashboard.smartLock.config.stepRoom')}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Optionnel — indiquez l&apos;emplacement de la serrure
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {ROOM_SUGGESTIONS.map((room) => (
                <Chip
                  key={room}
                  label={room}
                  size="small"
                  variant={form.roomName === room ? 'filled' : 'outlined'}
                  color={form.roomName === room ? 'primary' : 'default'}
                  onClick={() => setFormField('roomName', form.roomName === room ? '' : room)}
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Ou saisir un emplacement"
              value={form.roomName}
              onChange={(e) => setFormField('roomName', e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <LabelIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.875rem' }}>
                {t('dashboard.smartLock.config.stepDevice')}
              </Typography>
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Nom de la serrure"
              placeholder="ex: Serrure porte principale"
              value={form.deviceName}
              onChange={(e) => setFormField('deviceName', e.target.value)}
              sx={{ mb: 2, '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
            />
            <TextField
              fullWidth
              size="small"
              label="ID Device Tuya (optionnel)"
              placeholder="ex: bf4c8e2a..."
              value={form.externalDeviceId}
              onChange={(e) => setFormField('externalDeviceId', e.target.value)}
              helperText="Identifiant du device dans votre compte Tuya. Vous pouvez le configurer plus tard."
              sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
            />
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.875rem', mb: 2 }}>
              Confirmation
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Home sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                    <strong>Propriete :</strong> {form.selectedPropertyName}
                  </Typography>
                </Box>
                {form.roomName && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <MeetingRoom sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      <strong>Emplacement :</strong> {form.roomName}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <LockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                    <strong>Serrure :</strong> {form.deviceName}
                  </Typography>
                </Box>
                {form.externalDeviceId && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <LabelIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      <strong>ID Tuya :</strong> {form.externalDeviceId}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
            Configurer une serrure
          </Typography>
        </Box>
        <Button size="small" variant="text" onClick={onCancel} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
          Annuler
        </Button>
      </Box>

      <Stepper activeStep={form.activeStep} alternativeLabel sx={{ mb: 3 }}>
        {configSteps.map((label) => (
          <Step key={label}>
            <StepLabel
              sx={{
                '& .MuiStepLabel-label': { fontSize: '0.75rem', fontWeight: 500 },
                '& .Mui-active .MuiStepLabel-label': { fontWeight: 700 },
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1.5, mb: 2 }}>
        {renderStepContent()}
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowBack sx={{ fontSize: 14 }} />}
          onClick={form.activeStep === 0 ? onCancel : onBack}
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          {form.activeStep === 0 ? 'Annuler' : 'Retour'}
        </Button>

        {form.activeStep < 3 ? (
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={onNext}
            disabled={!canGoNext}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              bgcolor: '#6B8A9A',
              '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.9)' },
            }}
          >
            Suivant
          </Button>
        ) : (
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
            onClick={onSubmit}
            sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 700 }}
          >
            Confirmer
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ─── Battery icon helper ─────────────────────────────────────────────────────

function BatteryChip({ level }: { level: number | null }) {
  if (level === null || level < 0) {
    return (
      <Chip
        size="small"
        icon={<BatteryAlert sx={{ fontSize: 14 }} />}
        label="N/A"
        variant="outlined"
        sx={{ fontSize: '0.6875rem', height: 22 }}
      />
    );
  }

  const color = level > 50 ? 'success' : level > 20 ? 'warning' : 'error';
  const Icon = level > 50 ? BatteryFull : level > 20 ? BatteryAlert : Battery20;

  return (
    <Chip
      size="small"
      icon={<Icon sx={{ fontSize: 14 }} />}
      label={`${level}%`}
      color={color}
      variant="outlined"
      sx={{ fontSize: '0.6875rem', height: 22 }}
    />
  );
}

// ─── Lock state chip ─────────────────────────────────────────────────────────

function LockStateChip({ lockState, t }: { lockState: string; t: (key: string) => string }) {
  switch (lockState) {
    case 'LOCKED':
      return (
        <Chip
          size="small"
          icon={<LockIcon sx={{ fontSize: 14 }} />}
          label={t('dashboard.smartLock.locked')}
          color="success"
          variant="outlined"
          sx={{ fontSize: '0.6875rem', height: 22, fontWeight: 600 }}
        />
      );
    case 'UNLOCKED':
      return (
        <Chip
          size="small"
          icon={<LockOpenIcon sx={{ fontSize: 14 }} />}
          label={t('dashboard.smartLock.unlocked')}
          color="warning"
          variant="outlined"
          sx={{ fontSize: '0.6875rem', height: 22, fontWeight: 600 }}
        />
      );
    default:
      return (
        <Chip
          size="small"
          icon={<WifiOff sx={{ fontSize: 14 }} />}
          label={t('dashboard.smartLock.unknown')}
          variant="outlined"
          sx={{ fontSize: '0.6875rem', height: 22 }}
        />
      );
  }
}

// ─── Devices view ────────────────────────────────────────────────────────────

interface DevicesViewProps {
  devices: Array<{
    id: string;
    name: string;
    propertyName: string;
    roomName: string | null;
    lockState: string;
    batteryLevel: number | null;
    externalDeviceId: string | null;
  }>;
  onRemoveDevice: (id: string) => void;
  onAddDevice: () => void;
  onToggleLock: (id: string, lock: boolean) => void;
  lockingDeviceId: string | null;
}

function SmartLockDevicesView({ devices, onRemoveDevice, onAddDevice, onToggleLock, lockingDeviceId }: DevicesViewProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
            {t('dashboard.smartLock.title')}
          </Typography>
          <Chip
            label={`${devices.length} serrure${devices.length > 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6875rem', height: 22 }}
          />
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={onAddDevice}
          sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
        >
          {t('dashboard.smartLock.addDevice')}
        </Button>
      </Box>

      {/* Device cards grid */}
      <Grid container spacing={1.5}>
        {devices.map((device) => {
          const isLocking = lockingDeviceId === device.id;
          const isLocked = device.lockState === 'LOCKED';
          const hasExternalId = !!device.externalDeviceId;

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={device.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {/* Colonne gauche — Animation serrure */}
                  <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <SmartLockAnimation size={130} animated />
                  </Box>

                  {/* Colonne droite — Infos + actions */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Device name + delete */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
                          {device.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                          {device.propertyName}
                          {device.roomName ? ` — ${device.roomName}` : ''}
                        </Typography>
                      </Box>
                      <Tooltip title={t('dashboard.smartLock.confirmDelete')}>
                        <IconButton
                          size="small"
                          onClick={() => onRemoveDevice(device.id)}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Status chips */}
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                      <LockStateChip lockState={device.lockState} t={t} />
                      <BatteryChip level={device.batteryLevel} />
                      {hasExternalId && (
                        <Chip
                          size="small"
                          icon={<Wifi sx={{ fontSize: 12 }} />}
                          label="En ligne"
                          color="info"
                          variant="outlined"
                          sx={{ fontSize: '0.6875rem', height: 22 }}
                        />
                      )}
                    </Box>

                    {/* Lock / Unlock buttons */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {isLocked ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          fullWidth
                          startIcon={isLocking ? <CircularProgress size={14} /> : <LockOpenIcon sx={{ fontSize: 14 }} />}
                          onClick={() => onToggleLock(device.id, false)}
                          disabled={isLocking || !hasExternalId}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {t('dashboard.smartLock.unlockAction')}
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          fullWidth
                          startIcon={isLocking ? <CircularProgress size={14} color="inherit" /> : <LockIcon sx={{ fontSize: 14 }} />}
                          onClick={() => onToggleLock(device.id, true)}
                          disabled={isLocking || !hasExternalId}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {t('dashboard.smartLock.lockAction')}
                        </Button>
                      )}
                    </Box>

                    {!hasExternalId && (
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75, fontSize: '0.625rem', fontStyle: 'italic' }}>
                        ID Tuya non configure — commandes desactivees
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// ─── Main component (view router) ───────────────────────────────────────────

const DashboardSmartLockTab: React.FC = () => {
  const {
    currentView,
    setView,
    devices,
    hasDevices,
    form,
    setFormField,
    resetForm,
    startConfigFlow,
    configSteps,
    canGoNextConfig,
    handleConfigNext,
    handleConfigBack,
    handleConfigSubmit,
    removeDevice,
    toggleLock,
    lockingDeviceId,
  } = useSmartLocks();

  // Properties query (only active during config-form)
  const propertiesQuery = useQuery({
    queryKey: ['properties-for-smartlock-config'],
    queryFn: () => propertiesApi.getAll({ size: 1000 }),
    enabled: currentView === 'config-form',
    staleTime: 60_000,
  });

  const properties = useMemo(
    () => extractApiList<Property>(propertiesQuery.data),
    [propertiesQuery.data],
  );

  switch (currentView) {
    case 'offers':
      return <SmartLockOffersView onConfigure={startConfigFlow} />;

    case 'config-form':
      return (
        <SmartLockConfigForm
          form={form}
          setFormField={setFormField}
          configSteps={configSteps}
          canGoNext={canGoNextConfig}
          onNext={handleConfigNext}
          onBack={handleConfigBack}
          onSubmit={handleConfigSubmit}
          onCancel={() => {
            resetForm();
            setView(hasDevices ? 'devices' : 'offers');
          }}
          properties={properties}
          loadingProperties={propertiesQuery.isFetching}
        />
      );

    case 'devices':
      return (
        <SmartLockDevicesView
          devices={devices}
          onRemoveDevice={(id) => {
            removeDevice(id);
            if (devices.length <= 1) setView('offers');
          }}
          onAddDevice={() => setView('offers')}
          onToggleLock={toggleLock}
          lockingDeviceId={lockingDeviceId}
        />
      );

    default:
      return <SmartLockOffersView onConfigure={startConfigFlow} />;
  }
};

export default DashboardSmartLockTab;
