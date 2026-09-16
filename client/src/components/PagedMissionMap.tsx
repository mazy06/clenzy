import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock3, CircleCheck } from "lucide-react";
import { MapboxPropertyMap, type MapBounds } from "./MapboxPropertyMap";
import MapWithSheet from "./baitly/MapWithSheet";
import { Alert, AlertDescription, Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "./ui";
import { useTranslation } from "../hooks/useTranslation";
import { useMissionMapOverview, useMissionMapPages, type MissionMapFilters, type MissionMapKind } from "../hooks/useMissionMap";

export default function PagedMissionMap<T extends { id: string | number }>({ kind, filters, renderRow, renderRows }: {
  kind: MissionMapKind; filters: MissionMapFilters; renderRow: (row: T) => ReactNode;
  renderRows?: (rows: T[]) => ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const overview = useMissionMapOverview(kind, filters);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onBoundsChange = useCallback((next: MapBounds) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const wrap = (lng: number) => ((lng + 180) % 360 + 360) % 360 - 180;
      const round = (value: number) => Number(value.toFixed(5));
      const world = next.east - next.west >= 360;
      const normalized = { north: round(Math.min(90, next.north)), south: round(Math.max(-90, next.south)),
        east: world ? 180 : round(wrap(next.east)), west: world ? -180 : round(wrap(next.west)) };
      setBounds(previous => JSON.stringify(previous) === JSON.stringify(normalized) ? previous : normalized);
    }, 300);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pages = useMissionMapPages<T>(kind, filters, bounds, !!overview.data?.markers.length);
  const rows = useMemo(() => {
    const unique = new Map<string | number, T>();
    pages.data?.pages.forEach(page => page.content.forEach(row => unique.set(row.id, row)));
    return [...unique.values()];
  }, [pages.data]);
  const resetKey = JSON.stringify([filters, bounds]);
  const markerData = useMemo(() => overview.data?.markers.map(marker => ({ ...marker, type: "property" as const })) ?? [], [overview.data]);
  const total = pages.data?.pages[0]?.totalElements;
  const busy = pages.isFetchingNextPage;
  const endRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadingMore.current || pages.isFetching || !pages.hasNextPage) return;
    loadingMore.current = true;
    try { await pages.fetchNextPage(); } finally { loadingMore.current = false; }
  }, [pages.isFetching, pages.hasNextPage, pages.fetchNextPage]);
  useEffect(() => {
    const sentinel = endRef.current;
    if (!sentinel || !pages.hasNextPage || pages.isError || pages.isFetching) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { root: sentinel.closest("[data-map-list-scroll]"), threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, pages.hasNextPage, pages.isError, pages.isFetching, rows.length]);

  if (overview.isError) return <Alert variant="destructive"><AlertDescription>
    {t("missionMap.loadError")} <Button variant="outline" onClick={() => void overview.refetch()}>{t("common.retry")}</Button>
  </AlertDescription></Alert>;
  if (!overview.data) return <Skeleton className="min-h-48 flex-1" />;
  const indicators = kind === "service-requests" ? <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
    {[
      { label: t("serviceRequests.kpi.late"), count: overview.data.late, Icon: AlertTriangle, color: "var(--bui-destructive-ink)" },
      { label: t("serviceRequests.kpi.today"), count: overview.data.today, Icon: Clock3, color: "var(--bui-info-ink)" },
      { label: t("serviceRequests.kpi.done7d"), count: overview.data.completed, Icon: CircleCheck, color: "var(--bui-success-ink)" },
    ].map(({label, count, Icon, color}) => <Tooltip key={label}><TooltipTrigger asChild>
      <span tabIndex={0} aria-label={count + " " + label} className="inline-flex items-center gap-1 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Icon size={15} style={{color}} aria-hidden /><span className="font-semibold">{count}</span>
      </span></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}
  </div> : undefined;
  return <MapWithSheet desktopLayout="split" listResetKey={resetKey}
    map={<MapboxPropertyMap properties={markerData} height="100%" onBoundsChange={onBoundsChange}
      onMarkerClick={marker => marker.id && navigate("/" + kind + "/" + marker.id)} />}
    listTitle={total === undefined && markerData.length ? t("missionMap.loading") :
      kind === "service-requests" ? t("requestMap.visible", { count: total ?? 0 }) : t("missionMap.visibleInterventions", { count: total ?? 0 })}
    listIndicators={indicators}>
    {renderRows ? renderRows(rows) : rows.map(row => renderRow(row))}
    {(pages.isLoading || (!bounds && markerData.length > 0)) && <div className="space-y-3 p-4" role="status" aria-label={t("missionMap.loading")}>
      <Skeleton className="h-36" /><Skeleton className="h-36" />
    </div>}
    {!pages.isLoading && !pages.isError && (total === 0 || !markerData.length) &&
      <p className="p-4 text-sm text-muted-foreground">{t(markerData.length ? "missionMap.emptyZone" : "missionMap.noCoordinates")}</p>}
    {pages.isError && <div role="alert" className="p-4 text-sm">
      <p>{t("missionMap.loadError")}</p>
      <Button variant="outline" onClick={() => void (pages.isFetchNextPageError ? pages.fetchNextPage() : pages.refetch())}>{t("common.retry")}</Button>
    </div>}
    {pages.hasNextPage && <div ref={endRef} className="flex shrink-0 justify-center p-3">
      {busy ? <span role="status" className="text-xs text-muted-foreground">{t("missionMap.loading")}</span> :
        !pages.isError && <Button variant="ghost" onClick={() => void loadMore()}>{t("missionMap.loadMore")}</Button>}
    </div>}
  </MapWithSheet>;
}
