import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import i18n from '../../../../i18n/config';
import SupervisionAgUiSpike from '../SupervisionAgUiSpike';
import { BaitlyChatCandidate } from './BaitlyChatCandidate';
import { BaitlyChatAdapter } from './BaitlyChatAdapter';
import { DISPLAY_HINT_RENDERERS } from '../renderers';
import { emptyChat,reduceBaitlyChat } from './BaitlyChatModel';

const scope=vi.hoisted(()=>({allowed:true,id:'synthetic-user',org:7,token:'synthetic-before',refresh:vi.fn(),list:vi.fn()}));
vi.mock('../../../../hooks/useAuth',()=>({useAuth:()=>({user:{id:scope.id,organizationId:scope.org},hasAnyRole:()=>scope.allowed})}));
vi.mock('../../../../keycloak',()=>({default:{updateToken:scope.refresh},getAccessToken:()=>scope.token}));
vi.mock('../../../../config/api',()=>({buildApiUrl:(path:string)=>`https://backend.invalid/api${path}`}));
vi.mock('../../../../services/api/assistantApi',()=>({assistantApi:{listConversations:scope.list}}));
beforeEach(async()=>{scope.allowed=true;scope.org=7;scope.id='synthetic-user';scope.token='synthetic-before';scope.refresh.mockReset();scope.list.mockReset();scope.list.mockResolvedValue({content:[]});
  scope.refresh.mockImplementation(async()=>{scope.token='synthetic-after-refresh';});await i18n.changeLanguage('fr');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('native Baitly route and authorized protocol, no SDK',()=>{
  it('organization changes immediately hide previous conversation titles, before the next request completes',async()=>{
    scope.list.mockResolvedValue({content:[{id:1,title:'Synthetic organization seven',createdAt:'',updatedAt:'',model:null}]});
    const view=render(<MemoryRouter><SupervisionAgUiSpike/></MemoryRouter>);
    await screen.findByRole('option',{name:'Synthetic organization seven'});
    scope.org=8;scope.list.mockReturnValue(new Promise(()=>{}));
    view.rerender(<MemoryRouter><SupervisionAgUiSpike/></MemoryRouter>);
    expect(screen.queryByRole('option',{name:'Synthetic organization seven'})).toBeNull();
  });
  it('mount only reads; explicit send discovers and refreshes auth, creates one conversation and checks durable completion',async()=>{
    let requestId='';
    const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
      if(url.endsWith('/agui/info')) return Response.json({agents:[{name:'clenzy-supervisor'}]});
      if(url.includes('/agui/recovery')) return Response.json({version:1,resumePolicy:'durable-decision-v1',conversationId:9,canStart:true,actions:[],
        history:[{id:'history-1',role:'user',content:'Synthetic question',toolCallId:null,hasAttachments:false},
          {id:'history-2',role:'assistant',content:'Synthetic answer',toolCallId:null,hasAttachments:false}],
        completion:{policy:'durable-writes-v3',status:'SAFE_WRITES',lastMessageId:'history-2',requestId}});
      const body=JSON.parse(String(init?.body));requestId=body.runId;
      expect(body.forwardedProps).toEqual({conversationId:null,completionPolicy:'durable-writes-v3'});
      expect(init?.headers).toMatchObject({Authorization:'Bearer synthetic-after-refresh'});
      const frames=[{type:'RUN_STARTED',threadId:body.threadId,runId:'synthetic-server'},
        {type:'STATE_SNAPSHOT',snapshot:{conversationId:9}},{type:'TEXT_MESSAGE_START',messageId:'answer',role:'assistant'},
        {type:'TEXT_MESSAGE_CONTENT',messageId:'answer',delta:'Synthetic answer'},{type:'TEXT_MESSAGE_END',messageId:'answer'},
        {type:'RUN_FINISHED',threadId:body.threadId,runId:'synthetic-server',outcome:{type:'success'}}];
      return new Response(frames.map(f=>`data: ${JSON.stringify(f)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
    });
    vi.stubGlobal('fetch',fetch);
    render(<StrictMode><MemoryRouter><SupervisionAgUiSpike/></MemoryRouter></StrictMode>);
    const message=screen.getByLabelText('Votre message');await waitFor(()=>expect(message).toBeEnabled());
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(message,{target:{value:'Synthetic question'}});fireEvent.click(screen.getByRole('button',{name:'Envoyer'}));
    await screen.findByText('Synthetic answer');await waitFor(()=>expect(message).toBeEnabled());
    expect(fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
    expect(fetch.mock.calls.some(([url])=>url.includes('conversationId=9'))).toBe(true);
    await waitFor(()=>expect(screen.getByRole('combobox')).toHaveValue('9'));
    fireEvent(window,new Event('online'));expect(fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  });
  it('denied discovery does not post, reveal the body or execute anything',async()=>{
    const denied=new Response('synthetic-private-token',{status:403});const text=vi.spyOn(denied,'text');
    const fetch=vi.fn(async()=>denied);vi.stubGlobal('fetch',fetch);
    render(<MemoryRouter><SupervisionAgUiSpike/></MemoryRouter>);
    const message=screen.getByLabelText('Votre message');await waitFor(()=>expect(message).toBeEnabled());
    fireEvent.change(message,{target:{value:'Synthetic question'}});fireEvent.click(screen.getByRole('button',{name:'Envoyer'}));
    await screen.findByText(/nécessite une vérification/);
    expect(fetch).toHaveBeenCalledTimes(1);expect(text).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain('synthetic-private');
  });
  it('non-operator role cannot mount an executable conversation',()=>{
    scope.allowed=false;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    render(<MemoryRouter><SupervisionAgUiSpike/></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Accès réservé');expect(screen.queryByRole('button',{name:'Envoyer'})).toBeNull();expect(fetch).not.toHaveBeenCalled();
  });
  it('restored authorized presentations reach all nine real renderers with zero HTTP or execution',async()=>{
    const hints=Object.keys(DISPLAY_HINT_RENDERERS);
    const spies=hints.map(hint=>vi.spyOn(DISPLAY_HINT_RENDERERS,hint));
    const createClient=vi.fn();
    const adapter=new BaitlyChatAdapter({conversationId:9,createClient,loadRecovery:async()=>({version:1,resumePolicy:'durable-decision-v1',conversationId:9,canStart:false,actions:[],
      history:hints.map((hint,index)=>({id:`history-${index}`,role:'tool',content:null,toolCallId:`call-${index}`,hasAttachments:false,
        presentation:JSON.stringify({displayHint:hint,isError:false,data:{fixture:true}})}))})});
    render(<BaitlyChatCandidate adapter={adapter}/>);
    await waitFor(()=>spies.forEach(spy=>expect(spy).toHaveBeenCalled()));expect(createClient).not.toHaveBeenCalled();
  });
  it('a resumed START attaches the result to the pending tool once, without duplicating or reopening a completed effect',()=>{
    const start={type:'TOOL_CALL_START' as const,toolCallId:'pending-call',toolCallName:'synthetic_action'};
    let model=reduceBaitlyChat(emptyChat(),start);
    model=reduceBaitlyChat(model,{type:'TOOL_CALL_END',toolCallId:'pending-call'});
    model=reduceBaitlyChat(model,start); // Fresh, explicitly resumed run.
    model=reduceBaitlyChat(model,{type:'TOOL_CALL_RESULT',toolCallId:'pending-call',messageId:'result',role:'tool',content:'{}'});
    expect(model.items).toHaveLength(1);expect(model.items[0].complete).toBe(true);
    expect(model.messages.flatMap(m=>m.toolCalls ?? [])).toHaveLength(1);
    expect(()=>reduceBaitlyChat(model,start)).toThrow();
  });
});
