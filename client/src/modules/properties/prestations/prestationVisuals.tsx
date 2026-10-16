import type { IconComponent } from '../../../icons/createIcon';
import {
  AppWindow, Ban, Bath, Brush, BrushCleaning, Bug, CalendarCheck, ChefHat, CircleCheckBig, CirclePlay, CircleX,
  ClipboardCheck, ClipboardList, CreditCard, Droplets, Hammer, Hourglass, Paintbrush, ShieldAlert, ShieldCheck,
  Snowflake, Sparkles, SprayCan, Sprout, Trees, UserRound, WashingMachine, Zap,
} from '../../../icons/glyphs';
import { Avatar, AvatarFallback, AvatarImage, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { getInterventionStatusLabel, getServiceRequestStatusLabel } from '../../../utils/statusUtils';
import { toApiMediaUrl } from '../../../utils/mediaUrl';
import { getStatusTokens } from '../../interventions/interventionUtils';

/**
 * Icône du métier d'une prestation (code de type d'intervention / de demande). Les noms
 * sont ceux des glyphes du projet : `Wrench`, par exemple, y dessine un engrenage — d'où le
 * choix explicite ici plutôt qu'une icône générique.
 */
const TYPE_ICONS: Record<string, IconComponent> = {
  CLEANING: BrushCleaning,
  DEEP_CLEANING: BrushCleaning,
  EXPRESS_CLEANING: Sparkles,
  WINDOW_CLEANING: AppWindow,
  FLOOR_CLEANING: Brush,
  KITCHEN_CLEANING: ChefHat,
  BATHROOM_CLEANING: Bath,
  EXTERIOR_CLEANING: Trees,
  DISINFECTION: SprayCan,
  MAINTENANCE: Hammer,
  PREVENTIVE_MAINTENANCE: ShieldCheck,
  REPAIR: Hammer,
  EMERGENCY_REPAIR: ShieldAlert,
  ELECTRICAL_REPAIR: Zap,
  PLUMBING_REPAIR: Droplets,
  HVAC_REPAIR: Snowflake,
  APPLIANCE_REPAIR: WashingMachine,
  GARDENING: Sprout,
  PEST_CONTROL: Bug,
  RESTORATION: Paintbrush,
  INSPECTION: ClipboardCheck,
};

export function prestationTypeIcon(type: string | null | undefined): IconComponent {
  return TYPE_ICONS[(type ?? '').toUpperCase()] ?? ClipboardList;
}

/** Icône et explication de chaque statut : ce que l'hôte doit en comprendre. */
const STATUS: Record<string, { icon: IconComponent; help: string }> = {
  PENDING: { icon: Hourglass, help: 'Pas encore prise en charge : en attente d’un intervenant ou d’une décision.' },
  AWAITING_VALIDATION: { icon: ClipboardCheck, help: 'Le devis ou la demande attend votre validation.' },
  ASSIGNED: { icon: UserRound, help: 'Un intervenant est désigné ; la mission n’a pas commencé.' },
  SCHEDULED: { icon: CalendarCheck, help: 'Planifiée à la date prévue.' },
  AWAITING_PAYMENT: { icon: CreditCard, help: 'Le paiement doit être réglé avant que la mission démarre.' },
  IN_PROGRESS: { icon: CirclePlay, help: 'L’intervenant est sur place, la mission est en cours.' },
  COMPLETED: { icon: CircleCheckBig, help: 'Mission terminée.' },
  CANCELLED: { icon: CircleX, help: 'Mission annulée : elle n’aura pas lieu.' },
  REJECTED: { icon: Ban, help: 'Demande refusée.' },
};

/** Statut en pastille-icône teintée ; le libellé et son explication vivent dans l'infobulle. */
export function PrestationStatusIcon({ status, kind }: { status: string; kind: 'intervention' | 'request' }) {
  const { t } = useTranslation();
  const code = status.toUpperCase();
  const entry = STATUS[code] ?? { icon: Hourglass, help: '' };
  const label = kind === 'intervention' ? getInterventionStatusLabel(status, t) : getServiceRequestStatusLabel(status, t);
  const help = entry.help ? t(`propertyPrestations.statusHelp.${code}`, entry.help) : '';
  const tokens = getStatusTokens(status);
  const Icon = entry.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={help ? `${label} : ${help}` : label}
          className="grid size-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: tokens.bg, color: tokens.color }}>
          <Icon size={14} aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <span className="block font-semibold">{label}</span>
        {help && <span className="block">{help}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Photo de l'intervenant (initiales à défaut), son nom en infobulle. */
export function PrestationAssigneeAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  if (!name) return null;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <Avatar size="sm" className="size-6">
            <AvatarImage src={toApiMediaUrl(avatarUrl)} alt="" />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{name}</TooltipContent>
    </Tooltip>
  );
}
