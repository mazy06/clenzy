import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import AuthenticatedApp from './AuthenticatedApp';

const startup=vi.hoisted(()=>({prefetch:vi.fn(),warm:vi.fn(),cancel:vi.fn()}));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:1,organizationId:10,roles:['HOST'],permissions:[]}})}));
vi.mock('../hooks/useAssignmentEventStream',()=>({useAssignmentEventStream:vi.fn()}));
vi.mock('../components/ProtectedRoute',()=>({default:({children}:{children:ReactNode})=>children}));
vi.mock('../components/SmartRedirect',()=>({default:()=>null}));
vi.mock('../components/RouteFallback',()=>({default:()=>null}));
vi.mock('./prospection/ProspectionPage',()=>({default:()=> <div data-testid="prospection-page"/>}));
vi.mock('./planning/PlanningPage',()=>({default:()=> <div data-testid="planning-page"/>}));
vi.mock('./planning/hooks/usePlanningData',()=>({prefetchPlanningProperties:startup.prefetch}));
vi.mock('./routePrefetch',()=>({warmHotRoutes:startup.warm}));

beforeEach(()=>{vi.clearAllMocks();startup.warm.mockReturnValue(startup.cancel);});
afterEach(cleanup);
function open(path:string){
 const client=new QueryClient();
 return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><AuthenticatedApp/></QueryClientProvider></MemoryRouter>);
}
it('does not fetch planning properties when opening prospection and cancels its optional warmup on unmount',async()=>{
 const page=open('/prospection?tab=map');await screen.findByTestId('prospection-page');
 expect(startup.prefetch).not.toHaveBeenCalled();expect(startup.warm).toHaveBeenCalledOnce();
 page.unmount();expect(startup.cancel).toHaveBeenCalledOnce();
});
it('preserves planning data prefetch for an actual planning landing',async()=>{
 open('/planning');await screen.findByTestId('planning-page');
 await waitFor(()=>expect(startup.prefetch).toHaveBeenCalledOnce());expect(startup.warm).not.toHaveBeenCalled();
});
