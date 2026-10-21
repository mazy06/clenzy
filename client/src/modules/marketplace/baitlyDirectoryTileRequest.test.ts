import {expect,it,vi} from 'vitest';
vi.mock('../../config/api',()=>({buildApiUrl:(path:string)=>'https://api.baitly.test/api'+path}));
vi.mock('../../keycloak',()=>({getAccessToken:()=> 'test-memory-token'}));
import {directoryTileRequest} from './baitlyDirectoryTileRequest';
it('keeps credentials on first-party directory tiles and off third-party map resources',()=>{
 const first='https://api.baitly.test/api/professional-directory/map-index/tiles/1/0/0.mvt?revision=1';
 expect(directoryTileRequest(first)).toEqual({url:`baitly-directory://${encodeURIComponent(first)}`,credentials:'include',headers:{Authorization:'Bearer test-memory-token'}});
 for(const url of ['https://tiles.example.test/1.pbf','https://api.baitly.test.attacker.test/api/professional-directory/map-index/tiles/1.pbf'])
  expect(directoryTileRequest(url)).toEqual({url});
});
