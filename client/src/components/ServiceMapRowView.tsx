import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin } from "../icons/glyphs";
import { useMapRowFocus } from '../modules/properties/map-views/MapRowInteractions';
import { Button, Popover, PopoverAnchor, PopoverTrigger, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import MapRowPreview from './map/MapRowPreview';
import { useTranslation } from '../hooks/useTranslation';
import './baitlyServiceMapRow.css';

/** The real PMS row, with data and translated labels supplied by its caller. */
export default function ServiceMapRowView({
  title,
  serviceLabel,
  propertyName,
  propertyAddress,
  propertyCity,
  propertyThumb,
  assigneeLabel,
  assigneeAvatars,
  assigneeName,
  extraMemberCount,
  schedule,
  badges,
  children,
  actions,
  menu,
  to,
  onSelect,
  selected,
  demoIndex,
}: {
  title: string;
  serviceLabel: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity?: string;
  propertyThumb: ReactNode;
  assigneeLabel: string;
  assigneeAvatars: ReactNode;
  assigneeName: string;
  extraMemberCount?: number;
  schedule: ReactNode;
  badges: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  menu?: ReactNode;
  to?: string;
  onSelect?: () => void;
  selected?: boolean;
  demoIndex?: number;
}) {
  const locate = useMapRowFocus();
  const { t } = useTranslation();
  const className = "baitly-service-map-main cursor-pointer text-start text-foreground no-underline focus-visible:outline-2 focus-visible:outline-ring";
  const content = (
    <>
      <div className="baitly-service-map-photo">{propertyThumb}</div>
      <div className="baitly-service-map-identity">
        {serviceLabel !== title && <span className="baitly-service-map-type">{serviceLabel}</span>}
        <span dir="auto" className="baitly-service-map-title">{title}</span>
        <span dir="auto" className="baitly-service-map-property">{propertyName}</span>
        <span className="baitly-service-map-address">{[propertyAddress, propertyCity].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="baitly-service-map-schedule">{schedule}</div>
    </>
  );
  return (
    <Popover><PopoverAnchor asChild><article data-map-preview-anchor className="baitly-service-map-row relative">
      {to && !locate ? (
        <Link to={to} className={className} aria-label={`${title} · ${serviceLabel} · ${propertyName}`}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={`${title} · ${serviceLabel} · ${propertyName}`}
          className={className}
          aria-pressed={selected}
          data-demo-mission={demoIndex}
          onClick={locate ?? onSelect}
        >
          {content}
        </button>
      )}
      {!locate && <ChevronRight className="baitly-service-map-chevron cn-rtl-flip pointer-events-none absolute size-4 text-muted-foreground" aria-hidden />}
      {locate && to && <PopoverTrigger asChild><button type="button" aria-label={`${t('common.details', 'Détails')} · ${title}`}
        className="baitly-service-map-chevron absolute flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronRight className="cn-rtl-flip size-4" aria-hidden />
      </button></PopoverTrigger>}
      <div className="baitly-service-map-footer">
        <div className="baitly-service-map-assignee">
          <div aria-hidden className="flex shrink-0 -space-x-2 rtl:space-x-reverse">{assigneeAvatars}</div>
          <div className="min-w-0">
            <span className="sr-only">{assigneeLabel} : </span>
            <span className="text-xs font-medium [overflow-wrap:anywhere]">{assigneeName}</span>
            {!!extraMemberCount && <span className="ms-1 text-xs tabular-nums text-muted-foreground">+{extraMemberCount}</span>}
          </div>
        </div>
        <div className="baitly-service-map-actions">
          {badges}{menu}
          {locate && <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-7 shrink-0 cursor-pointer" aria-label={t('mapPilot.locate', 'Localiser sur la carte')} onClick={locate}>
              <MapPin className="size-3.5" aria-hidden />
            </Button>
          </TooltipTrigger><TooltipContent>{t('mapPilot.locate', 'Localiser sur la carte')}</TooltipContent></Tooltip>}
        </div>
        {children && <div className="basis-full">{children}</div>}
      </div>
      {actions && <div className="baitly-service-map-commercial empty:hidden">{actions}</div>}
    </article></PopoverAnchor>
    {locate && to && <MapRowPreview label={title} side="start">
      <div className="p-4 pe-9"><div className="baitly-service-map-main baitly-service-map-preview">{content}</div>
        <Link to={to} className="mt-4 flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-muted px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          {t('common.viewDetails', 'Voir les détails')}<ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </MapRowPreview>}
    </Popover>
  );
}
