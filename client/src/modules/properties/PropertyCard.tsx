import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
} from '@mui/material';
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
  Close,
  SquareFoot,
  Build,
  Logout,
  CheckCircle,
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
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

// Styles alignés sur DESIGN_BASELINE + référence maquette .pr-card (screen-properties).
const styles = {
  // ── Card ── (.pr-card : hairline r14 du thème, hover border --line-2 + shadow-card)
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color .14s, box-shadow .14s, transform .14s',
    '&:hover': {
      borderColor: 'var(--line-2)',
      boxShadow: 'var(--shadow-card)',
      transform: 'translateY(-2px)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': { transform: 'none' },
    },
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '12px !important',
  },
  // .pr-nm — nom d'entité en display
  nameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '-.01em',
    mb: 0.5,
    color: 'var(--ink)',
  },
  addressText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '11.5px',
    color: 'var(--muted)',
  },
  // .pr-stats — bande de stats hairline (valeurs display tabular-nums)
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--ink)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    color: 'var(--faint)',
    mt: '1px',
  },
  // ── Dialog ── (skin global MuiDialog ; surfaces internes en tokens)
  dialogSectionTitle: {
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: 'var(--faint)',
    mb: 0.75,
  },
  dialogDescription: {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  },
} as const;

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
  const iconProps = { size, color: 'var(--accent)', strokeWidth: 1.75 };
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
      ? { label: t('properties.ops.occupied'), color: 'var(--ok)' }
      : kpi?.operationalStatus === 'available'
        ? { label: t('properties.ops.available'), color: 'var(--info)' }
        : { label: getPropertyStatusLabel(property.status, t), color: getPropertyStatusHex(property.status) };

  // Pied opérationnel : intervention en cours > check-out (si occupé) > disponible.
  const ops = kpi?.activeInterventionType === 'cleaning'
    ? { icon: <BroomFill size={13} />, color: 'var(--accent)', strong: t('properties.ops.cleaning'), rest: t('properties.ops.inProgress') }
    : kpi?.activeInterventionType === 'maintenance'
      ? { icon: <Build size={13} strokeWidth={2} />, color: 'var(--warn)', strong: t('properties.ops.maintenance'), rest: t('properties.ops.inProgress') }
      : (kpi?.operationalStatus === 'occupied' && kpi.currentCheckOut)
        ? { icon: <Logout size={13} strokeWidth={2} />, color: 'var(--accent)', strong: t('properties.ops.checkout'),
            rest: `· ${relativeCheckoutLabel(kpi.currentCheckOut, kpi.currentCheckOutTime ?? property.defaultCheckOutTime ?? null, t)}` }
        : kpi?.operationalStatus === 'available'
          ? { icon: <CheckCircle size={13} strokeWidth={2} />, color: 'var(--ok)', strong: t('properties.ops.available'), rest: '' }
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
      <Card
        sx={styles.cardRoot}
        onClick={handleViewDetails}
      >
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
          {/* Icône immeuble centrée (blanc .7) */}
          <div className="relative z-[1] inline-flex text-[rgba(255,255,255,.7)]">
            <Business size={30} strokeWidth={1.75} />
          </div>

          {/* .pr-status — pastille statut opérationnel top-left (dot coloré + libellé) */}
          <div className="absolute top-[10px] left-[10px] z-[2] inline-flex items-center gap-[3.75px] text-[10.5px] font-bold px-[9px] py-[4px] rounded-[20px] bg-[rgba(255,255,255,.92)] backdrop-blur-[4px] text-[#2A3942] leading-none">
            <div className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ backgroundColor: pill.color }} />
            {pill.label}
          </div>

          {/* .pr-ch — slot canal/santé top-right (badge santé Channex + contrat) */}
          {(channexMapping || missingContract) && (
            <div className="absolute top-[10px] right-[10px] z-[2] flex items-center gap-[3px]">
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
        <CardContent sx={styles.infoContent}>
          {/* Nom + prix/nuit (si renseigné) */}
          <div className="flex items-center gap-1 min-w-0">
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ ...styles.nameText, minWidth: 0, flex: 1 }}
              title={property.name}
            >
              {property.name}
            </Typography>
            {property.nightlyPrice > 0 && (
              <StatusChip
                tokens={{ color: 'var(--body)', bg: 'var(--card)' }}
                label={<><Money value={property.nightlyPrice} from="EUR" decimals={0} />/nuit</>}
                className="shrink-0 border border-solid border-[var(--line-2)] tabular-nums"
              />
            )}
          </div>

          {/* Adresse */}
          <div className="flex items-center gap-0.5 mb-2">
            <span className="inline-flex text-muted-foreground shrink-0"><LocationOn size={14} strokeWidth={1.75} /></span>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={styles.addressText}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </Typography>
          </div>

          {/* Bande de KPI opérationnels (.pr-stats) — occupation / ADR / revenu */}
          <div className="flex border-t border-b border-solid border-[var(--line)] mb-[7.5px]">
            {kpiCells.map((metric) => (
              <div key={metric.label} className="flex-1 py-[9px] text-center border-r border-solid border-[var(--line)] min-w-0 last:border-r-0">
                <Typography sx={styles.statValue}>{metric.value}</Typography>
                <Typography sx={styles.statLabel}>{metric.label}</Typography>
              </div>
            ))}
          </div>

          {/* .pr-foot — pied opérationnel : statut dynamique du logement
              (intervention en cours > check-out si occupé > disponible) */}
          <div className="flex items-center gap-[5.25px] text-[11.5px] text-[var(--muted)] min-w-0 min-h-[18px]" onClick={(e) => e.stopPropagation()}>
            {ops && (
              <>
                <span className="inline-flex shrink-0" style={{ color: ops.color }}>{ops.icon}</span>
                <span className="text-[var(--body)] font-semibold">{ops.strong}</span>
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
            fullWidth
            size="small"
            startIcon={<Visibility size={15} strokeWidth={1.75} />}
            onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
            variant="outlined"
          >
            Détails
          </Button>
          {canEdit && onEdit && (
            <Button
              fullWidth
              size="small"
              startIcon={<Edit size={15} strokeWidth={1.75} />}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              variant="contained"
            >
              Modifier
            </Button>
          )}
        </div>
      </Card>

      {/* ─── Dialog des détails complets ─── */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-[11px] flex items-center justify-center bg-[var(--accent-soft)]">
                {getPropertyTypeIcon(property.propertyType, 22)}
              </div>
              <div>
                <h2 className="cn-text-h6 leading-[1.2]">
                  {property.name}
                </h2>
                <span className="cn-text-caption text-muted-foreground">
                  {getPropertyTypeLabel(property.propertyType, t)} • {getPropertyStatusLabel(property.status, t)}
                </span>
              </div>
            </div>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <Close size={18} strokeWidth={1.75} />
            </IconButton>
          </div>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2}>
            {/* Adresse */}
            <Grid item xs={12}>
              <Typography sx={styles.dialogSectionTitle}>
                Adresse
              </Typography>
              <p className="cn-text-body2">
                {property.address}, {property.postalCode} {property.city}, {property.country}
              </p>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Caractéristiques */}
            <Grid item xs={12}>
              <Typography sx={{ ...styles.dialogSectionTitle, mb: 1 }}>
                Caractéristiques
              </Typography>
              <div className="flex gap-3 flex-wrap">
                {[
                  { icon: <BedIcon size={18} strokeWidth={1.75} />, value: property.bedrooms, label: 'Chambres' },
                  { icon: <BathroomIcon size={18} strokeWidth={1.75} />, value: property.bathrooms, label: 'Salles de bain' },
                  { icon: <SquareFoot size={18} strokeWidth={1.75} />, value: `${property.surfaceArea} m²`, label: 'Surface' },
                  { icon: <PersonIcon size={18} strokeWidth={1.75} />, value: property.maxGuests, label: 'Voyageurs max' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-[6px] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[11px] px-[9px] py-[6px] min-w-[120px]"
                  >
                    <div className="text-[var(--accent)] flex">{item.icon}</div>
                    <div>
                      <p className="cn-text-body1 font-[var(--font-display)] text-[15px] font-semibold text-[var(--ink)] tabular-nums">{item.value}</p>
                      <p className="cn-text-body1 text-[10.5px] font-bold tracking-[.04em] uppercase text-[var(--faint)]">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Estimation ménage + prix nuit */}
            <Grid item xs={12} md={6}>
              <Typography sx={styles.dialogSectionTitle}>
                {t('properties.cleaningEstimate')}
              </Typography>
              {cleaningPrice != null ? (
                <p className="cn-text-body1 font-[var(--font-display)] text-[22px] font-semibold text-[var(--ink)] tabular-nums tracking-[-.01em]">
                  <Money value={cleaningPrice} from="EUR" decimals={0} /> <span className="cn-text-caption text-muted-foreground">{t('properties.priceEstimation.perIntervention')}</span>
                </p>
              ) : (
                <p className="cn-text-body2 text-muted-foreground">—</p>
              )}
              {property.nightlyPrice > 0 && (
                <p className="cn-text-body2 text-muted-foreground mt-0.5">
                  <Money value={property.nightlyPrice} from="EUR" decimals={0} /> / {t('properties.perNight')}
                </p>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography sx={styles.dialogSectionTitle}>
                Nettoyage
              </Typography>
              <div className="flex items-center gap-1">
                <span className="inline-flex text-muted-foreground"><BroomFill size={18} /></span>
                <p className="cn-text-body2">{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</p>
              </div>
            </Grid>

            {/* Commodités */}
            {property.amenities && property.amenities.length > 0 && (
              <>
                <Grid item xs={12}>
                  <Divider />
                </Grid>
                <Grid item xs={12}>
                  <Typography sx={{ ...styles.dialogSectionTitle, mb: 1 }}>
                    Commodités
                  </Typography>
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
                </Grid>
              </>
            )}

            {/* Contact */}
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography sx={styles.dialogSectionTitle}>
                Contact
              </Typography>
              <p className="cn-text-body2 mb-0.5">
                {property.contactPhone || 'Téléphone non renseigné'}
              </p>
              <p className="cn-text-body2 text-muted-foreground">
                {property.contactEmail || 'Email non renseigné'}
              </p>
            </Grid>

            {/* Description */}
            {property.description && (
              <Grid item xs={12} md={6}>
                <Typography sx={styles.dialogSectionTitle}>
                  Description
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={styles.dialogDescription}
                >
                  {property.description}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          {canDelete && onDelete && (
            <Button
              onClick={onDelete}
              color="error"
              variant="outlined"
              size="small"
              startIcon={<Delete size={16} strokeWidth={1.75} />}
            >
              Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={() => setDetailsOpen(false)} size="small" variant="outlined">
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

PropertyCard.displayName = 'PropertyCard';

export default PropertyCard;
