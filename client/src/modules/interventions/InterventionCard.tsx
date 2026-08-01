import React from 'react';
import {
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import { Button } from '../../components/ui';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import {
  Visibility,
  Edit,
  LocationOn,
  Person as PersonIcon,
  Group as GroupIcon,
  MoreVert,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { getServiceTypeBannerUrl } from '../../utils/serviceTypeBanner';
import { formatDuration } from '../../utils/formatUtils';
import { getDueMeta, dueToneColor } from '../../utils/dueDateUtils';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
  getInterventionTypeHex,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens } from './interventionUtils';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  requestorName: string;
  assignedToName: string;
  assignedToType: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  progressPercentage: number;
  createdAt: string;
}

interface InterventionCardProps {
  intervention: Intervention;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => void;
  canEdit?: boolean;
}

// Dégradé par catégorie de type (fallback derrière la photo) — identique à
// ServiceRequestCard pour un design de bandeau unifié entre les deux cartes.
const getTypeGradient = (type: string): string => {
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];
  const maintenanceTypes = ['PREVENTIVE_MAINTENANCE', 'RESTORATION'];
  const outdoorTypes = ['GARDENING', 'PEST_CONTROL'];

  if (cleaningTypes.includes(type)) return 'linear-gradient(135deg, #7BA3C2 0%, #9BB8D1 100%)';
  if (repairTypes.includes(type)) return 'linear-gradient(135deg, #C07A7A 0%, #D4A0A0 100%)';
  if (maintenanceTypes.includes(type)) return 'linear-gradient(135deg, #D4A574 0%, #E8C19A 100%)';
  if (outdoorTypes.includes(type)) return 'linear-gradient(135deg, #6B9B8E 0%, #8BB5A8 100%)';
  return 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)';
};

// ─── Styles alignés sur la référence .pr-card (PropertyCard / screen-properties) ───
const styles = {
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
  menuButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
    color: 'rgba(255,255,255,0.6)',
    bgcolor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'var(--on-accent)' },
    width: 28,
    height: 28,
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '12px !important',
  },
} as const;

// Nom d'entité en display.
const NAME_TEXT_CLASS = 'cn-text-body1 truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-.01em] text-[var(--ink)]';
// Ligne localisation (propriété).
const LOCATION_TEXT_CLASS = 'cn-text-body1 truncate flex-1 text-[11.5px] text-[var(--muted)]';
// Bande de KPI (valeurs display tabular-nums).
const STAT_VALUE_CLASS = 'cn-text-body1 font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--ink)] tabular-nums leading-[1.2]';
const STAT_LABEL_CLASS = 'cn-text-body1 text-[9.5px] font-bold tracking-[.04em] uppercase text-[var(--faint)] mt-px';

const InterventionCard: React.FC<InterventionCardProps> = React.memo(({
  intervention,
  onMenuOpen,
  canEdit = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const statusTokens = getStatusTokens(intervention.status);
  const priorityTokens = getPriorityTokens(intervention.priority);
  const typeHex = getInterventionTypeHex(intervention.type);
  const dueMeta = getDueMeta(intervention.scheduledDate, t);

  const kpiCells = [
    { value: dueMeta.label, color: dueToneColor(dueMeta.tone), label: t('interventions.kpi.due') },
    { value: `${intervention.progressPercentage}%`, label: t('interventions.kpi.progress') },
    { value: `~${formatDuration(intervention.estimatedDurationHours)}`, label: t('interventions.kpi.duration') },
  ];

  const assigneeName = intervention.assignedToName || intervention.requestorName || 'Non assigné';

  const handleViewDetails = () => {
    navigate(`/interventions/${intervention.id}`);
  };

  return (
    <Card
      sx={styles.cardRoot}
      onClick={handleViewDetails}
    >
      {/* ─── Bandeau statique photo + dégradé (par type) + pastille statut ─── */}
      {/* Le degrade et la photo dependent du type, connu seulement a l'execution. */}
      <div
        className="relative h-[110px] flex items-center justify-center overflow-hidden"
        style={{
          background: getTypeGradient(intervention.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(intervention.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pastille statut top-left (dot coloré + libellé) */}
        <div className="absolute top-[10px] left-3 z-[2] inline-flex items-center gap-[3.75px] px-[9px] py-[4px] rounded-[20px] bg-[rgba(255,255,255,.92)] backdrop-blur-[4px] text-[10.5px] font-bold leading-none text-[#2A3942]">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusTokens.color }} />
          {getInterventionStatusLabel(intervention.status, t)}
        </div>

        {/* Menu contextuel top-right */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
          sx={styles.menuButton}
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre + chip type */}
        <div className="flex items-center gap-1 min-w-0 mb-0.5">
          <p className={cn(NAME_TEXT_CLASS, 'flex-1')} title={intervention.title}>
            {intervention.title}
          </p>
          <StatusChip
            tokens={{ color: typeHex, bg: `${typeHex}18` }}
            label={getInterventionTypeLabel(intervention.type, t)}
            className="shrink-0 text-[0.62rem]"
            // Le liseré reprend la teinte du type, connue seulement a l'execution.
            sx={{ border: `1px solid ${typeHex}40` }}
          />
        </div>

        {/* Propriété */}
        <div className="flex items-center gap-[3px] mb-[7.5px]">
          <span className="inline-flex text-[var(--muted)] shrink-0">
            <LocationOn size={14} strokeWidth={1.75} />
          </span>
          <p
            className={LOCATION_TEXT_CLASS}
            title={`${intervention.propertyName} - ${intervention.propertyAddress}`}
          >
            {intervention.propertyName}
          </p>
        </div>

        {/* Bande de KPI : échéance / avancement / durée */}
        <div className="flex border-t border-b border-solid border-[var(--line)] mb-[7.5px]">
          {kpiCells.map((cell) => (
            <div
              key={cell.label}
              className="flex-1 py-[9px] text-center min-w-0 border-r border-solid border-[var(--line)] last:border-r-0"
            >
              {/* La teinte d'echeance est calculee a l'execution : style inline obligatoire. */}
              <p className={STAT_VALUE_CLASS} style={cell.color ? { color: cell.color } : undefined}>
                {cell.value}
              </p>
              <p className={STAT_LABEL_CLASS}>{cell.label}</p>
            </div>
          ))}
        </div>

        {/* Pied opérationnel : assigné (gauche) + priorité (droite) */}
        <div className="flex items-center gap-[5.25px] min-h-[20px] min-w-0 text-[11.5px] text-[var(--muted)]">
          <span className="inline-flex shrink-0 text-[var(--accent)]">
            {intervention.assignedToType === 'team'
              ? <GroupIcon size={13} strokeWidth={2} />
              : <PersonIcon size={13} strokeWidth={2} />}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--body)]">{assigneeName}</span>
          <div className="flex-1" />
          <StatusChip
            tokens={priorityTokens}
            label={getInterventionPriorityLabel(intervention.priority, t)}
            className="h-5 shrink-0 text-[0.62rem]"
          />
        </div>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <div className="flex gap-[4.5px] px-[10.5px] pt-0 pb-[7.5px]">
        <Button
          className="w-full shrink"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outline"
        >
          <Visibility size={15} strokeWidth={1.75} />
          Détails
        </Button>
        {canEdit && (
          <Button
            className="w-full shrink"
            size="sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}/edit`); }}
            variant="outline"
          >
            <Edit size={15} strokeWidth={1.75} />
            Modifier
          </Button>
        )}
      </div>
    </Card>
  );
});

InterventionCard.displayName = 'InterventionCard';

export default InterventionCard;
