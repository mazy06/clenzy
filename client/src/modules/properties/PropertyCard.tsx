import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { useNavigate } from 'react-router-dom';
import {
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Home,
  Apartment,
  Villa,
  Hotel,
  Business,
  Person as PersonIcon,
  Bed as BedIcon,
  Bathroom as BathroomIcon,
  BroomFill,
  SquareFoot,
  Build,
  Logout,
  CheckCircle,
} from '../../icons';
import { Button } from '../../components/ui';
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';
import {
  getPropertyStatusLabel,
  getPropertyStatusHex,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
} from '../../utils/statusUtils';
import { FIELD_TOKENS, FIELD_CHIP_CLASS, propertyGradientCss } from './propertiesListConstants';
import { Money } from '../../components/Money';
import type { PropertyKpiSummary } from '../../services/api/propertyKpiApi';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';

// Interface pour les propriétés détaillées
export interface PropertyDetails {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  propertyType: string;
  status: string;
  nightlyPrice: number;
  bedrooms: number;
  bathrooms: number;
  surfaceArea: number;
  description: string;
  amenities: string[];
  cleaningFrequency: string;
  maxGuests: number;
  contactPhone: string;
  contactEmail: string;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  cleaningBasePrice?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

interface PropertyCardProps {
  property: PropertyDetails;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  /**
   * Mapping Channex de cette propriete (si elle est connectee au Channel Manager).
   * Quand fourni, un petit badge de sante est affiche pres du nom (Quick Win #4).
   * Pour les roles non-SUPER_*, ce sera toujours undefined → aucun badge.
   */
  channexMapping?: import('../../services/api/channexApi').ChannexMappingDto | null;
  /** Callback declenche quand l'utilisateur clique sur le badge Channex. */
  onChannexBadgeClick?: () => void;
  /** Vrai si la propriété n'a pas de contrat de gestion vivant (gate de rattrapage). */
  missingContract?: boolean;
  /** Callback déclenché au clic sur le badge « Contrat manquant ». */
  onMissingContractClick?: () => void;
  /**
   * KPI opérationnels (occupation / ADR / revenu / statut / interventions) du
   * mois courant. `undefined` tant que non chargé → la carte affiche un état
   * neutre (placeholders « — »).
   */
  kpi?: PropertyKpiSummary;
  /**
   * Coût de ménage estimé (vrai estimateur d'intervention backend, fourni par la liste).
   * `undefined` → section prix masquée (aucune formule frontend divergente).
   */
  cleaningEstimate?: number;
}

// Carte logement — référence maquette .pr-card (screen-properties), peinte en Baitly UI.
// `--card-spacing: 0px` neutralise le rembourrage vertical du primitif Card : la
// carte logement colle son bandeau image au bord.
// `ring-foreground/20` et non une bande latérale : le primitif Card porte déjà
// un `ring-1 ring-foreground/10`, on ne fait que le renforcer au survol.
const CARD_ROOT_CLASS =
  'h-full cursor-pointer [--card-spacing:0px] '
  + '[transition:box-shadow_.14s,transform_.14s] '
  + 'hover:-translate-y-[2px] hover:shadow-sm hover:ring-foreground/20 '
  + 'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

// Typographie de la carte et du dialogue, transcrite en classes.
// `font-[family-name:var(...)]` et non `font-[var(...)]` : sur une valeur `var()`,
// Tailwind ne peut pas trancher entre famille et graisse et emettrait un
// `font-weight` invalide, silencieusement ignore par le navigateur.
// `my-0` / `mt-0` sont indispensables sur les <p>/<h6> natifs : le projet
// n'active pas le preflight complet (coexistence historique MUI), les marges
// du navigateur reviendraient sinon.

/** .pr-nm — nom d'entité en display. */
const NAME_CLASS =
  'mt-0 mb-[3px] min-w-0 flex-1 truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-.01em] text-foreground';
const ADDRESS_CLASS = 'flex-1 truncate text-xs text-muted-foreground';
/** .pr-stats — bande de stats hairline (valeurs display tabular-nums) */
const STAT_VALUE_CLASS =
  'my-0 font-[family-name:var(--font-display)] text-[15px] font-semibold leading-[1.2] text-foreground tabular-nums';
const STAT_LABEL_CLASS =
  'mb-0 mt-px text-2xs font-semibold uppercase tracking-wide text-faint';
// ── Dialog ── (surfaces internes en tokens Baitly UI)
const DIALOG_SECTION_TITLE_CLASS =
  'mt-0 mb-[4.5px] text-2xs font-semibold uppercase tracking-wide text-faint';
const DIALOG_DESCRIPTION_CLASS =
  'my-0 line-clamp-4 text-xs leading-[1.4] text-muted-foreground';

// ─── Duration estimation (lightweight version for cards) ─────────────────────

export function estimateCleaningDuration(p: PropertyDetails): number | null {
  const bedrooms = p.bedrooms ?? 1;
  const bathrooms = p.bathrooms ?? 1;
  const sqm = p.surfaceArea ?? 0;

  if (sqm <= 0 && bedrooms <= 0) return null;

  // Base from bedroom count (type T)
  let mins: number;
  if (bedrooms <= 1)       mins = 90;
  else if (bedrooms === 2) mins = 120;
  else if (bedrooms === 3) mins = 150;
  else if (bedrooms === 4) mins = 180;
  else                      mins = 210;

  // Extra bathrooms (+15 min each above 1)
  if (bathrooms > 1) mins += (bathrooms - 1) * 15;

  // Surface surcharge (>80m² → +1 min per 5m²)
  if (sqm > 80) mins += Math.floor((sqm - 80) / 5);

  // Extra floors (+15 min each above 1)
  if ((p.numberOfFloors ?? 0) > 1) mins += ((p.numberOfFloors ?? 1) - 1) * 15;

  // Boolean add-ons
  if (p.hasLaundry) mins += 10;
  if (p.hasExterior) mins += 25;

  return mins;
}

export function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Libellé de check-out relatif (aujourd'hui / demain / date courte) ───────

function relativeCheckoutLabel(
  iso: string,
  time: string | null,
  t: (key: string) => string,
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const when = diffDays <= 0
    ? t('properties.ops.today')
    : diffDays === 1
      ? t('properties.ops.tomorrow')
      : target.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return time ? `${when} ${time}` : when;
}

const fmtEuro = (v: number) => <Money value={v} from="EUR" decimals={0} />;

// Obtenir l'icône du type de propriété
const getPropertyTypeIcon = (type: string, size: number = 48) => {
  const iconProps = { size, color: 'var(--bui-primary)', strokeWidth: 1.75 };
  switch (type.toLowerCase()) {
    case 'appartement':
    case 'apartment':
      return <Apartment {...iconProps} />;
    case 'maison':
    case 'house':
      return <Home {...iconProps} />;
    case 'villa':
      return <Villa {...iconProps} />;
    case 'studio':
      return <Hotel {...iconProps} />;
    default:
      return <Home {...iconProps} />;
  }
};

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ property, onEdit, onDelete, onView, channexMapping, onChannexBadgeClick, missingContract, onMissingContractClick, kpi, cleaningEstimate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Permissions : check SYNCHRONE sur user.permissions (déjà en mémoire, même
  // source que ProtectedRoute). L'ancien hasPermissionAsync par carte déclenchait
  // jusqu'à 2 POST /permissions/sync PAR CARTE sur la liste des logements.
  const canEdit = useMemo(
    () => user?.permissions?.includes('properties:edit') ?? false,
    [user],
  );
  const canDelete = useMemo(
    () => user?.permissions?.includes('properties:delete') ?? false,
    [user],
  );

  // Coût de ménage : vrai estimateur backend, fourni par la liste (undefined → masqué).
  const cleaningPrice = cleaningEstimate;

  // ── KPI opérationnels du mois courant (.pr-stats) ─────────────────────────
  const kpiCells = [
    { value: kpi ? `${Math.round(kpi.occupancyRate * 100)}%` : '—', label: t('properties.kpi.occupancy') },
    { value: kpi && kpi.adr > 0 ? fmtEuro(kpi.adr) : '—', label: t('properties.kpi.adr') },
    { value: kpi && kpi.revenue > 0 ? fmtEuro(kpi.revenue) : '—', label: t('properties.kpi.revenue') },
  ];

  // Pastille de statut (top-left) : config (maintenance/inactif) prioritaire,
  // sinon statut opérationnel dérivé des KPI (occupé / disponible).
  const statusLc = (property.status || '').toLowerCase();
  const pill = (statusLc.includes('maintenance') || statusLc.includes('inacti'))
    ? { label: getPropertyStatusLabel(property.status, t), color: getPropertyStatusHex(property.status) }
    : kpi?.operationalStatus === 'occupied'
      ? { label: t('properties.ops.occupied'), color: 'var(--bui-success)' }
      : kpi?.operationalStatus === 'available'
        ? { label: t('properties.ops.available'), color: 'var(--bui-info)' }
        : { label: getPropertyStatusLabel(property.status, t), color: getPropertyStatusHex(property.status) };

  // Pied opérationnel : intervention en cours > check-out (si occupé) > disponible.
  // `color` habille une ICÔNE (teinte vive), jamais le texte — cf. la règle
  // `-ink` de Baitly UI.
  const ops = kpi?.activeInterventionType === 'cleaning'
    ? { icon: <BroomFill size={13} />, color: 'var(--bui-primary)', strong: t('properties.ops.cleaning'), rest: t('properties.ops.inProgress') }
    : kpi?.activeInterventionType === 'maintenance'
      ? { icon: <Build size={13} strokeWidth={2} />, color: 'var(--bui-warning)', strong: t('properties.ops.maintenance'), rest: t('properties.ops.inProgress') }
      : (kpi?.operationalStatus === 'occupied' && kpi.currentCheckOut)
        ? { icon: <Logout size={13} strokeWidth={2} />, color: 'var(--bui-primary)', strong: t('properties.ops.checkout'),
            rest: `· ${relativeCheckoutLabel(kpi.currentCheckOut, kpi.currentCheckOutTime ?? property.defaultCheckOutTime ?? null, t)}` }
        : kpi?.operationalStatus === 'available'
          ? { icon: <CheckCircle size={13} strokeWidth={2} />, color: 'var(--bui-success)', strong: t('properties.ops.available'), rest: '' }
          : null;

  const handleViewDetails = () => {
    if (onView) {
      onView();
    } else {
      setDetailsOpen(true);
    }
  };

  return (
    <>
      {/* Carte principale — Design moderne */}
      <Card className={CARD_ROOT_CLASS} onClick={handleViewDetails}>
        {/* ─── .pr-img : bandeau dégradé déterministe + photo réelle en overlay ─── */}
        {/* Dégradé déterministe (placeholder) en base ; la vraie photo se superpose
            dessus en fallback. Tout le fond reste inline : la shorthand `background`
            reinitialiserait background-size/position poses par des classes. */}
        <div
          className="relative h-[118px] flex items-center justify-center overflow-hidden"
          style={{
            background: `${propertyGradientCss(property.id || property.name)}`,
            backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.32)), url(${getPropertyTypeBannerUrl(property.propertyType)}), ${propertyGradientCss(property.id || property.name)}`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Icône immeuble centrée — encre blanche assumée : elle est posée sur
              une photo, aucune couleur de surface ne conviendrait. */}
          <div className="relative z-[1] inline-flex text-white/70">
            <Business size={30} strokeWidth={1.75} />
          </div>

          {/* .pr-status — pastille statut opérationnel (dot coloré + libellé) */}
          <div className="absolute top-[10px] start-[10px] z-[2] inline-flex items-center gap-[3.75px] rounded-full bg-card/90 px-[9px] py-[4px] text-2xs font-semibold leading-none text-foreground backdrop-blur-[4px]">
            <span aria-hidden className="size-[6px] shrink-0 rounded-full" style={{ backgroundColor: pill.color }} />
            {pill.label}
          </div>

          {/* .pr-ch — slot canal/santé (badge santé Channex + contrat) */}
          {(channexMapping || missingContract) && (
            <div className="absolute top-[10px] end-[10px] z-[2] flex items-center gap-[3px]">
              {channexMapping && (
                <ChannexHealthBadge
                  mapping={channexMapping}
                  size={10}
                  variant="dot"
                  onClick={onChannexBadgeClick}
                />
              )}
              {missingContract && (
                <MissingContractChip
                  onClick={(e) => { e.stopPropagation(); onMissingContractClick?.(); }}
                />
              )}
            </div>
          )}
        </div>

        {/* ─── Zone info ─── */}
        <CardContent className="flex-1 p-[10.5px] pb-3">
          {/* Nom + prix/nuit (si renseigné) */}
          <div className="flex items-center gap-1 min-w-0">
            <h6 className={NAME_CLASS} title={property.name}>
              {property.name}
            </h6>
            {property.nightlyPrice > 0 && (
              <StatusChip
                tokens={{ color: 'var(--bui-foreground)', bg: 'var(--bui-card)' }}
                label={<><Money value={property.nightlyPrice} from="EUR" decimals={0} />/nuit</>}
                className="shrink-0 border border-solid border-border tabular-nums"
              />
            )}
          </div>

          {/* Adresse */}
          <div className="flex items-center gap-0.5 mb-2">
            <span className="inline-flex text-muted-foreground shrink-0"><LocationOn size={14} strokeWidth={1.75} /></span>
            <span
              className={ADDRESS_CLASS}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </span>
          </div>

          {/* Bande de KPI opérationnels (.pr-stats) — occupation / ADR / revenu */}
          <div className="mb-[7.5px] flex border-y border-solid border-border">
            {kpiCells.map((metric) => (
              <div key={metric.label} className="min-w-0 flex-1 border-e border-solid border-border py-[9px] text-center last:border-e-0">
                <p className={STAT_VALUE_CLASS}>{metric.value}</p>
                <p className={STAT_LABEL_CLASS}>{metric.label}</p>
              </div>
            ))}
          </div>

          {/* .pr-foot — pied opérationnel : statut dynamique du logement
              (intervention en cours > check-out si occupé > disponible) */}
          <div className="flex min-h-[18px] min-w-0 items-center gap-[5.25px] text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            {ops && (
              <>
                <span className="inline-flex shrink-0" style={{ color: ops.color }}>{ops.icon}</span>
                <span className="font-semibold text-foreground">{ops.strong}</span>
                {ops.rest && (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap tabular-nums">
                    {ops.rest}
                  </span>
                )}
              </>
            )}
          </div>
        </CardContent>

        {/* ─── Zone actions ─── */}
        <div className="px-[10.5px] pb-[7.5px] pt-0 flex gap-[4.5px]">
          <Button
            className="w-full shrink"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
            variant="outline"
          >
            <Visibility size={15} strokeWidth={1.75} />
            Détails
          </Button>
          {canEdit && onEdit && (
            <Button
              className="w-full shrink"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Edit size={15} strokeWidth={1.75} />
              Modifier
            </Button>
          )}
        </div>
      </Card>

      {/* ─── Dialog des détails complets ─── */}
      <Dialog open={detailsOpen} onOpenChange={(next) => { if (!next) setDetailsOpen(false); }}>
        {/* La carte parente est cliquable : on arrete la propagation ICI, la modale
            etant portalisee, un clic dedans ne doit pas rouvrir le detail. */}
        <DialogContent
          className="max-w-[900px] max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2 pe-8">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                {getPropertyTypeIcon(property.propertyType, 22)}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-[1.2]">
                  {property.name}
                </DialogTitle>
                <span className="text-xs text-muted-foreground">
                  {getPropertyTypeLabel(property.propertyType, t)} • {getPropertyStatusLabel(property.status, t)}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-12 gap-3">
            {/* Adresse */}
            <div className="col-span-12">
              <p className={DIALOG_SECTION_TITLE_CLASS}>
                Adresse
              </p>
              <p className="my-0 text-xs">
                {property.address}, {property.postalCode} {property.city}, {property.country}
              </p>
            </div>

            <div className="col-span-12">
              <Separator />
            </div>

            {/* Caractéristiques */}
            <div className="col-span-12">
              <p className={cn(DIALOG_SECTION_TITLE_CLASS, 'mb-[6px]')}>
                Caractéristiques
              </p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { icon: <BedIcon size={18} strokeWidth={1.75} />, value: property.bedrooms, label: 'Chambres' },
                  { icon: <BathroomIcon size={18} strokeWidth={1.75} />, value: property.bathrooms, label: 'Salles de bain' },
                  { icon: <SquareFoot size={18} strokeWidth={1.75} />, value: `${property.surfaceArea} m²`, label: 'Surface' },
                  { icon: <PersonIcon size={18} strokeWidth={1.75} />, value: property.maxGuests, label: 'Voyageurs max' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex min-w-[120px] items-center gap-[6px] rounded-lg border border-solid border-field-line bg-field px-[9px] py-[6px]"
                  >
                    <div className="flex text-primary">{item.icon}</div>
                    <div>
                      <p className="my-0 font-[family-name:var(--font-display)] text-[15px] font-semibold text-foreground tabular-nums">{item.value}</p>
                      <p className="my-0 text-2xs font-semibold uppercase tracking-wide text-faint">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12">
              <Separator />
            </div>

            {/* Estimation ménage + prix nuit */}
            <div className="col-span-12 min-[900px]:col-span-6">
              <p className={DIALOG_SECTION_TITLE_CLASS}>
                {t('properties.cleaningEstimate')}
              </p>
              {cleaningPrice != null ? (
                <p className="my-0 font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-.01em] text-foreground tabular-nums">
                  <Money value={cleaningPrice} from="EUR" decimals={0} /> <span className="text-xs text-muted-foreground">{t('properties.priceEstimation.perIntervention')}</span>
                </p>
              ) : (
                <p className="my-0 text-xs text-muted-foreground">—</p>
              )}
              {property.nightlyPrice > 0 && (
                <p className="mb-0 mt-0.5 text-xs text-muted-foreground">
                  <Money value={property.nightlyPrice} from="EUR" decimals={0} /> / {t('properties.perNight')}
                </p>
              )}
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <p className={DIALOG_SECTION_TITLE_CLASS}>
                Nettoyage
              </p>
              <div className="flex items-center gap-1">
                <span className="inline-flex text-muted-foreground"><BroomFill size={18} /></span>
                <p className="my-0 text-xs">{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</p>
              </div>
            </div>

            {/* Commodités */}
            {property.amenities && property.amenities.length > 0 && (
              <>
                <div className="col-span-12">
                  <Separator />
                </div>
                <div className="col-span-12">
                  <p className={cn(DIALOG_SECTION_TITLE_CLASS, 'mb-[6px]')}>
                    Commodités
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {property.amenities.map((amenity) => (
                      <StatusChip
                        key={amenity}
                        tokens={FIELD_TOKENS}
                        label={t(`properties.amenities.items.${amenity}`)}
                        className={FIELD_CHIP_CLASS}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Contact */}
            <div className="col-span-12">
              <Separator />
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <p className={DIALOG_SECTION_TITLE_CLASS}>
                Contact
              </p>
              <p className="mt-0 mb-0.5 text-xs">
                {property.contactPhone || 'Téléphone non renseigné'}
              </p>
              <p className="my-0 text-xs text-muted-foreground">
                {property.contactEmail || 'Email non renseigné'}
              </p>
            </div>

            {/* Description */}
            {property.description && (
              <div className="col-span-12 min-[900px]:col-span-6">
                <p className={DIALOG_SECTION_TITLE_CLASS}>
                  Description
                </p>
                <p className={DIALOG_DESCRIPTION_CLASS}>
                  {property.description}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {/* `me-auto` remplace l'ancien ressort `flex-1` : DialogFooter empile en
                colonne inversee sous 640px, ou un div vide creerait une ligne morte. */}
            {canDelete && onDelete && (
              <Button onClick={onDelete} variant="destructive" size="sm" className="sm:me-auto">
                <Delete size={16} strokeWidth={1.75} />
                Supprimer
              </Button>
            )}
            <Button onClick={() => setDetailsOpen(false)} size="sm" variant="outline">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

PropertyCard.displayName = 'PropertyCard';

export default PropertyCard;
