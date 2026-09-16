import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock3, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui';
import { propertiesApi } from '../../services/api/propertiesApi';
import { usersApi, userAvatarSrc } from '../../services/api/usersApi';
import { teamsApi } from '../../services/api/teamsApi';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { PropertyThumb } from '../notifications/NotificationPropertyPanel';
import { useTranslation } from '../../hooks/useTranslation';
import { serviceReferenceQuery } from '../../components/ServiceItemSelect';
import { stripPropertySuffix } from './serviceRequestDisplayMapper';

export interface ServiceMapSummary {
  serviceItemCode?: string; durationHours?: number;
  title: string; propertyId?: number; propertyName: string; propertyAddress: string;
  propertyCity?: string; assignedToId?: number; assignedToName?: string;
  assignedToType?: 'user' | 'team'; assignedToAvatarUrl?: string | null; dueDate?: string;
}
export default function ServiceMapRow({ request, to, badges, serviceType, children, actions }: {
  request: ServiceMapSummary; to: string; badges: ReactNode; serviceType: string; children?: ReactNode;
  actions?: ReactNode;
}) {
  const { t, currentLanguage, isEnglish } = useTranslation();
  const catalog = useQuery(serviceReferenceQuery);
  const service = catalog.data?.find(item => item.code === request.serviceItemCode);
  const serviceLabel = service ? (isEnglish ? service.labelEn : service.labelFr) : serviceType;
  const property = useQuery({ queryKey: ['map-property', request.propertyId],
    queryFn: () => propertiesApi.getById(request.propertyId!), enabled: !!request.propertyId, staleTime: 300_000, retry: false });
  const person = useQuery({ queryKey: ['map-assignee', request.assignedToId],
    queryFn: () => usersApi.getById(request.assignedToId!),
    enabled: request.assignedToType === 'user' && !!request.assignedToId && !request.assignedToAvatarUrl, staleTime: 300_000, retry: false });
  const team = useQuery({ queryKey: ['map-team', request.assignedToId],
    queryFn: () => teamsApi.getById(request.assignedToId!),
    enabled: request.assignedToType === 'team' && !!request.assignedToId, staleTime: 300_000, retry: false });
  const members = team.data?.members ?? [];
  const date = request.dueDate ? new Date(request.dueDate) : null;
  const end = date && request.durationHours && request.durationHours > 0
    ? new Date(date.getTime() + request.durationHours * 3_600_000) : null;
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: property.data?.timezone || undefined };
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: property.data?.timezone || undefined };
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  return <article><Link to={to}
    className="group block min-w-0 cursor-pointer p-4 text-foreground no-underline transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2">
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm font-semibold leading-snug">{stripPropertySuffix(request.title, request.propertyName)}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
    <span className="mt-1 block text-xs text-muted-foreground">{serviceLabel}</span>
    <div className="my-3 grid grid-cols-[minmax(0,1fr)_minmax(90px,34%)] gap-3">
    <div className="flex min-w-0 items-start gap-2">
      <PropertyThumb key={request.propertyId} property={property.data ?? null} name={request.propertyName} className="h-12 w-14" />
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium">{request.propertyName}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={request.propertyAddress}>{request.propertyAddress}</span>
        {request.propertyCity && <span className="block text-xs text-muted-foreground">{request.propertyCity}</span>}
      </div>
    </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5 border-s border-border ps-3">
        <span className="text-xs text-muted-foreground">{t(request.assignedToType === 'team' ? 'requestMap.team' : 'requestMap.provider')}</span>
        <div className="flex -space-x-2">
          {members.length ? members.slice(0, 3).map(member => <Avatar key={member.id} size="sm" className="ring-2 ring-card" title={[member.firstName, member.lastName].filter(Boolean).join(' ')}>
            <AvatarImage src={toApiMediaUrl(member.avatarUrl)} alt="" />
            <AvatarFallback>{initials(member.firstName + ' ' + member.lastName)}</AvatarFallback>
          </Avatar>) : <Avatar size="sm">
            <AvatarImage src={toApiMediaUrl(request.assignedToAvatarUrl) || userAvatarSrc(person.data)} alt="" />
            <AvatarFallback>{request.assignedToName ? initials(request.assignedToName) : <UserRound className="size-3.5" />}</AvatarFallback>
          </Avatar>}
        </div>
        <span className="text-xs font-medium">{request.assignedToName || t('requestMap.unassigned')}</span>
        {members.length > 3 && <span className="text-xs text-muted-foreground tabular-nums">+{members.length - 3}</span>}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
      {date && !Number.isNaN(date.getTime()) ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
        <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden />{date.toLocaleDateString(currentLanguage, dateOptions)}</span>
        <span className="flex items-center gap-1 font-medium"><Clock3 className="size-3.5 text-muted-foreground" aria-hidden />{date.toLocaleTimeString(currentLanguage, timeOptions)}{end && <> – {end.toLocaleDateString(currentLanguage, dateOptions) !== date.toLocaleDateString(currentLanguage, dateOptions) && end.toLocaleDateString(currentLanguage, dateOptions) + ' '}{end.toLocaleTimeString(currentLanguage, timeOptions)}</>}</span>
      </div> : <span className="text-xs text-muted-foreground">{t('requestMap.unscheduled')}</span>}
      <div className="flex flex-wrap gap-1 [&>span]:rounded-md [&>span]:border [&>span]:border-border [&>span]:text-xs">{badges}</div>
    </div>
    {children}
  </Link>{actions && <div className="px-4 pb-4">{actions}</div>}</article>;
}
