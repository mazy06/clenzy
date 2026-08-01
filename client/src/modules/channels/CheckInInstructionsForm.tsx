import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription, Button as BuiButton } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Textarea,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { propertyDetailsKeys } from '../../hooks/usePropertyDetails';
import { Box, Paper, Button, Alert, IconButton, Tooltip, LinearProgress, Stack, Switch, FormControlLabel } from '@mui/material';
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
      <div className="flex items-start gap-2 mb-3">
        <div className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center shrink-0" style={{ color: accentColor, backgroundColor: `${accentColor}15` }}>
          {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
            size: 18,
            strokeWidth: 1.75,
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="cn-text-body1 text-[0.9375rem] font-semibold leading-[1.2]">
              {title}
            </p>
            {showProgress && (
              <StatusChip
                size="sm"
                tokens={{
                  color: allFilled ? accentColor : 'var(--muted)',
                  bg: allFilled ? `${accentColor}1f` : 'transparent',
                }}
                icon={allFilled ? <CheckCircle size={12} strokeWidth={2} /> : undefined}
                label={`${filledCount}/${totalCount}`}
                // La teinte de bordure derive de `accentColor`, connu a
                // l'execution : style inline, une classe ne peut pas la porter.
                sx={{ borderColor: allFilled ? `${accentColor}40` : 'var(--line)' }}
                className="border border-solid"
              />
            )}
          </div>
          {description && (
            <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </Paper>
  );
}

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
  // Prefixe d'id pour les codes additionnels : la liste est dynamique, seul un id
  // genere garantit que chaque libelle designe bien son propre champ.
  const extraCodesFieldId = React.useId();

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
      <div className="flex justify-center py-9">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <div className="pb-14">
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="cn-text-body1 text-[1rem] font-bold mb-0.5">
              {t('channels.checkIn.title')}
            </p>
            <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground">
              Informations partagées avec les voyageurs avant et pendant leur séjour
            </p>
          </div>
          <Stack spacing={0.75} alignItems="flex-end" sx={{ minWidth: 200 }}>
            <div className="flex items-center gap-1.5">
              <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] font-semibold uppercase tracking-[0.5px]">
                Complétude
              </p>
              <StatusChip tokens={{ color: stats.filled === stats.total ? '#3E9C80' : 'primary.contrastText', bg: stats.filled === stats.total ? '#3E9C8015' : 'primary.main' }} label={`${stats.filled}/${stats.total}`} className="h-[20px]" />
            </div>
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
              <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60">
                {t('channels.checkIn.lastUpdated')} : {new Date(instructions.updatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </Stack>
        </div>
      </Box>

      {/* ─── Section cards grid ────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1fr]">
        {/* Accès & WiFi */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            icon={<KeyIcon />}
            accentColor="#C28A52"
            title={t('channels.checkIn.accessSection')}
            description="Code d'entrée et identifiants WiFi"
            filledCount={stats.access}
            totalCount={3}
          >
            <div className="grid gap-[9px] grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr_1fr]">
              <Field>
                <FieldLabel htmlFor="checkin-access-code">{t('channels.checkIn.accessCode')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="checkin-access-code"
                    value={form.accessCode ?? ''}
                    placeholder={t('channels.checkIn.generator.open', 'Cliquer pour générer')}
                    readOnly
                    // Champ non saisissable : le clic ouvre le generateur, d'ou le
                    // curseur pointeur au lieu du caret.
                    className="cursor-pointer font-mono text-[0.9375rem] font-semibold tracking-[0.05em]"
                    onClick={() => setGenOpen(true)}
                  />
                  <InputGroupAddon align="inline-end">
                    {hasSmartLock ? (
                      <Tooltip title={t('channels.checkIn.smartLockFetch', 'Récupérer le code de la serrure connectée')}>
                        <span>
                          <IconButton size="small" disabled={fetchingLock} onClick={(e) => { e.stopPropagation(); fetchSmartLockCode(); }}>
                            <CloudDownload size={15} strokeWidth={1.85} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                    <Tooltip title={t('channels.checkIn.generator.regenerate', 'Régénérer le code')}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); regenerateAccessCode(); }}>
                        <Autorenew size={15} strokeWidth={1.85} />
                      </IconButton>
                    </Tooltip>
                    {form.accessCode ? (
                      <Tooltip title={copiedField === 'accessCode' ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCopy('accessCode', form.accessCode); }}>
                          {copiedField === 'accessCode' ? (
                            <CheckCircle size={16} strokeWidth={2} color="#3E9C80" />
                          ) : (
                            <ContentCopy size={14} strokeWidth={1.75} />
                          )}
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="checkin-wifi-name">{t('channels.checkIn.wifiName')}</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <span className="inline-flex text-muted-foreground">
                      <WifiIcon size={16} strokeWidth={1.75} />
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="checkin-wifi-name"
                    value={form.wifiName ?? ''}
                    onChange={(e) => handleChange('wifiName', e.target.value)}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="checkin-wifi-password">{t('channels.checkIn.wifiPassword')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="checkin-wifi-password"
                    value={form.wifiPassword ?? ''}
                    onChange={(e) => handleChange('wifiPassword', e.target.value)}
                    type={showWifiPassword ? 'text' : 'password'}
                  />
                  <InputGroupAddon align="inline-end">
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
                      aria-label={showWifiPassword
                        ? t('channels.checkIn.hidePassword', 'Masquer le mot de passe')
                        : t('channels.checkIn.showPassword', 'Afficher le mot de passe')}
                    >
                      {showWifiPassword ? (
                        <VisibilityOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Visibility size={16} strokeWidth={1.75} />
                      )}
                    </IconButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            {hasSmartLock ? (
              <span className="cn-text-caption text-muted-foreground block mt-1.5 max-w-[560px]">
                {t('channels.checkIn.smartLockManaged', 'Serrure connectée détectée : le code du séjour est généré et géré par la serrure (un code par réservation). Ce champ sert de secours (boîte à clé).')}
              </span>
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
                  <div className="ms-0.5 mt-0.5">
                    <p className="cn-text-body2 font-semibold">
                      {t('channels.checkIn.autoRotate', 'Régénérer le code après chaque départ')}
                    </p>
                    <span className="cn-text-caption text-muted-foreground block max-w-[520px]">
                      {t('channels.checkIn.autoRotateHint', 'Un nouveau code (même format) est généré après le checkout — pensez à mettre à jour le code de la boîte à clé. Les serrures connectées tournent déjà automatiquement.')}
                    </span>
                  </div>
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
                  <div className="ms-0.5 mt-0.5">
                    <p className="cn-text-body2 font-semibold">
                      {t('channels.checkIn.guestUnlock', "Autoriser l'ouverture de la porte depuis le livret")}
                    </p>
                    <span className="cn-text-caption text-muted-foreground block max-w-[520px]">
                      {t('channels.checkIn.guestUnlockHint', "Le voyageur voit un bouton « Ouvrir la porte » dans son livret, actif uniquement pendant son séjour (à partir de l'heure de check-in). Chaque ouverture vous est notifiée.")}
                    </span>
                  </div>
                }
              />
            ) : null}
            <div className="mt-3">
              <p className="cn-text-body2 font-semibold mb-1.5">
                {t('channels.checkIn.extraCodes', 'Codes additionnels')}
              </p>
              <Stack spacing={1}>
                {extraCodes.map((ec, i) => {
                  const slug = slugify(ec.label);
                  return (
                    <div className="flex gap-1.5 items-end flex-wrap" key={i}>
                      <Field className="flex-[1_1_150px]">
                        <FieldLabel htmlFor={`${extraCodesFieldId}-label-${i}`}>
                          {t('channels.checkIn.extraCodeLabel', 'Libellé')}
                        </FieldLabel>
                        <Input
                          id={`${extraCodesFieldId}-label-${i}`}
                          value={ec.label}
                          onChange={(e) => updateExtraCode(i, 'label', e.target.value)}
                        />
                      </Field>
                      <Field className="flex-[1_1_110px]">
                        <FieldLabel htmlFor={`${extraCodesFieldId}-code-${i}`}>
                          {t('channels.checkIn.extraCodeValue', 'Code')}
                        </FieldLabel>
                        <Input
                          id={`${extraCodesFieldId}-code-${i}`}
                          className="font-mono"
                          value={ec.code}
                          onChange={(e) => updateExtraCode(i, 'code', e.target.value)}
                        />
                      </Field>
                      {slug ? (
                        <Tooltip title={copiedField === `extraTag${i}` ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.extraCodeTagCopy', 'Copier le tag email')}>
                          {/* Le span porte la ref que Tooltip pose sur son enfant :
                              StatusChip est une fonction et n'en transmet pas. */}
                          <span className="inline-flex">
                            <StatusChip
                              tone="neutral"
                              label={`{code_${slug}}`}
                              onClick={() => handleCopy(`extraTag${i}`, `{code_${slug}}`)}
                              className="font-mono"
                            />
                          </span>
                        </Tooltip>
                      ) : null}
                      <IconButton size="small" onClick={() => removeExtraCode(i)} aria-label="Supprimer">
                        <CloseIcon size={16} strokeWidth={1.8} />
                      </IconButton>
                    </div>
                  );
                })}
              </Stack>
              <BuiButton variant="ghost" size="sm" onClick={addExtraCode} className="mt-1.5">
                + {t('channels.checkIn.extraCodeAdd', 'Ajouter un code')}
              </BuiButton>
              <span className="cn-text-caption text-muted-foreground block mt-0.5">
                {t('channels.checkIn.extraCodesHint', 'Affichés dans le livret. Chaque code fournit un tag à coller dans vos emails.')}
              </span>
            </div>
          </SectionCard>
        </div>

        {/* Parking */}
        <SectionCard
          icon={<ParkingIcon />}
          accentColor="#4F86C6"
          title={t('channels.checkIn.parkingSection')}
          description="Où et comment se garer"
          filledCount={stats.parking}
          totalCount={1}
        >
          <Field>
            <FieldLabel htmlFor="checkin-parking-info">{t('channels.checkIn.parkingInfo')}</FieldLabel>
            <Textarea
              id="checkin-parking-info"
              rows={2}
              value={form.parkingInfo ?? ''}
              onChange={(e) => handleChange('parkingInfo', e.target.value)}
              placeholder="Ex : Parking gratuit en face du bâtiment, place numéro 12..."
            />
          </Field>
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
          <Field>
            <FieldLabel htmlFor="checkin-arrival-instructions">{t('channels.checkIn.arrivalInstructions')}</FieldLabel>
            <Textarea
              id="checkin-arrival-instructions"
              rows={3}
              value={form.arrivalInstructions ?? ''}
              onChange={(e) => handleChange('arrivalInstructions', e.target.value)}
              placeholder={t('channels.checkIn.arrivalPlaceholder')}
            />
          </Field>
        </SectionCard>

        {/* Photos d'accès */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            icon={<PhotoIcon />}
            accentColor="#9A7FA3"
            title={t('channels.checkIn.accessPhotosSection', "Photos d'accès")}
            description={t('channels.checkIn.accessPhotosDesc', 'Aidez le voyageur à trouver et accéder au logement (entrée, parcours, boîte à clés…)')}
            filledCount={accessPhotos.length > 0 ? 1 : 0}
            totalCount={1}
          >
            <div className="flex flex-wrap gap-2">
              {accessPhotos.map((p) => (
                <div className="w-[140px]" key={p.key}>
                  <div className="relative w-[140px] h-[100px] rounded-[1.5px] overflow-hidden border border-[var(--line)] bg-[var(--hover)]">
                    <img className="w-full h-full object-cover block" src={p.preview ?? `/api/properties/${propertyId}/check-in-instructions/access-photos?key=${encodeURIComponent(p.key)}`} alt={p.caption || 'photo'} />
                    <IconButton
                      size="small"
                      onClick={() => handleRemovePhoto(p.key)}
                      aria-label={t('common.delete', 'Supprimer')}
                      sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
                    >
                      <CloseIcon size={14} strokeWidth={2} />
                    </IconButton>
                  </div>
                  {/* Legende sans libelle visible : la vignette la porte, d'ou
                      l'aria-label plutot qu'un FieldLabel. */}
                  <Input
                    className="mt-1 text-[0.75rem]"
                    value={p.caption}
                    onChange={(e) => handlePhotoCaption(p.key, e.target.value)}
                    aria-label={t('channels.checkIn.photoCaption', 'Légende…')}
                    placeholder={t('channels.checkIn.photoCaption', 'Légende…')}
                  />
                </div>
              ))}
              <Button
                component="label"
                variant="outlined"
                disabled={uploadingPhoto}
                sx={{ width: 140, height: 100, flexDirection: 'column', gap: 0.5, textTransform: 'none', fontSize: '0.75rem', borderStyle: 'dashed', color: 'text.secondary' }}
              >
                {uploadingPhoto ? <Spinner className="size-[18px]" /> : <PhotoIcon size={20} strokeWidth={1.75} />}
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
            </div>
          </SectionCard>
        </div>

        {/* Départ */}
        <SectionCard
          icon={<DepartureIcon />}
          accentColor="#7BA3C2"
          title={t('channels.checkIn.departureSection')}
          description="Procédure et check-out"
          filledCount={stats.departure}
          totalCount={1}
        >
          <Field>
            <FieldLabel htmlFor="checkin-departure-instructions">{t('channels.checkIn.departureInstructions')}</FieldLabel>
            <Textarea
              id="checkin-departure-instructions"
              rows={3}
              value={form.departureInstructions ?? ''}
              onChange={(e) => handleChange('departureInstructions', e.target.value)}
              placeholder={t('channels.checkIn.departurePlaceholder')}
            />
          </Field>
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
          <Field>
            <FieldLabel htmlFor="checkin-house-rules">{t('channels.checkIn.houseRules')}</FieldLabel>
            <Textarea
              id="checkin-house-rules"
              rows={3}
              value={form.houseRules ?? ''}
              onChange={(e) => handleChange('houseRules', e.target.value)}
              placeholder="Pas de fête, pas de fumeurs, animaux acceptés..."
            />
          </Field>
        </SectionCard>

        {/* Urgence — full width, alert-styled */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            icon={<PhoneIcon />}
            accentColor="#E5484D"
            title={t('channels.checkIn.emergencySection')}
            description="À contacter en cas d'incident — affiché en évidence pour le voyageur"
            filledCount={stats.emergency}
            totalCount={1}
          >
            <Field>
              <FieldLabel htmlFor="checkin-emergency-contact">{t('channels.checkIn.emergencyContact')}</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <span className="inline-flex text-[#E5484D]">
                    <PhoneIcon size={16} strokeWidth={1.75} />
                  </span>
                </InputGroupAddon>
                <InputGroupInput
                  id="checkin-emergency-contact"
                  value={form.emergencyContact ?? ''}
                  onChange={(e) => handleChange('emergencyContact', e.target.value)}
                  placeholder="Ex : +33 6 12 34 56 78 — Marie (gestionnaire)"
                />
              </InputGroup>
            </Field>
          </SectionCard>
        </div>

        {/* Compléments — full width */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            icon={<NotesIcon />}
            accentColor="#8BA0B3"
            title={t('channels.checkIn.additionalSection')}
            description="Bons plans, recommandations, infos pratiques sur le quartier"
            filledCount={stats.additional}
            totalCount={1}
          >
            <Field>
              <FieldLabel htmlFor="checkin-additional-notes">{t('channels.checkIn.additionalNotes')}</FieldLabel>
              <Textarea
                id="checkin-additional-notes"
                rows={3}
                value={form.additionalNotes ?? ''}
                onChange={(e) => handleChange('additionalNotes', e.target.value)}
                placeholder="Boulangerie au coin de la rue, supermarché à 200m, conseils transports..."
              />
            </Field>
          </SectionCard>
        </div>
      </div>

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
        <div className="min-w-0 flex-1">
          {error && (
            <UiAlert variant="destructive" className="text-[0.75rem] py-0.5">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </UiAlert>
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
            <p className="cn-text-body1 text-[0.75rem] text-[var(--bui-warning-ink)] font-semibold">
              ● Modifications non enregistrées
            </p>
          )}
          {!error && !success && !dirty && instructions?.updatedAt && (
            <p className="cn-text-body1 text-[0.75rem] text-muted-foreground opacity-60">
              Aucune modification en cours
            </p>
          )}
        </div>
        {/* Largeur plancher conservee : evite que la barre sursaute entre
            « Enregistrement… » et « Enregistrer ». */}
        <BuiButton
          onClick={handleSave}
          disabled={saving || !dirty}
          className="min-w-[140px]"
        >
          {saving ? <Spinner className="size-3.5" /> : <SaveIcon strokeWidth={1.75} />}
          {saving ? 'Enregistrement…' : t('common.save')}
        </BuiButton>
      </Box>

      <AccessCodeGeneratorDialog
        open={genOpen}
        initialCode={form.accessCode}
        initialFormat={codeFormat}
        smartLockHint={hasSmartLock}
        onClose={() => setGenOpen(false)}
        onApply={(code, format) => { handleChange('accessCode', code); setCodeFormat(format); setGenOpen(false); }}
      />
    </div>
  );
};

export default CheckInInstructionsForm;
