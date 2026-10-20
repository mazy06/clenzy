import type { MapBounds } from '../../../components/BaitlyPropertyMap';
import type { MapCamera } from '../../../components/BaitlyMapCanvas';
import type { SectorGeometry, SectorMode } from '../../../components/map/sectorLayer';
import { sectorContainsPoint } from '../../../components/map/sectorHitTest';
import { addDays, isoDay, startOfDay } from '../prestations/prestationTimeline';
import type { PropertyMapView } from './propertyMapView';

export type MapPeriod = 'all' | 'today' | 'tomorrow' | 'week' | 'custom';
export type MapQuickFilter = 'all' | 'active' | 'maintenance' | 'missing' | 'uncovered';
export interface MapPoint { lng: number; lat: number }
export interface BaitlyMapContext {
  period: MapPeriod;
  from: string;
  to: string;
  quick: MapQuickFilter;
  camera: MapCamera | null;
  area: MapPoint | MapPoint[] | null;
  sectorMode: SectorMode;
  view: PropertyMapView;
  category: 'all' | 'intervention' | 'request';
}
export const DEFAULT_MAP_CONTEXT: BaitlyMapContext = {
  period: 'all', from: '', to: '', quick: 'all', camera: null, area: null, sectorMode: 'byProvider', view: 'properties', category: 'all',
};

export function normalizeMapContext(raw: Partial<BaitlyMapContext> | null): BaitlyMapContext {
  const result = { ...DEFAULT_MAP_CONTEXT, ...raw };
  if (!['all', 'today', 'tomorrow', 'week', 'custom'].includes(result.period)) result.period = 'all';
  if (!['all', 'active', 'maintenance', 'missing', 'uncovered'].includes(result.quick)) result.quick = 'all';
  if (!['properties', 'prestations', 'reservations', 'issues'].includes(result.view)) result.view = 'properties';
  if (!['all', 'intervention', 'request'].includes(result.category)) result.category = 'all';
  if (result.sectorMode !== 'merged') result.sectorMode = 'byProvider';
  if (typeof result.from !== 'string') result.from = '';
  if (typeof result.to !== 'string') result.to = '';
  const validPoint = (point: MapPoint) => point && Number.isFinite(point.lng) && Number.isFinite(point.lat)
    && Math.abs(point.lng) <= 180 && Math.abs(point.lat) <= 90;
  if (Array.isArray(result.area)) {
    result.area = result.area.filter(validPoint);
    if (!result.area.length) result.area = null;
  } else if (result.area && !validPoint(result.area)) result.area = null;
  if (result.camera && (!Array.isArray(result.camera.center) || result.camera.center.length !== 2
    || ![...result.camera.center, result.camera.zoom, result.camera.bearing, result.camera.pitch].every(Number.isFinite)
    || Math.abs(result.camera.center[0]) > 180 || Math.abs(result.camera.center[1]) > 90
    || result.camera.zoom < 0 || result.camera.zoom > 22 || result.camera.pitch < 0 || result.camera.pitch > 65)) result.camera = null;
  return result;
}

export function mapDateRange(period: MapPeriod, from: string, to: string, now = new Date()): { from?: string; to?: string } {
  const today = startOfDay(now);
  if (period === 'today') return { from: isoDay(today), to: isoDay(today) };
  if (period === 'tomorrow') { const day = isoDay(addDays(today, 1)); return { from: day, to: day }; }
  if (period === 'week') return { from: isoDay(today), to: isoDay(addDays(today, 6)) };
  if (period === 'custom' && validMapDay(from) && validMapDay(to) && from <= to) return { from, to };
  return {};
}
export function validMapDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day))
    && new Date(day).toISOString().slice(0, 10) === day;
}
export function pointInMapScope(lng: number, lat: number, area: SectorGeometry | null, bounds: MapBounds | null): boolean {
  if (area) return sectorContainsPoint(area, lng, lat);
  if (!bounds) return true;
  const x = ((lng + 180) % 360 + 360) % 360 - 180;
  const west = ((bounds.west + 180) % 360 + 360) % 360 - 180;
  const east = ((bounds.east + 180) % 360 + 360) % 360 - 180;
  return lat >= bounds.south && lat <= bounds.north && (bounds.east - bounds.west >= 360
    || (west <= east ? x >= west && x <= east : x >= west || x <= east));
}
