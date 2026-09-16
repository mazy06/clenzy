import { afterEach, expect, it, vi } from 'vitest';
import { teamsApi } from '../teamsApi';
const api=vi.hoisted(() => ({ get:vi.fn() }));
vi.mock('../../apiClient',() => ({ default:api }));
afterEach(() => vi.clearAllMocks());
it('includes teams and capabilities from every page for property associations',async () => {
  api.get.mockResolvedValueOnce({content:[{id:1,serviceItemCodes:['cleaning-turnover']}],size:1,totalPages:2})
    .mockResolvedValueOnce({content:[{id:2,serviceItemCodes:['accounting-lmnp']}],size:1,totalPages:2});
  const teams=await teamsApi.getAll();
  expect(teams.map(team => team.id)).toEqual([1,2]);
  expect(teams[1].serviceItemCodes).toEqual(['accounting-lmnp']);
  expect(api.get).toHaveBeenLastCalledWith('/teams?page=1&size=1');
});
