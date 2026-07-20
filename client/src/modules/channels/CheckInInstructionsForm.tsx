import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { propertyDetailsKeys } from '../../hooks/usePropertyDetails';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  InputAdornment,
  Tooltip,
  LinearProgress,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  VpnKey as KeyIcon,
  Wifi as WifiIcon,
  LocalParking as ParkingIcon,
  FlightLand as ArrivalIcon,
  FlightTakeoff as DepartureIcon,
  Gavel as RulesIcon,
  Phone as PhoneIcon,
  Notes as NotesIcon,
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
  CheckCircle,
  ContentCopy,
  Autorenew,
  CloudDownload,
  AddPhotoAlternate as PhotoIcon,
  Close as CloseIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { CheckInInstructions, UpdateCheckInInstructions } from '../../services/api/airbnbApi';
import AccessCodeGeneratorDialog, { generateCode, inferFormat, type CodeFormat } from '../../components/AccessCodeGeneratorDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckInInstructionsFormProps {
  propertyId: number;
}

/** Photo d'indication d'accès. `preview` = dataURL local affiché juste après l'upload. */
interface AccessPhoto {
  key: string;
  caption: string;
  preview?: string;
}

function parseAccessPhotos(json: string | null | undefined): AccessPhoto[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr)
      ? arr.flatMap((p) =>
          p && typeof p.key === 'string'
            ? [{ key: p.key as string, caption: typeof p.caption === 'string' ? p.caption : '' }]
            : [])
      : [];
  } catch {
    return [];
  }
}

// Slug stable du tag email d'un code additionnel — DOIT correspondre au back (TemplateInterpolationService.slugify).
const slugify = (label: string) =>
  (label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ─── Section card ───────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactElement;
  accentColor: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  filledCount?: number;
  totalCount?: number;
}

function SectionCard({ icon, accentColor, title, description, children, filledCount, totalCount }: SectionCardProps) {
  const showProgress = filledCount !== undefined && totalCount !== undefined;
  const allFilled = showProgress && filledCount === totalCount;

  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        p: 2.5,
        borderRadius: 2,
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'border-color 200ms, box-shadow 200ms',
        '&:hover': {
          borderColor: accentColor,
          boxShadow: `0 1px 2px ${accentColor}1a`,
        },
        // Liseré gauche coloré
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          bgcolor: accentColor,
          opacity: 0.7,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            bgcolor: `${accentColor}15`,
            flexShrink: 0,
          }}
        >
          {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
            size: 18,
            strokeWidth: 1.75,
          })}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.2 }}>
              {title}
            </Typography>
            {showProgress && (
              <Chip
                size="small"
                label={`${filledCount}/${totalCount}`}
                icon={allFilled ? <CheckCircle size={12} strokeWidth={2} color={accentColor} /> : undefined}
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  bgcolor: allFilled ? `${accentColor}1f` : 'transparent',
                  color: allFilled ? accentColor : 'text.secondary',
                  border: '1px solid',
                  borderColor: allFilled ? `${accentColor}40` : 'divider',
                  '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
          </Box>
          {description && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>
      {children}
    </Paper>
  );
}

// ─── Field styles ───────────────────────────────────────────────────────────

const FIELD_SX = {
  '& .MuiInputBase-input': { fontSize: '0.8125rem' },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const CheckInInstructionsForm: React.FC<CheckInInstructionsFormProps> = ({ propertyId }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState<CheckInInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateCheckInInstructions>({
    accessCode: null,
    wifiName: null,
    wifiPassword: null,
    parkingInfo: null,
    arrivalInstructions: null,
    departureInstructions: null,
    houseRules: null,
    emergencyContact: null,
    additionalNotes: null,
  });
  const [dirty, setDirty] = useState(false);
  const [accessPhotos, setAccessPhotos] = useState<AccessPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Générateur de code d'accès : popup de paramétrage + format mémorisé pour la régénération rapide.
  const [genOpen, setGenOpen] = useState(false);
  const [codeFormat, setCodeFormat] = useState<CodeFormat>(() => inferFormat(null));
  // Rotation automatique du code après chaque départ (opt-in par logement).
  const [autoRotate, setAutoRotate] = useState(false);
  // Serrure connectée détectée → permet de récupérer le code généré par la serrure.
  const [hasSmartLock, setHasSmartLock] = useState(false);
  const [fetchingLock, setFetchingLock] = useState(false);
  // Codes additionnels libres (résidence, immeuble, parking…) — un tag email par code.
  const [extraCodes, setExtraCodes] = useState<Array<{ label: string; code: string }>>([]);
  // Ouverture de la porte depuis le livret guest (opt-in, serrure connectée requise).
  const [guestUnlock, setGuestUnlock] = useState(false);

  // Fetch existing instructions
  useEffect(() => {
    setLoading(true);
    setError(null);
    airbnbApi.getCheckInInstructions(propertyId)
      .then((data) => {
        setInstructions(data);
        setForm({
          accessCode: data.accessCode,
          wifiName: data.wifiName,
          wifiPassword: data.wifiPassword,
          parkingInfo: data.parkingInfo,
          arrivalInstructions: data.arrivalInstructions,
          departureInstructions: data.departureInstructions,
          houseRules: data.houseRules,
          emergencyContact: data.emergencyContact,
          additionalNotes: data.additionalNotes,
        });
        setAccessPhotos(parseAccessPhotos(data.arrivalPhotos));
        setAutoRotate(!!data.accessCodeAutoRotate);
        setGuestUnlock(!!data.guestUnlockEnabled);
        // Reprend le format persisté (sinon déduit du code existant).
        let fmt: CodeFormat;
        try {
          fmt = data.accessCodeFormat ? (JSON.parse(data.accessCodeFormat) as CodeFormat) : inferFormat(data.accessCode);
        } catch {
          fmt = inferFormat(data.accessCode);
        }
        setCodeFormat(fmt);
        try {
          const parsed = data.extraAccessCodes ? JSON.parse(data.extraAccessCodes) : [];
          setExtraCodes(Array.isArray(parsed)
            ? parsed
                .filter((x: unknown): x is { label?: string; code?: string } => !!x && typeof x === 'object')
                .map((x) => ({ label: x.label || '', code: x.code || '' }))
            : []);
        } catch {
          setExtraCodes([]);
        }
      })
      .catch(() => {
        // No instructions yet — form stays empty
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  // Détecte une serrure connectée → propose de récupérer le code généré par la serrure.
  useEffect(() => {
    airbnbApi.getSmartLockCode(propertyId)
      .then((r) => setHasSmartLock(!!r.hasSmartLock))
      .catch(() => setHasSmartLock(false));
  }, [propertyId]);

  const handleChange = useCallback((field: keyof UpdateCheckInInstructions, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
    setSuccess(false);
    setDirty(true);
  }, []);

  /** Régénère un code d'accès aléatoire avec le format mémorisé (icône à côté du champ). */
  const regenerateAccessCode = useCallback(() => {
    const next = generateCode(codeFormat);
    if (next) handleChange('accessCode', next);
  }, [codeFormat, handleChange]);

  /** Récupère le code généré par la serrure connectée et le place dans le champ. */
  const fetchSmartLockCode = useCallback(async () => {
    setFetchingLock(true);
    setError(null);
    try {
      const r = await airbnbApi.getSmartLockCode(propertyId);
      setHasSmartLock(!!r.hasSmartLock);
      if (r.code) {
        handleChange('accessCode', r.code);
      } else {
        setError(t('channels.checkIn.smartLockNoCode', 'Aucun code de serrure actif pour le séjour en cours.'));
      }
    } catch {
      setError(t('channels.checkIn.smartLockError', 'Impossible de récupérer le code de la serrure.'));
    } finally {
      setFetchingLock(false);
    }
  }, [propertyId, handleChange, t]);

  const addExtraCode = () => { setExtraCodes((prev) => [...prev, { label: '', code: '' }]); setDirty(true); setSuccess(false); };
  const updateExtraCode = (i: number, field: 'label' | 'code', value: string) => {
    setExtraCodes((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
    setDirty(true); setSuccess(false);
  };
  const removeExtraCode = (i: number) => { setExtraCodes((prev) => prev.filter((_, idx) => idx !== i)); setDirty(true); setSuccess(false); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        ...form,
        arrivalPhotos: JSON.stringify(accessPhotos.map((p) => ({ key: p.key, caption: p.caption }))),
        accessCodeAutoRotate: autoRotate,
        accessCodeFormat: JSON.stringify(codeFormat),
        extraAccessCodes: JSON.stringify(extraCodes.filter((c) => c.label.trim() || c.code.trim())),
        guestUnlockEnabled: guestUnlock,
      };
      const updated = await airbnbApi.updateCheckInInstructions(propertyId, payload);
      setInstructions(updated);
      setAccessPhotos(parseAccessPhotos(updated.arrivalPhotos));
      setSuccess(true);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.detail(String(propertyId)) });
    } catch {
      setError(t('channels.checkIn.errorSaving'));
    } finally {
      setSaving(false);
    }
  }, [propertyId, form, accessPhotos, autoRotate, codeFormat, extraCodes, guestUnlock, t, queryClient]);

  const handleAddPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('channels.checkIn.photoInvalid', 'Format image requis (jpeg, png, webp, gif)'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('channels.checkIn.photoTooLarge', 'Image trop volumineuse (max 5 Mo)'));
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      const { key } = await airbnbApi.uploadAccessPhoto(propertyId, file);
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setAccessPhotos((prev) => [...prev, { key, caption: '', preview }]);
      setDirty(true);
      setSuccess(false);
    } catch {
      setError(t('channels.checkIn.photoUploadError', "Échec de l'envoi de la photo"));
    } finally {
      setUploadingPhoto(false);
    }
  }, [propertyId, t]);

  const handleRemovePhoto = useCallback((key: string) => {
    setAccessPhotos((prev) => prev.filter((p) => p.key !== key));
    setDirty(true);
    setSuccess(false);
  }, []);

  const handlePhotoCaption = useCallback((key: string, caption: string) => {
    setAccessPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, caption } : p)));
    setDirty(true);
    setSuccess(false);
  }, []);

  const handleCopy = useCallback((field: string, value: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);

  // Completion stats
  const stats = useMemo(() => {
    const fields: (keyof UpdateCheckInInstructions)[] = [
      'accessCode', 'wifiName', 'wifiPassword', 'parkingInfo',
      'arrivalInstructions', 'departureInstructions',
      'houseRules', 'emergencyContact', 'additionalNotes',
    ];
    const filled = fields.filter((f) => (form[f] ?? '').toString().trim() !== '').length;
    return {
      filled,
      total: fields.length,
      percentage: Math.round((filled / fields.length) * 100),
      access: ['accessCode', 'wifiName', 'wifiPassword'].filter((f) => (form[f as keyof UpdateCheckInInstructions] ?? '').toString().trim() !== '').length,
      parking: form.parkingInfo ? 1 : 0,
      arrival: form.arrivalInstructions ? 1 : 0,
      departure: form.departureInstructions ? 1 : 0,
      rules: form.houseRules ? 1 : 0,
      emergency: form.emergencyContact ? 1 : 0,
      additional: form.additionalNotes ? 1 : 0,
    };
  }, [form]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 /* room for the sticky save bar */ }}>
      {/* ─── Header with progress ─────────────────────────────────────── */}
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(107,138,154,0.12) 0%, rgba(107,138,154,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(107,138,154,0.08) 0%, rgba(107,138,154,0.02) 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.25 }}>
              {t('channels.checkIn.title')}
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              Informations partagées avec les voyageurs avant et pendant leur séjour
            </Typography>
          </Box>
          <Stack spacing={0.75} alignItems="flex-end" sx={{ minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Complétude
              </Typography>
              <Chip
                size="small"
                label={`${stats.filled}/${stats.total}`}
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  bgcolor: stats.filled === stats.total ? '#3E9C8015' : 'primary.main',
                  color: stats.filled === stats.total ? '#3E9C80' : 'primary.contrastText',
                  border: stats.filled === stats.total ? '1px solid #3E9C8040' : 'none',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={stats.percentage}
              sx={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: stats.percentage === 100 ? '#3E9C80' : 'primary.main',
                  borderRadius: 2,
                },
              }}
            />
            {instructions?.updatedAt && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                {t('channels.checkIn.lastUpdated')} : {new Date(instructions.updatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* ─── Section cards grid ────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {/* Accès & WiFi */}
        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <SectionCard
            icon={<KeyIcon />}
            accentColor="#C28A52"
            title={t('channels.checkIn.accessSection')}
            description="Code d'entrée et identifiants WiFi"
            filledCount={stats.access}
            totalCount={3}
          >
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              <TextField
                label={t('channels.checkIn.accessCode')}
                value={form.accessCode ?? ''}
                placeholder={t('channels.checkIn.generator.open', 'Cliquer pour générer')}
                size="small"
                onClick={() => setGenOpen(true)}
                sx={{
                  ...FIELD_SX,
                  '& .MuiInputBase-root': { cursor: 'pointer' },
                  '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '0.05em', cursor: 'pointer' },
                }}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      {hasSmartLock ? (
                        <Tooltip title={t('channels.checkIn.smartLockFetch', 'Récupérer le code de la serrure connectée')}>
                          <span>
                            <IconButton size="small" edge="end" disabled={fetchingLock} onClick={(e) => { e.stopPropagation(); fetchSmartLockCode(); }}>
                              <CloudDownload size={15} strokeWidth={1.85} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      <Tooltip title={t('channels.checkIn.generator.regenerate', 'Régénérer le code')}>
                        <IconButton size="small" edge="end" onClick={(e) => { e.stopPropagation(); regenerateAccessCode(); }}>
                          <Autorenew size={15} strokeWidth={1.85} />
                        </IconButton>
                      </Tooltip>
                      {form.accessCode ? (
                        <Tooltip title={copiedField === 'accessCode' ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}>
                          <IconButton size="small" edge="end" onClick={(e) => { e.stopPropagation(); handleCopy('accessCode', form.accessCode); }}>
                            {copiedField === 'accessCode' ? (
                              <CheckCircle size={16} strokeWidth={2} color="#3E9C80" />
                            ) : (
                              <ContentCopy size={14} strokeWidth={1.75} />
                            )}
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label={t('channels.checkIn.wifiName')}
                value={form.wifiName ?? ''}
                onChange={(e) => handleChange('wifiName', e.target.value)}
                size="small"
                sx={FIELD_SX}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                        <WifiIcon size={16} strokeWidth={1.75} />
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label={t('channels.checkIn.wifiPassword')}
                value={form.wifiPassword ?? ''}
                onChange={(e) => handleChange('wifiPassword', e.target.value)}
                size="small"
                type={showWifiPassword ? 'text' : 'password'}
                sx={FIELD_SX}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Stack direction="row" spacing={0}>
                        {form.wifiPassword && (
                          <Tooltip title={copiedField === 'wifiPassword' ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}>
                            <IconButton size="small" onClick={() => handleCopy('wifiPassword', form.wifiPassword)}>
                              {copiedField === 'wifiPassword' ? (
                                <CheckCircle size={16} strokeWidth={2} color="#3E9C80" />
                              ) : (
                                <ContentCopy size={14} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => setShowWifiPassword((v) => !v)}
                          edge="end"
                        >
                          {showWifiPassword ? (
                            <VisibilityOff size={16} strokeWidth={1.75} />
                          ) : (
                            <Visibility size={16} strokeWidth={1.75} />
                          )}
                        </IconButton>
                      </Stack>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            {hasSmartLock ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, maxWidth: 560 }}>
                {t('channels.checkIn.smartLockManaged', 'Serrure connectée détectée : le code du séjour est généré et géré par la serrure (un code par réservation). Ce champ sert de secours (boîte à clé).')}
              </Typography>
            ) : (
              <FormControlLabel
                sx={{ mt: 1.5, ml: 0, alignItems: 'flex-start' }}
                control={
                  <Switch
                    checked={autoRotate}
                    onChange={(e) => { setAutoRotate(e.target.checked); setDirty(true); setSuccess(false); }}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ ml: 0.5, mt: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t('channels.checkIn.autoRotate', 'Régénérer le code après chaque départ')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 520 }}>
                      {t('channels.checkIn.autoRotateHint', 'Un nouveau code (même format) est généré après le checkout — pensez à mettre à jour le code de la boîte à clé. Les serrures connectées tournent déjà automatiquement.')}
                    </Typography>
                  </Box>
                }
              />
            )}
            {hasSmartLock ? (
              <FormControlLabel
                sx={{ mt: 1, ml: 0, alignItems: 'flex-start' }}
                control={
                  <Switch
                    checked={guestUnlock}
                    onChange={(e) => { setGuestUnlock(e.target.checked); setDirty(true); setSuccess(false); }}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ ml: 0.5, mt: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t('channels.checkIn.guestUnlock', "Autoriser l'ouverture de la porte depuis le livret")}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 520 }}>
                      {t('channels.checkIn.guestUnlockHint', "Le voyageur voit un bouton « Ouvrir la porte » dans son livret, actif uniquement pendant son séjour (à partir de l'heure de check-in). Chaque ouverture vous est notifiée.")}
                    </Typography>
                  </Box>
                }
              />
            ) : null}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('channels.checkIn.extraCodes', 'Codes additionnels')}
              </Typography>
              <Stack spacing={1}>
                {extraCodes.map((ec, i) => {
                  const slug = slugify(ec.label);
                  return (
                    <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        size="small" label={t('channels.checkIn.extraCodeLabel', 'Libellé')}
                        value={ec.label} onChange={(e) => updateExtraCode(i, 'label', e.target.value)}
                        sx={{ flex: '1 1 150px' }}
                      />
                      <TextField
                        size="small" label={t('channels.checkIn.extraCodeValue', 'Code')}
                        value={ec.code} onChange={(e) => updateExtraCode(i, 'code', e.target.value)}
                        sx={{ flex: '1 1 110px', '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                      />
                      {slug ? (
                        <Tooltip title={copiedField === `extraTag${i}` ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.extraCodeTagCopy', 'Copier le tag email')}>
                          <Chip
                            size="small" label={`{code_${slug}}`}
                            onClick={() => handleCopy(`extraTag${i}`, `{code_${slug}}`)}
                            sx={{ fontFamily: 'monospace', cursor: 'pointer' }}
                          />
                        </Tooltip>
                      ) : null}
                      <IconButton size="small" onClick={() => removeExtraCode(i)} aria-label="Supprimer">
                        <CloseIcon size={16} strokeWidth={1.8} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
              <Button size="small" onClick={addExtraCode} sx={{ mt: 1, textTransform: 'none' }}>
                + {t('channels.checkIn.extraCodeAdd', 'Ajouter un code')}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                {t('channels.checkIn.extraCodesHint', 'Affichés dans le livret. Chaque code fournit un tag à coller dans vos emails.')}
              </Typography>
            </Box>
          </SectionCard>
        </Box>

        {/* Parking */}
        <SectionCard
          icon={<ParkingIcon />}
          accentColor="#4F86C6"
          title={t('channels.checkIn.parkingSection')}
          description="Où et comment se garer"
          filledCount={stats.parking}
          totalCount={1}
        >
          <TextField
            label={t('channels.checkIn.parkingInfo')}
            value={form.parkingInfo ?? ''}
            onChange={(e) => handleChange('parkingInfo', e.target.value)}
            size="small"
            multiline
            rows={2}
            fullWidth
            sx={FIELD_SX}
            placeholder="Ex : Parking gratuit en face du bâtiment, place numéro 12..."
          />
        </SectionCard>

        {/* Arrivée */}
        <SectionCard
          icon={<ArrivalIcon />}
          accentColor="#3E9C80"
          title={t('channels.checkIn.arrivalSection')}
          description="Comment accéder au logement"
          filledCount={stats.arrival}
          totalCount={1}
        >
          <TextField
            label={t('channels.checkIn.arrivalInstructions')}
            value={form.arrivalInstructions ?? ''}
            onChange={(e) => handleChange('arrivalInstructions', e.target.value)}
            size="small"
            multiline
            rows={3}
            fullWidth
            sx={FIELD_SX}
            placeholder={t('channels.checkIn.arrivalPlaceholder')}
          />
        </SectionCard>

        {/* Photos d'accès */}
        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <SectionCard
            icon={<PhotoIcon />}
            accentColor="#9A7FA3"
            title={t('channels.checkIn.accessPhotosSection', "Photos d'accès")}
            description={t('channels.checkIn.accessPhotosDesc', 'Aidez le voyageur à trouver et accéder au logement (entrée, parcours, boîte à clés…)')}
            filledCount={accessPhotos.length > 0 ? 1 : 0}
            totalCount={1}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {accessPhotos.map((p) => (
                <Box key={p.key} sx={{ width: 140 }}>
                  <Box sx={{ position: 'relative', width: 140, height: 100, borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                    <Box
                      component="img"
                      src={p.preview ?? `/api/properties/${propertyId}/check-in-instructions/access-photos?key=${encodeURIComponent(p.key)}`}
                      alt={p.caption || 'photo'}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemovePhoto(p.key)}
                      aria-label={t('common.delete', 'Supprimer')}
                      sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
                    >
                      <CloseIcon size={14} strokeWidth={2} />
                    </IconButton>
                  </Box>
                  <TextField
                    value={p.caption}
                    onChange={(e) => handlePhotoCaption(p.key, e.target.value)}
                    size="small"
                    fullWidth
                    variant="standard"
                    placeholder={t('channels.checkIn.photoCaption', 'Légende…')}
                    sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
                  />
                </Box>
              ))}
              <Button
                component="label"
                variant="outlined"
                disabled={uploadingPhoto}
                sx={{ width: 140, height: 100, flexDirection: 'column', gap: 0.5, textTransform: 'none', fontSize: '0.75rem', borderStyle: 'dashed', color: 'text.secondary' }}
              >
                {uploadingPhoto ? <CircularProgress size={18} /> : <PhotoIcon size={20} strokeWidth={1.75} />}
                {t('channels.checkIn.addPhoto', 'Ajouter')}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAddPhoto(file);
                    e.target.value = '';
                  }}
                />
              </Button>
            </Box>
          </SectionCard>
        </Box>

        {/* Départ */}
        <SectionCard
          icon={<DepartureIcon />}
          accentColor="#7BA3C2"
          title={t('channels.checkIn.departureSection')}
          description="Procédure et check-out"
          filledCount={stats.departure}
          totalCount={1}
        >
          <TextField
            label={t('channels.checkIn.departureInstructions')}
            value={form.departureInstructions ?? ''}
            onChange={(e) => handleChange('departureInstructions', e.target.value)}
            size="small"
            multiline
            rows={3}
            fullWidth
            sx={FIELD_SX}
            placeholder={t('channels.checkIn.departurePlaceholder')}
          />
        </SectionCard>

        {/* Règlement */}
        <SectionCard
          icon={<RulesIcon />}
          accentColor="#9A7FA3"
          title={t('channels.checkIn.rulesSection')}
          description="Règles à respecter dans le logement"
          filledCount={stats.rules}
          totalCount={1}
        >
          <TextField
            label={t('channels.checkIn.houseRules')}
            value={form.houseRules ?? ''}
            onChange={(e) => handleChange('houseRules', e.target.value)}
            size="small"
            multiline
            rows={3}
            fullWidth
            sx={FIELD_SX}
            placeholder="Pas de fête, pas de fumeurs, animaux acceptés..."
          />
        </SectionCard>

        {/* Urgence — full width, alert-styled */}
        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <SectionCard
            icon={<PhoneIcon />}
            accentColor="#E5484D"
            title={t('channels.checkIn.emergencySection')}
            description="À contacter en cas d'incident — affiché en évidence pour le voyageur"
            filledCount={stats.emergency}
            totalCount={1}
          >
            <TextField
              label={t('channels.checkIn.emergencyContact')}
              value={form.emergencyContact ?? ''}
              onChange={(e) => handleChange('emergencyContact', e.target.value)}
              size="small"
              fullWidth
              sx={FIELD_SX}
              placeholder="Ex : +33 6 12 34 56 78 — Marie (gestionnaire)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box component="span" sx={{ display: 'inline-flex', color: '#E5484D' }}>
                      <PhoneIcon size={16} strokeWidth={1.75} />
                    </Box>
                  </InputAdornment>
                ),
              }}
            />
          </SectionCard>
        </Box>

        {/* Compléments — full width */}
        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <SectionCard
            icon={<NotesIcon />}
            accentColor="#8BA0B3"
            title={t('channels.checkIn.additionalSection')}
            description="Bons plans, recommandations, infos pratiques sur le quartier"
            filledCount={stats.additional}
            totalCount={1}
          >
            <TextField
              label={t('channels.checkIn.additionalNotes')}
              value={form.additionalNotes ?? ''}
              onChange={(e) => handleChange('additionalNotes', e.target.value)}
              size="small"
              multiline
              rows={3}
              fullWidth
              sx={FIELD_SX}
              placeholder="Boulangerie au coin de la rue, supermarché à 200m, conseils transports..."
            />
          </SectionCard>
        </Box>
      </Box>

      {/* ─── Sticky save bar ──────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 3,
          mx: -3,
          px: 3,
          py: 1.5,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(18,18,18,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          zIndex: 2,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {error && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', py: 0.5 }}>
              {error}
            </Alert>
          )}
          {success && !error && (
            <Alert
              severity="success"
              icon={<CheckCircle size={16} strokeWidth={2} />}
              sx={{ fontSize: '0.75rem', py: 0.5 }}
            >
              {t('channels.checkIn.saved')}
            </Alert>
          )}
          {!error && !success && dirty && (
            <Typography sx={{ fontSize: '0.75rem', color: 'warning.main', fontWeight: 600 }}>
              ● Modifications non enregistrées
            </Typography>
          )}
          {!error && !success && !dirty && instructions?.updatedAt && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
              Aucune modification en cours
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon size={16} strokeWidth={1.75} />}
          onClick={handleSave}
          disabled={saving || !dirty}
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'none',
            minWidth: 140,
          }}
        >
          {saving ? 'Enregistrement…' : t('common.save')}
        </Button>
      </Box>

      <AccessCodeGeneratorDialog
        open={genOpen}
        initialCode={form.accessCode}
        initialFormat={codeFormat}
        smartLockHint={hasSmartLock}
        onClose={() => setGenOpen(false)}
        onApply={(code, format) => { handleChange('accessCode', code); setCodeFormat(format); setGenOpen(false); }}
      />
    </Box>
  );
};

export default CheckInInstructionsForm;
