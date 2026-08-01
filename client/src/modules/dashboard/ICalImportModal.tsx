import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Switch, Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import {
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  CloudDownload as ImportIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Sync as SyncIcon,
  EventAvailable as EventIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '../../icons';
import type { ICalPreviewResponse, ICalImportResponse, ICalEventPreview } from '../../services/api/iCalApi';
import { useAuth } from '../../hooks/useAuth';
import {
  useICalAccess,
  useICalProperties,
  useICalOwners,
  useICalPreview,
  useICalImport,
} from './useICalImport';
// ─── Source logos ─────────────────────────────────────────────────────────────
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../assets/logo/logo-booking-planning.png';
import homeAwayLogo from '../../assets/logo/HomeAway-logo.png';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import leboncoinLogo from '../../assets/logo/Leboncoin-logo.png';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ICalImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

interface SourceDef {
  value: string;
  label: string;
  logo?: string;
  patterns: string[];
}

const SOURCES: SourceDef[] = [
  { value: 'Airbnb', label: 'Airbnb', logo: airbnbLogoSmall, patterns: ['airbnb.fr', 'airbnb.com', 'airbnb.co'] },
  { value: 'Booking.com', label: 'Booking.com', logo: bookingLogoSmall, patterns: ['booking.com', 'admin.booking'] },
  { value: 'Vrbo', label: 'Vrbo', logo: homeAwayLogo, patterns: ['vrbo.com', 'homeaway.com', 'abritel.fr'] },
  { value: 'Expedia', label: 'Expedia', logo: expediaLogo, patterns: ['expedia.com', 'expedia.fr'] },
  { value: 'Leboncoin', label: 'Leboncoin', logo: leboncoinLogo, patterns: ['leboncoin.fr'] },
  { value: 'Google Calendar', label: 'Google Calendar', logo: undefined, patterns: ['google.com/calendar', 'calendar.google'] },
  { value: 'Autre', label: 'Autre', logo: undefined, patterns: [] },
];

/** Detect the source platform from an iCal URL */
function detectSourceFromUrl(url: string): SourceDef {
  const lower = url.toLowerCase();
  for (const source of SOURCES) {
    if (source.patterns.some(p => lower.includes(p))) return source;
  }
  return SOURCES[SOURCES.length - 1]; // 'Autre'
}

/** Small circular logo for source display */
const SourceLogoIcon: React.FC<{ logo?: string; label: string; size?: number }> = ({ logo, label, size = 20 }) => {
  if (!logo) return null;
  const imgSize = size * 0.7;
  // La taille est une prop : elle passe par style, une classe ne peut pas naitre d'une variable.
  return (
    <div
      className="inline-flex items-center justify-center shrink-0 rounded-[50%] border-[1.5px] border-solid border-[var(--line)] bg-[#fff]"
      style={{ width: size, height: size, minWidth: size }}
    >
      <img src={logo} alt={label} width={imgSize} height={imgSize} style={{ objectFit: 'contain', borderRadius: '50%' }} />
    </div>
  );
};

const STEPS = ['Configuration', 'Aperçu', 'Résultat'];

// Les champs de ce formulaire sont passes aux primitives du kit : le libelle
// notche sur la bordure (pattern .rm-field) laisse place au libelle statique.

/** Toggle « Signature » (.rm-toggle) — accent quand coché, conserve la taille small. */
const SWITCH_SX = {
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: '#fff',
    '& + .MuiSwitch-track': { backgroundColor: 'var(--accent)', opacity: 1 },
  },
  '& .MuiSwitch-track': { backgroundColor: 'var(--line-2)', opacity: 1, transition: 'background-color .18s' },
} as const;

// ─── Step indicator component ────────────────────────────────────────────────

const StepIndicator: React.FC<{ steps: string[]; activeStep: number }> = ({ steps, activeStep }) => (
  <div className="flex items-center justify-center gap-0 py-2">
    {steps.map((label, idx) => {
      const isActive = idx === activeStep;
      const isDone = idx < activeStep;
      return (
        <React.Fragment key={label}>
          {idx > 0 && (
            <div className={cn('w-[48px] h-[2px] mx-[3px] rounded-[8px]', isDone ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} style={{ transition: 'background-color 0.3s' }} />
          )}
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'w-7 h-7 rounded-[50%] flex items-center justify-center text-[0.75rem] font-bold [transition:all_0.3s]',
                isActive && 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_0_3px_var(--accent-soft)]',
                isDone && 'bg-[var(--accent)] text-[var(--on-accent)]',
                !isActive && !isDone && 'bg-[var(--field)] text-[var(--muted)] border-[1.5px] border-solid border-[var(--line-2)]',
              )}
            >
              {isDone ? '✓' : idx + 1}
            </div>
            <span className={cn('cn-text-caption text-[0.625rem] tracking-[0.02em]', isActive ? 'font-bold' : 'font-medium', isActive ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}>
              {label}
            </span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

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

// ─── Component ───────────────────────────────────────────────────────────────

const ICalImportModal: React.FC<ICalImportModalProps> = ({ open, onClose, onImportSuccess }) => {
  const { user, isAdmin, isManager, isHost } = useAuth();

  // Stepper
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: Config
  const [url, setUrl] = useState('');
  const [ownerId, setOwnerId] = useState<number | ''>('');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [autoCreateInterventions, setAutoCreateInterventions] = useState(false);

  // Auto-detected source from URL
  const detectedSource = detectSourceFromUrl(url);
  const sourceName = detectedSource.value;

  // Step 2: Preview
  const [preview, setPreview] = useState<ICalPreviewResponse | null>(null);

  // Step 3: Result
  const [importResult, setImportResult] = useState<ICalImportResponse | null>(null);

  // Local error for form validation only
  const [formError, setFormError] = useState<string | null>(null);

  const canChangeOwner = isAdmin() || isManager();

  // ─── React Query hooks ──────────────────────────────────────────────

  const accessQuery = useICalAccess(open);
  const propertiesQuery = useICalProperties(open);
  const ownersQuery = useICalOwners(open && canChangeOwner);
  const previewMutation = useICalPreview();
  const importMutation = useICalImport();

  const hasAccess = accessQuery.data?.allowed ?? true;
  const allProperties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const owners = ownersQuery.data ?? [];

  // Derived loading: any mutation in flight
  const loading = previewMutation.isPending || importMutation.isPending;

  // Derived error: mutation errors or form validation error
  const error =
    formError
    ?? previewMutation.error?.message
    ?? importMutation.error?.message
    ?? null;

  // ─── Auto-set ownerId for host users ────────────────────────────────

  useEffect(() => {
    if (open && isHost() && !canChangeOwner && user?.id && ownerId === '') {
      setOwnerId(Number(user.id));
    }
    // Garde `ownerId === ''` : apres le set, la condition devient fausse (pas de boucle).
  }, [open, user, isHost, canChangeOwner, ownerId]);

  // ─── Proprietes filtrees par proprietaire ────────────────────────────

  const filteredProperties = useMemo(
    () => (ownerId ? allProperties.filter(p => p.ownerId === Number(ownerId)) : allProperties),
    [allProperties, ownerId],
  );

  useEffect(() => {
    if (propertyId && ownerId) {
      const stillValid = filteredProperties.some(p => p.id === propertyId);
      if (!stillValid) {
        setPropertyId('');
      }
    }
    // Garde `stillValid` : reset une seule fois puis propertyId '' -> no-op.
  }, [ownerId, propertyId, filteredProperties]);

  // ─── Nom du proprietaire pour affichage ──────────────────────────────

  const getOwnerDisplayName = (): string => {
    if (!user) return '';
    if (isHost() && !canChangeOwner) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
    }
    if (ownerId) {
      const owner = owners.find(o => o.id === Number(ownerId));
      return owner ? `${owner.firstName} ${owner.lastName}` : '';
    }
    return '';
  };

  // ─── Reset on close ────────────────────────────────────────────────────

  const handleClose = () => {
    setActiveStep(0);
    setUrl('');
    setOwnerId(isHost() && !canChangeOwner && user?.id ? Number(user.id) : '');
    setPropertyId('');
    setAutoCreateInterventions(false);
    setPreview(null);
    setImportResult(null);
    setFormError(null);
    previewMutation.reset();
    importMutation.reset();
    onClose();
  };

  // ─── Step 1 → 2 : Preview ─────────────────────────────────────────────

  const handlePreview = async () => {
    if (!url.trim() || !propertyId) {
      setFormError('Veuillez renseigner l\'URL du calendrier et sélectionner une propriété.');
      return;
    }

    setFormError(null);
    previewMutation.reset();

    try {
      const response = await previewMutation.mutateAsync({
        url: url.trim(),
        propertyId: propertyId as number,
      });
      setPreview(response);
      setActiveStep(1);
    } catch {
      // Error is handled by previewMutation.error
    }
  };

  // ─── Step 2 → 3 : Import ──────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview || !propertyId) return;

    setFormError(null);
    importMutation.reset();

    try {
      const response = await importMutation.mutateAsync({
        url: url.trim(),
        propertyId: propertyId as number,
        sourceName,
        autoCreateInterventions,
      });
      setImportResult(response);
      setActiveStep(2);
      onImportSuccess?.();
    } catch {
      // Error is handled by importMutation.error
    }
  };

  // ─── Render Step 1: Configuration ──────────────────────────────────────

  const renderConfigStep = () => (
    <div className="flex flex-col gap-3.5">
      {!hasAccess && (
        <BuiAlert variant="warning" className="text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>L'import iCal est disponible avec les forfaits Confort et Premium.</AlertDescription>
        </BuiAlert>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-2 p-2 rounded-[11px] bg-[var(--accent-soft)] border border-[var(--field-line)]">
        <span className="inline-flex text-[var(--accent)] mt-0.5"><InfoIcon size={18} strokeWidth={1.75} /></span>
        <div>
          <p className="cn-text-body2 text-[0.8125rem] font-medium text-[var(--ink)]">
            Collez le lien iCal de votre calendrier externe pour importer vos réservations.
          </p>
          <span className="cn-text-caption text-[var(--muted)] text-[0.6875rem]">
            Airbnb : Annonce &rarr; Tarification et disponibilité &rarr; Exporter le calendrier
          </span>
        </div>
      </div>

      {/* URL du calendrier */}
      <Field>
        <FieldLabel htmlFor="ical-url">Lien iCal (.ics)</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <span className="inline-flex text-[var(--faint)]"><CalendarIcon size={18} strokeWidth={1.75} /></span>
          </InputGroupAddon>
          <InputGroupInput
            id="ical-url"
            placeholder="https://www.airbnb.fr/calendar/ical/12345.ics?s=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={!hasAccess}
          />
        </InputGroup>
        <FieldDescription>Copiez le lien iCal depuis votre plateforme de réservation</FieldDescription>
      </Field>

      {/* 2-column grid — champs principaux */}
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1fr] gap-3">
        {/* Proprietaire */}
        {canChangeOwner ? (
          <Field>
            <FieldLabel htmlFor="ical-owner">Propriétaire</FieldLabel>
            <NativeSelect
              id="ical-owner"
              className="w-full"
              value={ownerId}
              // Un select natif renvoie toujours une chaine : la conversion en
              // nombre est indispensable, les comparaisons en aval sont strictes.
              onChange={(e) => {
                setOwnerId(e.target.value === '' ? '' : Number(e.target.value));
                setPropertyId('');
              }}
              disabled={!hasAccess}
            >
              <NativeSelectOption value="">Sélectionner un propriétaire</NativeSelectOption>
              {owners.map((owner) => (
                <NativeSelectOption key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName} — {owner.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="ical-owner-readonly">Propriétaire</FieldLabel>
            <Input
              id="ical-owner-readonly"
              className="w-full"
              value={getOwnerDisplayName()}
              disabled
            />
          </Field>
        )}

        {/* Source (auto-detected from URL) */}
        <Field>
          <FieldLabel htmlFor="ical-source">Source</FieldLabel>
          <InputGroup>
            {detectedSource.logo && (
              <InputGroupAddon>
                <SourceLogoIcon logo={detectedSource.logo} label={detectedSource.label} size={22} />
              </InputGroupAddon>
            )}
            <InputGroupInput
              id="ical-source"
              className="font-semibold"
              value={detectedSource.label}
              disabled
            />
          </InputGroup>
          <FieldDescription>Détecté automatiquement depuis l'URL</FieldDescription>
        </Field>

        {/* Propriete */}
        <Field>
          <FieldLabel htmlFor="ical-property">Propriété</FieldLabel>
          <NativeSelect
            id="ical-property"
            className="w-full"
            required
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!hasAccess || (canChangeOwner && !ownerId)}
          >
            <NativeSelectOption value="">
              {filteredProperties.length === 0
                ? (canChangeOwner && !ownerId
                  ? 'Sélectionnez d\'abord un propriétaire'
                  : 'Aucune propriété disponible')
                : 'Sélectionner une propriété'}
            </NativeSelectOption>
            {filteredProperties.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} — {p.city}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {/* Menage automatique — ligne inline legere */}
      <div className="flex items-center gap-1.5 py-0.5 cursor-pointer" onClick={() => hasAccess && setAutoCreateInterventions(!autoCreateInterventions)}>
        <Tooltip
          title={!hasAccess ? 'Disponible avec le forfait Confort ou Premium' : ''}
          arrow
        >
          <span>
            <Switch
              checked={autoCreateInterventions}
              onChange={(e) => setAutoCreateInterventions(e.target.checked)}
              disabled={!hasAccess}
              size="small"
              disableRipple
              sx={SWITCH_SX}
            />
          </span>
        </Tooltip>
        <p className="cn-text-body2 text-[0.8125rem] font-medium text-[var(--ink)]">
          Ménage automatique
        </p>
        <span className="cn-text-caption text-[0.6875rem] text-[var(--muted)]">
          — Crée une demande de ménage le jour du checkout à l'heure de départ du voyageur
        </span>
      </div>

      {error && (
        <BuiAlert variant="destructive" className="text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => { setFormError(null); previewMutation.reset(); }}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
    </div>
  );

  // ─── Render Step 2: Preview ────────────────────────────────────────────

  const renderPreviewStep = () => {
    if (!preview) return null;

    const allEvents = preview.events;
    const totalCount = allEvents.length;
    const reservationCount = allEvents.filter((e) => e.type !== 'blocked').length;
    const blockedCount = allEvents.filter((e) => e.type === 'blocked').length;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h6 className="cn-text-subtitle2 text-[0.875rem] font-bold">
            {preview.propertyName}
          </h6>
          <StatusChip tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={`${reservationCount} réservation${reservationCount > 1 ? 's' : ''}`} icon={<EventIcon size={14} strokeWidth={1.75} />} className="h-[24px]" />
          {blockedCount > 0 && (
            <StatusChip tokens={{ color: 'var(--muted)', bg: 'var(--field-bg)' }} label={`${blockedCount} période${blockedCount > 1 ? 's' : ''} bloquée${blockedCount > 1 ? 's' : ''}`} className="h-[24px]" />
          )}
        </div>

        {totalCount === 0 && (
          <BuiAlert variant="info" className="text-[0.8125rem]">
            <Info />
            <AlertDescription>Aucune réservation ni période bloquée trouvée dans ce calendrier.</AlertDescription>
          </BuiAlert>
        )}

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            maxHeight: 320,
            borderRadius: '10px',
            '& .MuiTableCell-root': { fontSize: '0.8125rem', py: 1, px: 1.5 },
            '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em' },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Arrivée</TableCell>
                <TableCell>Départ</TableCell>
                <TableCell align="center">Nuits</TableCell>
                <TableCell>Guest / Détails</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allEvents.map((event: ICalEventPreview) => (
                <TableRow key={`${event.uid}-${event.dtStart}`} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>{formatDate(event.dtStart)}</TableCell>
                  <TableCell>{formatDate(event.dtEnd)}</TableCell>
                  <TableCell align="center">
                    <Badge variant="secondary" className="text-[0.6875rem] font-semibold h-[22px] min-w-[28px]">{event.nights || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    {event.type === 'blocked' ? (
                      <div className="flex items-center gap-1">
                        <StatusChip size="sm" tokens={{ color: 'var(--muted)', bg: 'var(--field-bg)' }} label="Bloqué" className="h-[20px]" />
                        <p className="cn-text-body2 text-[0.8125rem] text-[var(--muted)]">
                          Période bloquée
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="cn-text-body2 text-[0.8125rem] font-medium">
                          {event.guestName || event.summary || 'Réservation'}
                        </p>
                        {event.confirmationCode && (
                          <span className="cn-text-caption text-muted-foreground text-[0.6875rem]">
                            {event.confirmationCode}
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {autoCreateInterventions && totalCount > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-[11px] bg-[var(--accent-soft)] border border-[var(--field-line)]">
            <span className="inline-flex text-[var(--accent)] mt-0.5"><SyncIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 text-[0.8125rem] text-[var(--body)]">
              {totalCount} demande{totalCount > 1 ? 's' : ''} de service de ménage
              {totalCount > 1 ? ' seront' : ' sera'} automatiquement créée{totalCount > 1 ? 's' : ''} à l'heure de départ du voyageur, le jour du checkout.
            </p>
          </div>
        )}

        {error && (
          <BuiAlert variant="destructive" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => { setFormError(null); importMutation.reset(); }}>
                <X />
              </BuiButton>
            </AlertAction>
          </BuiAlert>
        )}
      </div>
    );
  };

  // ─── Render Step 3: Result ─────────────────────────────────────────────

  const renderResultStep = () => {
    if (!importResult) return null;

    const hasErrors = importResult.errors && importResult.errors.length > 0;

    return (
      <div className="flex flex-col gap-3.5 items-center py-4">
        {/* Success/Warning icon */}
        <div className={cn('w-[64px] h-[64px] rounded-[50%] flex items-center justify-center', hasErrors ? 'bg-[rgba(255,_152,_0,_0.08)]' : 'bg-[rgba(76,_175,_80,_0.08)]')}>
          {!hasErrors ? (
            <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircleIcon size={36} strokeWidth={1.75} /></span>
          ) : (
            <span className="inline-flex text-[var(--bui-warning-ink)]"><ErrorIcon size={36} strokeWidth={1.75} /></span>
          )}
        </div>

        <h6 className="cn-text-subtitle1 font-bold text-[1rem]">
          Import terminé
        </h6>

        <div className="flex gap-1.5 justify-center flex-wrap">
          <Badge variant="success" className="text-[0.6875rem] font-semibold h-[28px] [&>svg]:text-[14px]"><CheckCircleIcon size={14} strokeWidth={1.75} />{`${importResult.imported} importée${importResult.imported > 1 ? 's' : ''}`}</Badge>
          <Badge variant="outline" className="text-[0.6875rem] font-semibold h-[28px] border-[var(--line)] text-[var(--muted)]">{`${importResult.skipped} doublon${importResult.skipped > 1 ? 's' : ''} ignoré${importResult.skipped > 1 ? 's' : ''}`}</Badge>
          {!!importResult.daysBlocked && importResult.daysBlocked > 0 && (
            <Badge variant="outline" className="text-[0.6875rem] font-semibold h-[28px] border-[var(--line)] text-[var(--muted)]">{`${importResult.daysBlocked} jour${importResult.daysBlocked > 1 ? 's' : ''} bloqué${importResult.daysBlocked > 1 ? 's' : ''}`}</Badge>
          )}
          {hasErrors && (
            <Badge variant="destructive" className="text-[0.6875rem] font-semibold h-[28px] [&>svg]:text-[14px]"><ErrorIcon size={14} strokeWidth={1.75} />{`${importResult.errors.length} erreur${importResult.errors.length > 1 ? 's' : ''}`}</Badge>
          )}
        </div>

        {hasErrors && (
          <BuiAlert variant="warning" className="w-full text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription><p className="cn-text-body2 font-semibold mb-0.5 text-[0.8125rem]">
              Certains événements n'ont pas pu être importés :
            </p>{importResult.errors.map((err, i) => (
              <span className="cn-text-caption block text-muted-foreground text-[0.6875rem]" key={i}>
                &bull; {err}
              </span>
            ))}</AlertDescription>
          </BuiAlert>
        )}

        <div className="flex items-start gap-2 p-2 rounded-[11px] bg-[var(--accent-soft)] border border-[var(--field-line)] w-full">
          <span className="inline-flex text-[var(--accent)] mt-0.5"><SyncIcon size={18} strokeWidth={1.75} /></span>
          <p className="cn-text-body2 text-[0.8125rem] text-[var(--body)]">
            Votre calendrier sera automatiquement re-synchronisé toutes les 3 heures.
            Les doublons sont ignorés automatiquement.
          </p>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const totalPreviewEvents = preview?.events.length || 0;
  const previewReservations = preview?.events.filter((e) => e.type !== 'blocked').length || 0;
  const previewBlocked = preview?.events.filter((e) => e.type === 'blocked').length || 0;
  const importButtonLabel =
    previewBlocked === 0
      ? `Importer ${previewReservations} réservation${previewReservations > 1 ? 's' : ''}`
      : previewReservations === 0
        ? `Importer ${previewBlocked} blocage${previewBlocked > 1 ? 's' : ''}`
        : `Importer ${previewReservations} résa. + ${previewBlocked} blocage${previewBlocked > 1 ? 's' : ''}`;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '18px',
          backgroundColor: 'var(--card)',
          backgroundImage: 'none',
          color: 'var(--body)',
          boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        },
      }}
    >
      {/* ─── Title ──────────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 3,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center bg-[var(--accent-soft)]">
            <span className="inline-flex text-[var(--accent)]"><CalendarIcon size={18} strokeWidth={1.75} /></span>
          </div>
          <h6 className="cn-text-subtitle1 font-bold text-[0.9375rem] text-[var(--ink)]">
            Import Calendrier iCal
          </h6>
        </div>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'var(--muted)', '&:hover': { color: 'var(--err)', backgroundColor: 'var(--hover)' } }}>
          <CloseIcon size={18} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      {/* ─── Stepper ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-0.5">
        <StepIndicator steps={STEPS} activeStep={activeStep} />
      </div>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {activeStep === 0 && renderConfigStep()}
        {activeStep === 1 && renderPreviewStep()}
        {activeStep === 2 && renderResultStep()}
      </DialogContent>

      {/* ─── Actions ────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          gap: 1,
          justifyContent: 'flex-end',
          borderTop: '1px solid var(--line)',
          backgroundColor: 'var(--surface-2)',
        }}
      >
        {activeStep === 0 && (
          <>
            <BuiButton onClick={handleClose} variant="outline" size="sm">
              Annuler
            </BuiButton>
            <BuiButton
              onClick={handlePreview}
              variant="default"
              size="sm"
              disabled={loading || !hasAccess || !url.trim() || !propertyId}
            >
              {loading ? <Spinner className="size-4" /> : <ArrowForwardIcon size={16} strokeWidth={1.75} />}
              {loading ? 'Chargement...' : 'Prévisualiser'}
            </BuiButton>
          </>
        )}

        {activeStep === 1 && (
          <>
            <BuiButton
              onClick={() => { setActiveStep(0); setFormError(null); previewMutation.reset(); importMutation.reset(); }}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <ArrowBackIcon size={16} strokeWidth={1.75} />
              Retour
            </BuiButton>
            <BuiButton
              onClick={handleImport}
              variant="default"
              size="sm"
              disabled={loading || !preview || totalPreviewEvents === 0}
            >
              {loading ? <Spinner className="size-4" /> : <ImportIcon size={16} strokeWidth={1.75} />}
              {loading ? 'Import en cours...' : importButtonLabel}
            </BuiButton>
          </>
        )}

        {activeStep === 2 && (
          <BuiButton onClick={handleClose} variant="default" size="sm">
            Fermer
          </BuiButton>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ICalImportModal;
