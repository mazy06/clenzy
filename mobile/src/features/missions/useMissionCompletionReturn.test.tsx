import React from 'react';
import type { MobileMission } from './api';
import { useMissionCompletionReturn } from './useMissionCompletionReturn';
const renderer=require('react-test-renderer');const {act}=renderer;
const receipt:MobileMission={id:1,title:'Ménage',type:'CLEANING',status:'AWAITING_VALIDATION'};
function Harness({value,busy,onHome}:{value?:MobileMission;busy:boolean;onHome:()=>void}){useMissionCompletionReturn(value,busy,onHome);return null;}
let tree:any;
beforeEach(()=>jest.useFakeTimers());
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());jest.useRealTimers();tree=undefined;});
it('does not leave on an unconfirmed or busy submission, then returns after the receipt',async()=>{
  const home=jest.fn();await act(async()=>{tree=renderer.create(<Harness busy={false} onHome={home}/>);});
  await act(async()=>jest.advanceTimersByTime(5000));expect(home).not.toHaveBeenCalled();
  await act(async()=>tree.update(<Harness value={receipt} busy onHome={home}/>));
  await act(async()=>jest.advanceTimersByTime(5000));expect(home).not.toHaveBeenCalled();
  await act(async()=>tree.update(<Harness value={receipt} busy={false} onHome={home}/>));
  await act(async()=>jest.advanceTimersByTime(1800));expect(home).toHaveBeenCalledTimes(1);
});
it('cancels the delayed navigation if the screen is closed first',async()=>{
  const home=jest.fn();await act(async()=>{tree=renderer.create(<Harness value={receipt} busy={false} onHome={home}/>);});
  await act(async()=>tree.unmount());tree=undefined;
  await act(async()=>jest.advanceTimersByTime(5000));expect(home).not.toHaveBeenCalled();
});
