import { baitlyPersona } from './persona';

const owner = { canViewOwnerSpace: true };
it('whenUserIsPlatformStaff_thenPersonaIsAdmin', () => {
  expect(baitlyPersona({ roles: ['SUPER_MANAGER'], organizationType: 'CONCIERGE' }, owner)).toBe('admin');
});
it('whenUserSupervisesTeams_thenPersonaIsSupervisor', () => {
  expect(baitlyPersona({ roles: ['SUPERVISOR'] }, owner)).toBe('supervisor');
});
it('whenHostBelongsToAConcierge_thenPersonaIsConcierge', () => {
  expect(baitlyPersona({ roles: ['HOST'], organizationType: 'CONCIERGE' }, owner)).toBe('concierge');
  expect(baitlyPersona({ roles: ['HOST'], organizationType: 'INDIVIDUAL' }, owner)).toBe('owner');
});
it('whenUserHasNoOwnerSpaceOrSwitchedWorkspace_thenPersonaIsProvider', () => {
  expect(baitlyPersona({ roles: ['HOUSEKEEPER'] }, { canViewOwnerSpace: false })).toBe('provider');
  expect(baitlyPersona({ roles: ['HOST'], organizationType: 'CONCIERGE' }, owner, 'provider')).toBe('provider');
});
