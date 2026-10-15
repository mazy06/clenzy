import type { MobileMission } from './api';

export type FollowUpStageState = 'done' | 'current' | 'todo' | 'blocked';
export interface FollowUpStage { key: string; label: string; state: FollowUpStageState; at?: string }

const STARTED = ['IN_PROGRESS', 'AWAITING_VALIDATION', 'COMPLETED'];
const SUBMITTED = ['AWAITING_VALIDATION', 'COMPLETED'];

/**
 * Read-only progression shown to the owner or the concierge who follows an intervention.
 * Each stage is derived from the server state only: the follower never acts on the mission.
 */
export function missionFollowUpStages(mission: MobileMission): FollowUpStage[] {
  const started = STARTED.includes(mission.status) || (!!mission.startTime && mission.status !== 'PENDING');
  const submitted = SUBMITTED.includes(mission.status);
  const validated = mission.status === 'COMPLETED';
  const assigned = !!mission.assignedToName;
  const answer = mission.assignmentResponse;
  const accepted = started || (assigned && answer !== 'PENDING' && answer !== 'DECLINED');
  const assignment: FollowUpStage = !assigned && !started
    ? { key: 'assignment', label: 'followUp.stage.unassigned', state: 'current' }
    : answer === 'DECLINED' && !started
      ? { key: 'assignment', label: 'followUp.stage.declined', state: 'blocked' }
      : { key: 'assignment', label: accepted ? 'followUp.stage.accepted' : 'followUp.stage.awaitingAnswer', state: accepted ? 'done' : 'current' };
  return [
    { key: 'scheduled', label: 'followUp.stage.scheduled', state: 'done', at: mission.scheduledDate },
    assignment,
    { key: 'started', label: 'followUp.stage.started', state: submitted ? 'done' : started ? 'current' : 'todo', at: started ? mission.startTime : undefined },
    { key: 'submitted', label: 'followUp.stage.submitted', state: validated ? 'done' : submitted ? 'current' : 'todo', at: submitted ? mission.endTime : undefined },
    { key: 'validated', label: 'followUp.stage.validated', state: validated ? 'done' : 'todo' },
  ];
}

/** Completed share of the required steps, ignoring per-room sub-steps such as `surfaces_bedroom_1`. */
export function missionFollowUpProgress(required: string[], completed: string[]) {
  const done = required.filter(step => completed.includes(step)).length;
  return { done, total: required.length };
}
