import type { MobileMission } from './api';
export function missionTiming(mission: MobileMission, now: number) {
  const start = mission.startTime ? Date.parse(mission.startTime) : NaN;
  const running = mission.status === 'IN_PROGRESS';
  const end = mission.endTime ? Date.parse(mission.endTime) : NaN;
  const pause = mission.pausedAt ? Date.parse(mission.pausedAt) : NaN;
  const elapsed = Number.isFinite(start) && (running || Number.isFinite(end))
    ? Math.max(0, Math.floor(((running ? Number.isFinite(pause) ? pause : now : end) - start) / 1000) - (mission.pauseSeconds ?? 0))
    : mission.actualDurationMinutes !== undefined ? Math.max(0, mission.actualDurationMinutes * 60) : undefined;
  const budget = mission.estimatedDurationHours && mission.estimatedDurationHours > 0 ? mission.estimatedDurationHours * 3600 : undefined;
  return { elapsed, remaining: elapsed !== undefined && budget !== undefined ? budget - elapsed : undefined };
}
export function missionTimeWarning(mission: MobileMission, now: number) {
  const { remaining } = missionTiming(mission, now);
  return remaining !== undefined && mission.estimatedDurationHours !== undefined && remaining <= mission.estimatedDurationHours * 360;
}
export function timerText(seconds: number) {
  const value = Math.floor(Math.abs(seconds));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, '0')).join(':');
}
