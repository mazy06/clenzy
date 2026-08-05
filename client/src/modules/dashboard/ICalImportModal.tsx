import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertTitle, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Check, TriangleAlert, X, Info } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui';
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
    // Plaque blanche assumee : les logos de canaux sont dessines pour un fond
    // blanc, les poser sur la surface teintee du PMS les salit.
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-solid border-border bg-white"
      style={{ width: size, height: size, minWidth: size }}
    >
      <img src={logo} alt={label} width={imgSize} height={imgSize} style={{ objectFit: 'contain', borderRadius: '50%' }} />
    </div>
  );
};

const STEPS = ['Configuration', 'Aperçu', 'Résultat'];

// Les champs de ce formulaire sont passes aux primitives du kit : le libelle
// notche sur la bordure (pattern .rm-field) laisse place au libelle statique.

// ─── Step indicator component ────────────────────────────────────────────────

const StepIndicator: React.FC<{ steps: string[]; activeStep: number }> = ({ steps, activeStep }) => (
  <div className="flex items-center justify-center gap-0 py-2">
    {steps.map((label, idx) => {
      const isActive = idx === activeStep;
      const isDone = idx < activeStep;
      return (
        <React.Fragment key={label}>
          {idx > 0 && (
            <div className={cn('mx-[3px] h-[2px] w-[48px] rounded-md transition-colors duration-300', isDone ? 'bg-primary' : 'bg-border')} />
          )}
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-all duration-300',
                isActive && 'bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--bui-primary-soft)]',
                isDone && 'bg-primary text-primary-foreground',
                !isActive && !isDone && 'border-[1.5px] border-solid border-field-line bg-field text-muted-foreground',
              )}
            >
              {/* Une coche dessinee, pas le caractere « ✓ » : la police le rend
                  differemment d'une plateforme a l'autre et il ne s'aligne pas. */}
              {isDone ? <Check className="size-3.5" strokeWidth={2.5} /> : idx + 1}
            </div>
            <span className={cn('text-2xs tracking-wide', isActive ? 'font-bold' : 'font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
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
        <BuiAlert variant="warning">
          <TriangleAlert />
          <AlertDescription>L'import iCal est disponible avec les forfaits Confort et Premium.</AlertDescription>
        </BuiAlert>
      )}

      {/* Info banner — primitive Alert du kit plutot qu'un encart dessine a la main */}
      <BuiAlert variant="info">
        <InfoIcon strokeWidth={1.75} />
        <AlertTitle>Collez le lien iCal de votre calendrier externe pour importer vos réservations.</AlertTitle>
        <AlertDescription>
          Airbnb : Annonce &rarr; Tarification et disponibilité &rarr; Exporter le calendrier
        </AlertDescription>
      </BuiAlert>

      {/* URL du calendrier */}
      <Field>
        <FieldLabel htmlFor="ical-url">Lien iCal (.ics)</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <span className="inline-flex text-faint"><CalendarIcon size={18} strokeWidth={1.75} /></span>
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
        {/* Le tooltip n'existait que pour expliquer l'indisponibilite : sans le
            libelle vide de MUI, on ne monte le tooltip que dans ce cas. */}
        {hasAccess ? (
          <Switch
            checked={autoCreateInterventions}
            onCheckedChange={(checked) => setAutoCreateInterventions(checked)}
            size="sm"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Switch checked={autoCreateInterventions} disabled size="sm" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Disponible avec le forfait Confort ou Premium</TooltipContent>
          </Tooltip>
        )}
        <p className="text-sm font-medium text-foreground">
          Ménage automatique
        </p>
        <span className="text-xs text-muted-foreground">
          — Crée une demande de ménage le jour du checkout à l'heure de départ du voyageur
        </span>
      </div>

      {error && (
        <BuiAlert variant="destructive">
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
        <div className="flex flex-wrap items-center gap-1.5">
          <h6 className="text-sm font-semibold tracking-tight">
            {preview.propertyName}
          </h6>
          <StatusChip tokens={{ color: 'var(--bui-primary)', bg: 'var(--bui-primary-soft)' }} label={`${reservationCount} réservation${reservationCount > 1 ? 's' : ''}`} icon={<EventIcon size={14} strokeWidth={1.75} />} className="h-6" />
          {blockedCount > 0 && (
            <StatusChip tokens={{ color: 'var(--bui-muted-foreground)', bg: 'var(--bui-field)' }} label={`${blockedCount} période${blockedCount > 1 ? 's' : ''} bloquée${blockedCount > 1 ? 's' : ''}`} className="h-6" />
          )}
        </div>

        {totalCount === 0 && (
          <BuiAlert variant="info">
            <Info />
            <AlertDescription>Aucune réservation ni période bloquée trouvée dans ce calendrier.</AlertDescription>
          </BuiAlert>
        )}

        {/* stickyHeader : c'est le conteneur INTERNE du primitif Table qui est le
            bloc de defilement (il porte deja overflow-x). La hauteur bornee et le
            defilement vertical doivent donc lui etre poses, sinon les en-tetes
            `sticky` n'ont aucun ancetre scrollable et ne se figent jamais. */}
        <div className="overflow-hidden rounded-lg border border-solid border-border bg-card [&_[data-slot=table-container]]:max-h-[320px] [&_[data-slot=table-container]]:overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Fond opaque obligatoire : sans lui les lignes defilent par transparence. */}
                <TableHead className="sticky top-0 z-10 bg-card">Arrivée</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">Départ</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card text-center">Nuits</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">Guest / Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEvents.map((event: ICalEventPreview) => (
                <TableRow key={`${event.uid}-${event.dtStart}`}>
                  <TableCell>{formatDate(event.dtStart)}</TableCell>
                  <TableCell>{formatDate(event.dtEnd)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="h-[22px] min-w-[28px] text-2xs font-semibold tabular-nums">{event.nights || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    {event.type === 'blocked' ? (
                      <div className="flex items-center gap-1">
                        <StatusChip size="sm" tokens={{ color: 'var(--bui-muted-foreground)', bg: 'var(--bui-field)' }} label="Bloqué" className="h-5" />
                        <p className="text-sm text-muted-foreground">
                          Période bloquée
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          {event.guestName || event.summary || 'Réservation'}
                        </p>
                        {event.confirmationCode && (
                          <span className="text-xs text-muted-foreground">
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
        </div>

        {autoCreateInterventions && totalCount > 0 && (
          <BuiAlert variant="info">
            <SyncIcon strokeWidth={1.75} />
            <AlertDescription>
              {totalCount} demande{totalCount > 1 ? 's' : ''} de service de ménage
              {totalCount > 1 ? ' seront' : ' sera'} automatiquement créée{totalCount > 1 ? 's' : ''} à l'heure de départ du voyageur, le jour du checkout.
            </AlertDescription>
          </BuiAlert>
        )}

        {error && (
          <BuiAlert variant="destructive">
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
        {/* Success/Warning icon — fond pastel du registre, encre du meme registre. */}
        <div className={cn('flex size-16 items-center justify-center rounded-full', hasErrors ? 'bg-warning-soft text-warning-ink' : 'bg-success-soft text-success-ink')}>
          {!hasErrors ? (
            <CheckCircleIcon size={36} strokeWidth={1.75} />
          ) : (
            <ErrorIcon size={36} strokeWidth={1.75} />
          )}
        </div>

        <h6 className="text-base font-semibold tracking-tight">
          Import terminé
        </h6>

        <div className="flex flex-wrap justify-center gap-1.5">
          <Badge variant="success" className="h-7 text-2xs font-semibold tabular-nums"><CheckCircleIcon size={14} strokeWidth={1.75} />{`${importResult.imported} importée${importResult.imported > 1 ? 's' : ''}`}</Badge>
          <Badge variant="outline" className="h-7 text-2xs font-semibold tabular-nums text-muted-foreground">{`${importResult.skipped} doublon${importResult.skipped > 1 ? 's' : ''} ignoré${importResult.skipped > 1 ? 's' : ''}`}</Badge>
          {!!importResult.daysBlocked && importResult.daysBlocked > 0 && (
            <Badge variant="outline" className="h-7 text-2xs font-semibold tabular-nums text-muted-foreground">{`${importResult.daysBlocked} jour${importResult.daysBlocked > 1 ? 's' : ''} bloqué${importResult.daysBlocked > 1 ? 's' : ''}`}</Badge>
          )}
          {hasErrors && (
            <Badge variant="destructive" className="h-7 text-2xs font-semibold tabular-nums"><ErrorIcon size={14} strokeWidth={1.75} />{`${importResult.errors.length} erreur${importResult.errors.length > 1 ? 's' : ''}`}</Badge>
          )}
        </div>

        {hasErrors && (
          <BuiAlert variant="warning" className="w-full">
            <TriangleAlert />
            <AlertTitle>Certains événements n'ont pas pu être importés :</AlertTitle>
            <AlertDescription>{importResult.errors.map((err, i) => (
              <span className="block text-xs" key={i}>
                &bull; {err}
              </span>
            ))}</AlertDescription>
          </BuiAlert>
        )}

        <BuiAlert variant="info" className="w-full">
          <SyncIcon strokeWidth={1.75} />
          <AlertDescription>
            Votre calendrier sera automatiquement re-synchronisé toutes les 3 heures.
            Les doublons sont ignorés automatiquement.
          </AlertDescription>
        </BuiAlert>
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="sm:max-w-[600px] overflow-hidden"
      >
        {/* En-tete pleine largeur : les marges negatives annulent le padding de
            la coque, comme le pied du kit le fait deja. */}
        <DialogHeader className="-mx-4 -mt-4 flex-row items-center justify-between border-b border-solid border-border px-4 py-2">
          <DialogTitle className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <CalendarIcon size={18} strokeWidth={1.75} />
            </span>
            Import Calendrier iCal
          </DialogTitle>
          <BuiButton
            variant="ghost"
            size="icon-sm"
            aria-label="Fermer"
            onClick={handleClose}
            className="text-muted-foreground hover:bg-muted hover:text-destructive-ink"
          >
            <CloseIcon size={18} strokeWidth={1.75} />
          </BuiButton>
        </DialogHeader>

        <StepIndicator steps={STEPS} activeStep={activeStep} />

        {/* Hauteur bornee + defilement : le Dialog MUI faisait defiler son corps. */}
        <div className="max-h-[60vh] overflow-y-auto">
          {activeStep === 0 && renderConfigStep()}
          {activeStep === 1 && renderPreviewStep()}
          {activeStep === 2 && renderResultStep()}
        </div>

        <DialogFooter className="gap-1.5">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ICalImportModal;
