import { missionFollowUpProgress, missionFollowUpStages } from './missionFollowUpModel';

const base = { id: 1, title: 'Ménage', type: 'CLEANING', scheduledDate: '2026-10-14T14:00:00' };
const states = (mission: Parameters<typeof missionFollowUpStages>[0]) => missionFollowUpStages(mission).map(stage => `${stage.key}:${stage.state}`);

it('whenMissionIsUnassigned_thenAssignmentIsTheCurrentStage', () => {
  expect(missionFollowUpStages({ ...base, status: 'PENDING' })[1]).toMatchObject({ label: 'followUp.stage.unassigned', state: 'current' });
});
it('whenAssigneeHasNotAnswered_thenFollowerWaitsForAcceptance', () => {
  expect(states({ ...base, status: 'PENDING', assignedToName: 'Amine', assignmentResponse: 'PENDING' }))
    .toEqual(['scheduled:done', 'assignment:current', 'started:todo', 'submitted:todo', 'validated:todo']);
});
it('whenAssigneeDeclined_thenAssignmentIsBlocked', () => {
  expect(missionFollowUpStages({ ...base, status: 'PENDING', assignedToName: 'Amine', assignmentResponse: 'DECLINED' })[1].state).toBe('blocked');
});
it('whenMissionIsRunning_thenStartIsCurrentWithItsTime', () => {
  const stages = missionFollowUpStages({ ...base, status: 'IN_PROGRESS', assignedToName: 'Amine', assignmentResponse: 'ACCEPTED', startTime: '2026-10-14T14:05:00Z' });
  expect(stages.map(stage => stage.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  expect(stages[2].at).toBe('2026-10-14T14:05:00Z');
});
it('whenWorkIsApproved_thenEveryStageIsDone', () => {
  expect(missionFollowUpStages({ ...base, status: 'COMPLETED', assignedToName: 'Amine', startTime: 'x', endTime: 'y' }).every(stage => stage.state === 'done')).toBe(true);
});
it('countsOnlyRequiredSteps', () => {
  expect(missionFollowUpProgress(['inspection', 'surfaces', 'after_photos'], ['inspection', 'surfaces_bedroom_1'])).toEqual({ done: 1, total: 3 });
});
