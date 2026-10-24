import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { BaitlyChatCandidate } from './BaitlyChatCandidate';
import { BaitlyChatAdapter } from './BaitlyChatAdapter';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';

const action = { toolCallId:'synthetic-decision', toolName:'synthetic_tool', description:'Confirmer la recette synthétique',
  expiresAt:'2099-01-01T00:00:00Z', resumable:true };
const base = { version:1, resumePolicy:'durable-decision-v1', conversationId:9, canStart:false, actions:[action] };
function setup(pending = true, tools: Array<{ hint: string; data: unknown }> = []) {
  let proof = { ...base, canStart:!pending, actions:pending ? [action] : [] };
  let id = 0;
  const read = vi.fn(async () => proof);
  const fetch = vi.fn<(url:string,init:RequestInit)=>Promise<Response>>(async (_url, init) => {
    const input = JSON.parse(String(init.body));
    proof = { ...base, actions:[] };
    const frames: unknown[] = [{ type:'RUN_STARTED', threadId:input.threadId, runId:'server-fixture' },
      { type:'TEXT_MESSAGE_START', messageId:'reply-fixture', role:'assistant' },
      { type:'TEXT_MESSAGE_CONTENT', messageId:'reply-fixture', delta:'Réponse de recette ![image](https://example.invalid/private.png)' },
      { type:'TEXT_MESSAGE_END', messageId:'reply-fixture' }];
    tools.forEach((tool,index) => frames.push({ type:'TOOL_CALL_RESULT', toolCallId:`tool-${index}`, messageId:`result-${index}`, role:'tool',
      content:JSON.stringify({ displayHint:tool.hint,isError:false,data:tool.data }) }));
    frames.push({ type:'RUN_FINISHED',threadId:input.threadId,runId:'server-fixture',outcome:{type:'success'} });
    return new Response(frames.map(f=>`data: ${JSON.stringify(f)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
  });
  const adapter = new BaitlyChatAdapter({ conversationId:9,loadRecovery:read,newId:()=>`fixture-${++id}`,
    createClient:()=>new BaitlyAgUiClient({url:'https://backend.invalid/api/agui/run',getHeaders:()=>({}),fetch,maxFrameBytes:4096}) });
  return { adapter, read, fetch };
}
beforeEach(async () => { await i18n.changeLanguage('fr'); });
afterEach(cleanup);

describe('inactive native chat candidate view', () => {
  it.each([true,false])('StrictMode mount only restores, explicit decision confirmed=%s sends once', async confirmed => {
    const { adapter, read, fetch } = setup();
    render(<StrictMode><BaitlyChatCandidate adapter={adapter}/></StrictMode>);
    const button = await screen.findByRole('button',{name:confirmed?'Approuver':'Refuser'});
    await waitFor(()=>expect(button).toBeEnabled());
    expect(read).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.resume).toEqual([{interruptId:action.toolCallId,status:confirmed?'resolved':'cancelled',payload:{confirmed}}]);
    await screen.findByText(/Réponse de recette/);
    expect(document.querySelector('img')).toBeNull(); // No automatic remote image fetch.
  });
  it('retains the real quote and navigation renderers; navigation requires a click', async () => {
    const navigate = vi.fn();
    const {adapter,fetch} = setup(false,[
      {hint:'quote',data:{total:12.34,currency:'EUR',propertyName:'Logement de recette'}},
      {hint:'navigation',data:{path:'/reports',label:'Voir les rapports'}},
    ]);
    render(<BaitlyChatCandidate adapter={adapter} onNavigate={navigate}/>);
    const composer = screen.getByLabelText('Votre message');
    await waitFor(()=>expect(composer).toBeEnabled());
    fireEvent.change(composer,{target:{value:'Question de recette'}});
    fireEvent.click(screen.getByRole('button',{name:'Envoyer'}));
    await screen.findByText(/12,34/);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button',{name:/Voir les rapports/}));
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/reports');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('empty non-authorizing recovery disables sending and reconnect never resubmits', async () => {
    const {adapter,read,fetch} = setup();
    read.mockResolvedValue({...base,actions:[]});
    render(<BaitlyChatCandidate adapter={adapter}/>);
    await screen.findByText(/nécessite une vérification/);
    expect(screen.getByRole('button',{name:'Envoyer'})).toBeDisabled();
    fireEvent(window,new Event('online'));
    fireEvent.click(screen.getByRole('button',{name:'Vérifier l’état'}));
    await waitFor(()=>expect(read).toHaveBeenCalledTimes(2));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('cold multi-agent context is shown but both decisions remain disabled', async () => {
    const {adapter,read,fetch} = setup();
    read.mockResolvedValue({...base,actions:[{...action,resumable:false}]});
    render(<BaitlyChatCandidate adapter={adapter}/>);
    expect(await screen.findByRole('button',{name:'Approuver'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Refuser'})).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('server-provided descriptions render as text, not HTML', async () => {
    const {adapter,read} = setup();
    const text = '<script>syntheticPrivate()</script>';
    read.mockResolvedValue({...base,actions:[{...action,description:text}]});
    render(<BaitlyChatCandidate adapter={adapter}/>);
    await screen.findByText(text);
    expect(document.querySelector('script')).toBeNull();
  });
});
