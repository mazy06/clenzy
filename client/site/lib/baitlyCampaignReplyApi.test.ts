import { afterEach,expect,it,vi } from 'vitest';
import { baitlyCampaignReplyApi } from './baitlyCampaignReplyApi';
afterEach(()=>vi.unstubAllGlobals());
it('sends the response capability in a POST body rather than a URL or browser storage',async()=>{
  const token='a'.repeat(43),fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({organization:'Maison'})});vi.stubGlobal('fetch',fetch);
  await baitlyCampaignReplyApi.lookup(token,new AbortController().signal);const [url,options]=fetch.mock.calls[0];expect(url).not.toContain(token);expect(options).toMatchObject({method:'POST',credentials:'omit'});expect(JSON.parse(options.body)).toEqual({token});
});
