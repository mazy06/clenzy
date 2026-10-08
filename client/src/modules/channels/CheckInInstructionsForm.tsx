import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription, Button as BuiButton } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { PropertyTabHeading, PropertyTabLoading } from '../properties/PropertyTabPrimitives';
import { PROPERTY_ART } from '../properties/propertyArtwork';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldContent,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Textarea,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { propertyDetailsKeys } from '../../hooks/usePropertyDetails';
import {
  Progress,
  Switch,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui';
import {
  Wifi as WifiIcon,
  Phone as PhoneIcon,
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
import { activeIntlLocale } from '../../utils/activeLocale';

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
  art: string;
  active: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  filledCount?: number;
  totalCount?: number;
}
function SectionCard({ art, active, title, description, children, filledCount, totalCount }: SectionCardProps) {
  return <section className="pdt-checkin-section" hidden={!active}>
    <PropertyTabHeading art={art} title={title} description={description}
      actions={totalCount !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{filledCount}/{totalCount}</span>} />
    {children}
  </section>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CheckInInstructionsForm: React.FC<CheckInInstructionsFormProps> = ({ propertyId }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState(0);
  const [instructions, setInstructions] = useState<CheckInInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
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
    let active = true;
    setLoading(true);
    setLoadError(false);
    setError(null);
    setDirty(false);
    setSuccess(false);
    airbnbApi.getCheckInInstructions(propertyId)
      .then((data) => {
        if (!active) return;
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
      .catch((error: { status?: number }) => {
        if (!active) return;
        if (error.status === 404) {
          setInstructions(null);
          setForm({ accessCode: null, wifiName: null, wifiPassword: null, parkingInfo: null,
            arrivalInstructions: null, departureInstructions: null, houseRules: null,
            emergencyContact: null, additionalNotes: null });
          setAccessPhotos([]); setExtraCodes([]); setAutoRotate(false); setGuestUnlock(false);
          setCodeFormat(inferFormat(null));
        } else setLoadError(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [propertyId, retry]);

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

  const sections = [
    { label: t('channels.checkIn.accessSection'), art: PROPERTY_ART.access, count: stats.access, total: 3 },
    { label: t('channels.checkIn.parkingSection'), art: PROPERTY_ART.location, count: stats.parking, total: 1 },
    { label: t('channels.checkIn.arrivalSection'), art: PROPERTY_ART.arrival, count: stats.arrival, total: 1 },
    { label: t('channels.checkIn.accessPhotosSection', "Photos d'accès"), art: PROPERTY_ART.photos, count: accessPhotos.length ? 1 : 0, total: 1 },
    { label: t('channels.checkIn.departureSection'), art: PROPERTY_ART.departure, count: stats.departure, total: 1 },
    { label: t('channels.checkIn.rulesSection'), art: PROPERTY_ART.compliance, count: stats.rules, total: 1 },
    { label: t('channels.checkIn.emergencySection'), art: PROPERTY_ART.messages, count: stats.emergency, total: 1 },
    { label: t('channels.checkIn.additionalSection'), art: PROPERTY_ART.description, count: stats.additional, total: 1 },
  ];
  const headerActions = usePageHeaderActions(<BuiButton onClick={handleSave} disabled={loading || loadError || saving || !dirty}>
    {saving ? <Spinner className="size-4" /> : <SaveIcon size={16} />}{t('common.save')}
  </BuiButton>);
  if (loading) return <PropertyTabLoading />;
  if (loadError) return <UiAlert variant="destructive"><TriangleAlert />
    <AlertDescription>{t('propertyTabs.instructionsLoadError', 'Impossible de charger les instructions voyageurs.')}</AlertDescription>
    <BuiButton variant="outline" onClick={() => setRetry(value => value + 1)}>{t('common.retry', 'Réessayer')}</BuiButton>
  </UiAlert>;
  return (
    <div className="pdt-page">
      {headerActions}
      <section className="pdt-surface">
        <PropertyTabHeading art={PROPERTY_ART.description} title={t('channels.checkIn.title')} description={t('channels.checkIn.subtitle')} />
        <div className="pdt-checkin-progress">
          <span>{t('channels.checkIn.completeness')} <b className="tabular-nums">{stats.filled}/{stats.total}</b></span>
          <Progress value={stats.percentage} aria-label={t('channels.checkIn.completeness')} />
          {instructions?.updatedAt && <span className="hidden sm:block">{t('channels.checkIn.lastUpdated')} : {new Date(instructions.updatedAt).toLocaleDateString(activeIntlLocale())}</span>}
        </div>
      </section>
      <div className="pdt-nav-layout">
        <nav className="pdt-nav" aria-label={t('channels.checkIn.title')}>
          {sections.map((section,index) => <button key={index} type="button" aria-current={activeSection === index ? 'step' : undefined} onClick={() => setActiveSection(index)}>
            <img src={section.art} alt="" /><span>{section.label}</span><small>{section.count}/{section.total}</small>
          </button>)}
        </nav>
      {/* ─── Section cards grid ────────────────────────────────────────── */}
      <div className="pdt-checkin-panels">
        {/* Accès & WiFi */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            art={PROPERTY_ART.access}
          active={activeSection === 0}
            title={t('channels.checkIn.accessSection')}
            description={t('propertyTabs.accessHint', "Code d’entrée et identifiants Wi-Fi")}
            filledCount={stats.access}
            totalCount={3}
          >
            <div className="pdt-access-fields">
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <InputGroupButton
                              size="icon-xs"
                              disabled={fetchingLock}
                              aria-label={t('channels.checkIn.smartLockFetch', 'Récupérer le code de la serrure connectée')}
                              onClick={(e) => { e.stopPropagation(); fetchSmartLockCode(); }}
                            >
                              <CloudDownload size={15} strokeWidth={1.85} />
                            </InputGroupButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('channels.checkIn.smartLockFetch', 'Récupérer le code de la serrure connectée')}</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={t('channels.checkIn.generator.regenerate', 'Régénérer le code')}
                          onClick={(e) => { e.stopPropagation(); regenerateAccessCode(); }}
                        >
                          <Autorenew size={15} strokeWidth={1.85} />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>{t('channels.checkIn.generator.regenerate', 'Régénérer le code')}</TooltipContent>
                    </Tooltip>
                    {form.accessCode ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InputGroupButton
                            size="icon-xs"
                            aria-label={t('channels.checkIn.generator.copy', 'Copier')}
                            onClick={(e) => { e.stopPropagation(); handleCopy('accessCode', form.accessCode); }}
                          >
                            {copiedField === 'accessCode' ? (
                              <CheckCircle size={16} strokeWidth={2} color="var(--bui-success)" />
                            ) : (
                              <ContentCopy size={14} strokeWidth={1.75} />
                            )}
                          </InputGroupButton>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedField === 'accessCode'
                            ? t('channels.checkIn.generator.copied', 'Copié !')
                            : t('channels.checkIn.generator.copy', 'Copier')}
                        </TooltipContent>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InputGroupButton
                            size="icon-xs"
                            aria-label={t('channels.checkIn.generator.copy', 'Copier')}
                            onClick={() => handleCopy('wifiPassword', form.wifiPassword)}
                          >
                            {copiedField === 'wifiPassword' ? (
                              <CheckCircle size={16} strokeWidth={2} color="var(--bui-success)" />
                            ) : (
                              <ContentCopy size={14} strokeWidth={1.75} />
                            )}
                          </InputGroupButton>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedField === 'wifiPassword'
                            ? t('channels.checkIn.generator.copied', 'Copié !')
                            : t('channels.checkIn.generator.copy', 'Copier')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <InputGroupButton
                      size="icon-xs"
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
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            {hasSmartLock ? (
              <span className="block text-xs text-muted-foreground mt-1.5 max-w-[560px]">
                {t('channels.checkIn.smartLockManaged', 'Serrure connectée détectée : le code du séjour est généré et géré par la serrure (un code par réservation). Ce champ sert de secours (boîte à clé).')}
              </span>
            ) : (
              <Field orientation="horizontal" className="mt-[9px] items-start">
                <Switch
                  id="checkin-auto-rotate"
                  size="sm"
                  checked={autoRotate}
                  onCheckedChange={(checked) => { setAutoRotate(checked); setDirty(true); setSuccess(false); }}
                />
                <FieldContent className="ms-0.5 mt-0.5">
                  <FieldLabel htmlFor="checkin-auto-rotate" className="text-xs font-semibold">
                    {t('channels.checkIn.autoRotate', 'Régénérer le code après chaque départ')}
                  </FieldLabel>
                  <span className="block text-xs text-muted-foreground max-w-[520px]">
                    {t('channels.checkIn.autoRotateHint', 'Un nouveau code (même format) est généré après le checkout — pensez à mettre à jour le code de la boîte à clé. Les serrures connectées tournent déjà automatiquement.')}
                  </span>
                </FieldContent>
              </Field>
            )}
            {hasSmartLock ? (
              <Field orientation="horizontal" className="mt-1.5 items-start">
                <Switch
                  id="checkin-guest-unlock"
                  size="sm"
                  checked={guestUnlock}
                  onCheckedChange={(checked) => { setGuestUnlock(checked); setDirty(true); setSuccess(false); }}
                />
                <FieldContent className="ms-0.5 mt-0.5">
                  <FieldLabel htmlFor="checkin-guest-unlock" className="text-xs font-semibold">
                    {t('channels.checkIn.guestUnlock', "Autoriser l'ouverture de la porte depuis le livret")}
                  </FieldLabel>
                  <span className="block text-xs text-muted-foreground max-w-[520px]">
                    {t('channels.checkIn.guestUnlockHint', "Le voyageur voit un bouton « Ouvrir la porte » dans son livret, actif uniquement pendant son séjour (à partir de l'heure de check-in). Chaque ouverture vous est notifiée.")}
                  </span>
                </FieldContent>
              </Field>
            ) : null}
            <div className="mt-3">
              <p className="text-xs font-semibold mb-1.5">
                {t('channels.checkIn.extraCodes', 'Codes additionnels')}
              </p>
              <div className="flex flex-col gap-1.5">
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
                        <Tooltip>
                          {/* Le span porte la ref que TooltipTrigger pose sur son
                              enfant : StatusChip est une fonction et n'en transmet pas. */}
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <StatusChip
                                tone="neutral"
                                label={`{code_${slug}}`}
                                onClick={() => handleCopy(`extraTag${i}`, `{code_${slug}}`)}
                                className="font-mono"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copiedField === `extraTag${i}`
                              ? t('channels.checkIn.generator.copied', 'Copié !')
                              : t('channels.checkIn.extraCodeTagCopy', 'Copier le tag email')}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      <BuiButton variant="ghost" size="icon-sm" onClick={() => removeExtraCode(i)} aria-label="Supprimer">
                        <CloseIcon size={16} strokeWidth={1.8} />
                      </BuiButton>
                    </div>
                  );
                })}
              </div>
              <BuiButton variant="ghost" size="sm" onClick={addExtraCode} className="mt-1.5">
                + {t('channels.checkIn.extraCodeAdd', 'Ajouter un code')}
              </BuiButton>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {t('channels.checkIn.extraCodesHint', 'Affichés dans le livret. Chaque code fournit un tag à coller dans vos emails.')}
              </span>
            </div>
          </SectionCard>
        </div>

        {/* Parking */}
        <SectionCard
          art={PROPERTY_ART.location}
          active={activeSection === 1}
          title={t('channels.checkIn.parkingSection')}
          description={t('channels.checkIn.parkingDesc')}
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
              placeholder={t('channels.checkIn.parkingPlaceholder')}
            />
          </Field>
        </SectionCard>

        {/* Arrivée */}
        <SectionCard
          art={PROPERTY_ART.arrival}
          active={activeSection === 2}
          title={t('channels.checkIn.arrivalSection')}
          description={t('channels.checkIn.arrivalDesc')}
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
            art={PROPERTY_ART.photos}
          active={activeSection === 3}
            title={t('channels.checkIn.accessPhotosSection', "Photos d'accès")}
            description={t('channels.checkIn.accessPhotosDesc', 'Aidez le voyageur à trouver et accéder au logement (entrée, parcours, boîte à clés…)')}
            filledCount={accessPhotos.length > 0 ? 1 : 0}
            totalCount={1}
          >
            <div className="flex flex-wrap gap-2">
              {accessPhotos.map((p) => (
                <div className="w-[140px]" key={p.key}>
                  <div className="relative w-[140px] h-[100px] rounded-lg overflow-hidden border border-border bg-muted">
                    <img className="w-full h-full object-cover block" src={p.preview ?? `/api/properties/${propertyId}/check-in-instructions/access-photos?key=${encodeURIComponent(p.key)}`} alt={p.caption || 'photo'} />
                    <BuiButton
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemovePhoto(p.key)}
                      aria-label={t('common.delete', 'Supprimer')}
                      // Voile sombre : la vignette est une photo, la teinte du
                      // theme n'y garantirait pas le contraste dans les deux modes.
                      className="absolute top-0.5 end-0.5 p-0 bg-black/55 text-white hover:bg-black/75 hover:text-white"
                    >
                      <CloseIcon size={14} strokeWidth={2} />
                    </BuiButton>
                  </div>
                  {/* Legende sans libelle visible : la vignette la porte, d'ou
                      l'aria-label plutot qu'un FieldLabel. */}
                  <Input
                    className="mt-1 text-xs"
                    value={p.caption}
                    onChange={(e) => handlePhotoCaption(p.key, e.target.value)}
                    aria-label={t('channels.checkIn.photoCaption', 'Légende…')}
                    placeholder={t('channels.checkIn.photoCaption', 'Légende…')}
                  />
                </div>
              ))}
              {/* `asChild` + <label> : le champ fichier reste declenche par le
                  clic sur le bouton, comme le faisait `component="label"`. */}
              {/* `disabled` n'existe pas sur <label> : l'etat inactif passe par
                  les classes (et par le champ fichier, lui, desactivable). */}
              <BuiButton
                asChild
                variant="outline"
                className={cn(
                  'w-[140px] h-[100px] flex-col gap-[3px] text-xs border-dashed text-muted-foreground cursor-pointer',
                  uploadingPhoto && 'pointer-events-none opacity-50',
                )}
              >
                <label>
                  {uploadingPhoto ? <Spinner className="size-[18px]" /> : <PhotoIcon size={20} strokeWidth={1.75} />}
                  {t('channels.checkIn.addPhoto', 'Ajouter')}
                  <input
                    hidden
                    type="file"
                    disabled={uploadingPhoto}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddPhoto(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </BuiButton>
            </div>
          </SectionCard>
        </div>

        {/* Départ */}
        <SectionCard
          art={PROPERTY_ART.departure}
          active={activeSection === 4}
          title={t('channels.checkIn.departureSection')}
          description={t('channels.checkIn.departureDesc')}
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
          art={PROPERTY_ART.compliance}
          active={activeSection === 5}
          title={t('channels.checkIn.rulesSection')}
          description={t('channels.checkIn.rulesDesc')}
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
              placeholder={t('channels.checkIn.rulesPlaceholder')}
            />
          </Field>
        </SectionCard>

        {/* Urgence — full width, alert-styled */}
        <div className="col-span-[1] min-[900px]:col-span-[1_/_-1]">
          <SectionCard
            art={PROPERTY_ART.messages}
          active={activeSection === 6}
            title={t('channels.checkIn.emergencySection')}
            description={t('propertyTabs.emergencyHint', 'Le contact à joindre en cas d’incident pendant le séjour.')}
            filledCount={stats.emergency}
            totalCount={1}
          >
            <Field>
              <FieldLabel htmlFor="checkin-emergency-contact">{t('channels.checkIn.emergencyContact')}</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <span className="inline-flex text-destructive">
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
            art={PROPERTY_ART.description}
          active={activeSection === 7}
            title={t('channels.checkIn.additionalSection')}
            description={t('channels.checkIn.additionalDesc')}
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
                placeholder={t('channels.checkIn.additionalPlaceholder')}
              />
            </Field>
          </SectionCard>
        </div>
      </div>

      </div>
      {/* ─── Sticky save bar ──────────────────────────────────────────── */}
      <div className="pdt-checkin-save">
        <div className="min-w-0 flex-1">
          {error && (
            <UiAlert variant="destructive" className="text-xs py-0.5">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </UiAlert>
          )}
          {success && !error && (
            <UiAlert variant="success" className="text-xs py-[3px]">
              <CheckCircle size={16} strokeWidth={2} />
              <AlertDescription>{t('channels.checkIn.saved')}</AlertDescription>
            </UiAlert>
          )}
          {!error && !success && dirty && (
            <p className="text-xs font-semibold text-warning-ink">
              {t('propertyTabs.unsaved', 'Modifications non enregistrées')}
            </p>
          )}
          {!error && !success && !dirty && instructions?.updatedAt && (
            <p className="text-xs text-muted-foreground opacity-60">
              {t('channels.checkIn.noChanges')}
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
      </div>

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
