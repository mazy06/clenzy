import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "../icons/glyphs";
import { useMapRowFocus } from '../modules/properties/map-views/MapRowInteractions';
import { Popover, PopoverAnchor, PopoverTrigger } from './ui';
import MapRowPreview from './map/MapRowPreview';
import { useTranslation } from '../hooks/useTranslation';

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
  const className =
    "group block w-full min-w-0 cursor-pointer px-3 pt-3 pb-2.5 text-start text-foreground no-underline transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{title}</span>
        {!locate && <ChevronRight
          className="cn-rtl-flip size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />}
      </div>
      <span className="mt-1 block text-xs text-muted-foreground">
        {serviceLabel}
      </span>
      <div className="mt-3 flex min-w-0 items-center gap-2.5">
        <div className="shrink-0 overflow-hidden rounded-md">{propertyThumb}</div>
        <div className="min-w-0 flex-1">
          <span dir="auto" className="block text-sm font-medium leading-snug [overflow-wrap:anywhere]">
            {propertyName}
          </span>
          <span
            className="mt-0.5 block truncate text-xs text-muted-foreground"
            title={propertyAddress}
          >
            {propertyAddress}
          </span>
          {propertyCity && (
            <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {propertyCity}
            </span>
          )}
        </div>
      </div>
      <div className="my-3 flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse">{assigneeAvatars}</div>
        <div className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">{assigneeLabel}</span>
          <span className="block text-xs font-medium leading-snug [overflow-wrap:anywhere]">{assigneeName}</span>
        </div>
        {!!extraMemberCount && (
          <span className="text-xs text-muted-foreground tabular-nums">
            +{extraMemberCount}
          </span>
        )}
      </div>
      <div className="border-t border-border pt-2.5">
        {schedule}
      </div>
      {children}
    </>
  );
  return (
    <Popover><PopoverAnchor asChild><article data-map-preview-anchor className="relative">
      {to && !locate ? (
        <Link to={to} className={className}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={locate ? `${className} pe-12` : className}
          aria-pressed={selected}
          data-demo-mission={demoIndex}
          onClick={locate ?? onSelect}
        >
          {content}
        </button>
      )}
      {locate && to && <PopoverTrigger asChild><button type="button" aria-label={`${t('common.details', 'Détails')} · ${title}`}
        className="absolute end-1 top-1 flex size-9 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronRight className="cn-rtl-flip size-4" aria-hidden />
      </button></PopoverTrigger>}
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {badges}
        </div>
        {menu && <div className="shrink-0">{menu}</div>}
      </div>
      {actions && <div className="px-3 pb-3 empty:hidden">{actions}</div>}
    </article></PopoverAnchor>
    {locate && to && <MapRowPreview label={title} side="start">
      <div className="p-4 pe-9">{content}
        <Link to={to} className="mt-4 flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-muted px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          {t('common.viewDetails', 'Voir les détails')}<ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </MapRowPreview>}
    </Popover>
  );
}
