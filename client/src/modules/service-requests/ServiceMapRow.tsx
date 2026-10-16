import type { ReactNode } from 'react';
import ServiceMapRowView from '../../components/ServiceMapRowView';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock3, UserRound } from '../../icons/glyphs';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui';
import { propertiesApi } from '../../services/api/propertiesApi';
import { propertiesListQuery } from '../../hooks/usePropertiesList';
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
  // La liste des logements est souvent déjà en cache (écran Carte) : elle porte la photo et le
  // fuseau dont la ligne a besoin. La fiche complète n'est lue que si le logement n'y est pas —
  // une requête par ligne pesait sur l'ouverture de la liste des prestations.
  const listed = useQuery({ ...propertiesListQuery(), enabled: false,
    select: (rows) => rows.find((row) => row.id === request.propertyId) ?? null });
  const fetched = useQuery({ queryKey: ['map-property', request.propertyId],
    queryFn: () => propertiesApi.getById(request.propertyId!), enabled: !!request.propertyId && !listed.data, staleTime: 300_000, retry: false });
  const property = { data: listed.data ?? fetched.data };
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
  return <ServiceMapRowView
    title={stripPropertySuffix(request.title, request.propertyName)}
    serviceLabel={serviceLabel}
    propertyName={request.propertyName}
    propertyAddress={request.propertyAddress}
    propertyCity={request.propertyCity}
    propertyThumb={<PropertyThumb key={request.propertyId} property={property.data ?? null} name={request.propertyName} className="h-12 w-14" />}
    assigneeLabel={t(request.assignedToType === 'team' ? 'requestMap.team' : 'requestMap.provider')}
    assigneeName={request.assignedToName || t('requestMap.unassigned')}
    extraMemberCount={Math.max(0, members.length - 3)}
    assigneeAvatars={members.length ? members.slice(0, 3).map(member => <Avatar key={member.id} size="sm" className="ring-2 ring-card" title={[member.firstName, member.lastName].filter(Boolean).join(' ')}>
      <AvatarImage src={toApiMediaUrl(member.avatarUrl)} alt="" />
      <AvatarFallback>{initials(member.firstName + ' ' + member.lastName)}</AvatarFallback>
    </Avatar>) : <Avatar size="sm">
      <AvatarImage src={toApiMediaUrl(request.assignedToAvatarUrl) || userAvatarSrc(person.data)} alt="" />
      <AvatarFallback>{request.assignedToName ? initials(request.assignedToName) : <UserRound className="size-3.5" />}</AvatarFallback>
    </Avatar>}
    schedule={date && !Number.isNaN(date.getTime()) ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
      <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden />{date.toLocaleDateString(currentLanguage, dateOptions)}</span>
      <span className="flex items-center gap-1 font-medium"><Clock3 className="size-3.5 text-muted-foreground" aria-hidden />{date.toLocaleTimeString(currentLanguage, timeOptions)}{end && <> – {end.toLocaleDateString(currentLanguage, dateOptions) !== date.toLocaleDateString(currentLanguage, dateOptions) && end.toLocaleDateString(currentLanguage, dateOptions) + ' '}{end.toLocaleTimeString(currentLanguage, timeOptions)}</>}</span>
    </div> : <span className="text-xs text-muted-foreground">{t('requestMap.unscheduled')}</span>}
    to={to} badges={badges} actions={actions}
  >{children}</ServiceMapRowView>;
}
