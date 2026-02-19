import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowForward,
  ArrowBack,
  Home,
  LocationOn,
  Handshake,
  Memory,
  CheckCircle,
  MeetingRoom,
  Label as LabelIcon,
} from '@mui/icons-material';
import type { NoiseDeviceFormState } from '../../hooks/useNoiseDevices';
import type { Property } from '../../services/api/propertiesApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Room suggestions ────────────────────────────────────────────────────────

const ROOM_SUGGESTIONS = ['Salon', 'Chambre 1', 'Chambre 2', 'Cuisine', 'Terrasse', 'Entree'];

// ─── Component ──────────────────────────────────────────────────────────────

interface NoiseDeviceConfigFormProps {
  form: NoiseDeviceFormState;
  setFormField: <K extends keyof NoiseDeviceFormState>(key: K, value: NoiseDeviceFormState[K]) => void;
  configSteps: string[];
  canGoNext: boolean;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  properties: Property[];
  loadingProperties: boolean;
}

const NoiseDeviceConfigForm: React.FC<NoiseDeviceConfigFormProps> = ({
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
}) => {
  const { t } = useTranslation();

  // Auto-generate device name suggestion when property/room changes
  useEffect(() => {
    if (form.activeStep === 2 && form.deviceName === '') {
      const typeLabel = form.deviceType === 'minut' ? 'Minut' : 'Clenzy';
      const roomPart = form.roomName ? ` - ${form.roomName}` : '';
      const suggestion = `${typeLabel} - ${form.selectedPropertyName}${roomPart}`;
      setFormField('deviceName', suggestion);
    }
  }, [form.activeStep, form.deviceType, form.selectedPropertyName, form.roomName, form.deviceName, setFormField]);

  // ── Step 0: Property selection ──
  const renderPropertyStep = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
        {t('dashboard.noise.config.selectPropertyTitle') || 'Selectionnez une propriete'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
        {t('dashboard.noise.config.selectPropertyDesc') || 'Choisissez la propriete ou sera installe le capteur.'}
      </Typography>

      {loadingProperties ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : properties.length === 0 ? (
        <Paper
          elevation={0}
          sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            Aucune propriete trouvee.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={1.5}>
          {properties.map((property) => {
            const isSelected = form.selectedPropertyId === property.id;
            return (
              <Grid item xs={12} sm={6} md={4} key={property.id}>
                <Card
                  variant={isSelected ? 'elevation' : 'outlined'}
                  onClick={() => {
                    setFormField('selectedPropertyId', property.id);
                    setFormField('selectedPropertyName', property.name);
                  }}
                  sx={{
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    transition: 'all 0.15s ease',
                    bgcolor: isSelected ? 'primary.main' + '08' : 'background.paper',
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'primary.light',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Home sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {property.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <LocationOn sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {property.address}, {property.city}
                      </Typography>
                    </Box>
                    <Chip
                      label={property.type}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.625rem', height: 18, mt: 0.5 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );

  // ── Step 1: Room selection (optional) ──
  const renderRoomStep = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
        {t('dashboard.noise.config.roomTitle') || 'Piece (optionnel)'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
        {t('dashboard.noise.config.roomDesc') ||
          'Si vous souhaitez surveiller une piece specifique, saisissez son nom. Laissez vide pour surveiller toute la propriete.'}
      </Typography>

      <TextField
        fullWidth
        size="small"
        value={form.roomName}
        onChange={(e) => setFormField('roomName', e.target.value)}
        placeholder={t('dashboard.noise.config.roomPlaceholder') || 'Nom de la piece (ex: Salon, Chambre 1)'}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' },
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 1, display: 'block' }}>
        {t('dashboard.noise.config.roomSuggestions') || 'Suggestions :'}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {ROOM_SUGGESTIONS.map((room) => (
          <Chip
            key={room}
            label={room}
            size="small"
            variant={form.roomName === room ? 'filled' : 'outlined'}
            color={form.roomName === room ? 'primary' : 'default'}
            onClick={() => setFormField('roomName', form.roomName === room ? '' : room)}
            sx={{ fontSize: '0.75rem', cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Divider sx={{ my: 2.5 }} />

      <Button
        variant="text"
        size="small"
        onClick={() => {
          setFormField('roomName', '');
          onNext();
        }}
        sx={{
          textTransform: 'none',
          fontSize: '0.8125rem',
          color: 'text.secondary',
          fontWeight: 600,
        }}
      >
        {t('dashboard.noise.config.roomSkip') || 'Toute la propriete'} &rarr;
      </Button>
    </Box>
  );

  // ── Step 2: Device name ──
  const renderNameStep = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
        {t('dashboard.noise.config.nameTitle') || 'Nom du capteur'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2.5 }}>
        {t('dashboard.noise.config.nameDesc') ||
          'Donnez un nom a votre capteur pour l\'identifier facilement dans le tableau de bord.'}
      </Typography>

      <TextField
        fullWidth
        size="small"
        value={form.deviceName}
        onChange={(e) => setFormField('deviceName', e.target.value)}
        placeholder={t('dashboard.noise.config.namePlaceholder') || 'Ex: Capteur Salon Haussmann'}
        sx={{
          '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' },
        }}
      />
    </Box>
  );

  // ── Step 3: Confirmation ──
  const renderConfirmStep = () => {
    const isMinut = form.deviceType === 'minut';
    return (
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
          {t('dashboard.noise.config.confirmTitle') || 'Resume de la configuration'}
        </Typography>

        <Paper
          elevation={0}
          sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          {/* Device type */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {isMinut ? (
              <Handshake sx={{ color: '#6B8A9A', fontSize: 20 }} />
            ) : (
              <Memory sx={{ color: '#4A9B8E', fontSize: 20 }} />
            )}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('dashboard.noise.config.confirmDeviceType') || 'Type de capteur'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {isMinut ? 'Minut' : 'Clenzy Hardware'}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Property */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Home sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('dashboard.noise.config.confirmProperty') || 'Propriete'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {form.selectedPropertyName}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Room */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MeetingRoom sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('dashboard.noise.config.confirmRoom') || 'Piece'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {form.roomName || (t('dashboard.noise.entireProperty') || 'Propriete entiere')}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Device name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LabelIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {t('dashboard.noise.config.confirmDeviceName') || 'Nom du capteur'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {form.deviceName}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  };

  // ── Step content router ──
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderPropertyStep();
      case 1:
        return renderRoomStep();
      case 2:
        return renderNameStep();
      case 3:
        return renderConfirmStep();
      default:
        return null;
    }
  };

  const isLastStep = form.activeStep === configSteps.length - 1;

  return (
    <Box sx={{ p: 1 }}>
      {/* Title */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '0.95rem', mb: 2 }}>
        {t('dashboard.noise.config.title') || 'Configuration du capteur'}
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={form.activeStep} alternativeLabel sx={{ mb: 3 }}>
        {configSteps.map((label) => (
          <Step key={label}>
            <StepLabel
              sx={{
                '& .MuiStepLabel-label': { fontSize: '0.75rem' },
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step content */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          minHeight: 200,
        }}
      >
        {getStepContent(form.activeStep)}
      </Paper>

      {/* Navigation buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2.5 }}>
        <Button
          variant="text"
          size="small"
          onClick={form.activeStep === 0 ? onCancel : onBack}
          startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontSize: '0.8125rem', color: 'text.secondary' }}
        >
          {form.activeStep === 0
            ? (t('dashboard.noise.config.cancel') || 'Annuler')
            : (t('dashboard.noise.config.back') || 'Retour')}
        </Button>

        <Button
          variant="contained"
          size="small"
          disabled={!canGoNext}
          onClick={isLastStep ? onSubmit : onNext}
          endIcon={isLastStep ? <CheckCircle sx={{ fontSize: 16 }} /> : <ArrowForward sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontSize: '0.8125rem',
            fontWeight: 600,
            px: 2.5,
            py: 0.75,
          }}
        >
          {isLastStep
            ? (t('dashboard.noise.config.confirm') || 'Confirmer')
            : (t('dashboard.noise.config.next') || 'Suivant')}
        </Button>
      </Box>
    </Box>
  );
};

export default NoiseDeviceConfigForm;
