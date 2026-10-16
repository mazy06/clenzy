import { missionSteps, parseStringList, canSubmitMission } from '../domain';
describe('mission delivery', () => {
  it('uses remote delivery steps without on-site checks', () => {
    expect(missionSteps({ type: 'CLEANING' }, 'REMOTE')).toEqual(['delivery', 'review']);
  });
  it('uses diagnostic and test for maintenance', () => {
    expect(missionSteps({ type: 'MAINTENANCE' }, 'ON_SITE')).toContain('diagnostic');
    expect(missionSteps({ type: 'MAINTENANCE' }, 'ON_SITE')).toContain('test');
  });
  it('cannot submit with pending media or incomplete work', () => {
    expect(canSubmitMission('Done', ['work'], ['work'], 1)).toBe(false);
    expect(canSubmitMission('Done', [], ['work'], 0)).toBe(false);
    // The recap replaces the mandatory free-text report; evidence and completed steps remain required.
    expect(canSubmitMission(' ', ['work'], ['work'], 0)).toBe(true);
    expect(canSubmitMission('Done', ['work'], ['work'], 0)).toBe(true);
  });
  it('does not trust malformed or mixed server lists', () => {
    expect(parseStringList('oops')).toEqual([]);
    expect(parseStringList('[1,"work"]')).toEqual(['work']);
  });
});
