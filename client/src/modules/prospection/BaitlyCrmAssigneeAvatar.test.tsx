import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyCrmAssigneeAvatar from './BaitlyCrmAssigneeAvatar';
import type { BaitlyCrmDetails } from '../../services/api/baitlyCrmDetailsApi';

const details:BaitlyCrmDetails={prospect_id:1,assigned_user_id:301,assigned_user_name:'Admin User',assigned_user_avatar_url:'https://media.example.com/avatar.jpg',qualification:'TO_QUALIFY',score:0};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('uses the photo first and restores the initials when loading fails',async()=>{
  let image!: EventTarget & { complete:boolean; naturalWidth:number };
  vi.stubGlobal('Image',class extends EventTarget { complete=false; naturalWidth=0; constructor(){super();image=this;} set src(_value:string){} });
  const {container}=render(<BaitlyCrmAssigneeAvatar details={details}/>);
  await waitFor(()=>expect(image!).toBeDefined());
  act(()=>{image.complete=true;image.naturalWidth=64;image.dispatchEvent(new Event('load'));});
  await waitFor(()=>expect(container.querySelector('img')).toHaveAttribute('src',details.assigned_user_avatar_url));
  expect(screen.queryByText('AU')).not.toBeInTheDocument();
  act(()=>image.dispatchEvent(new Event('error')));
  expect(await screen.findByText('AU')).toBeInTheDocument();
});

it('keeps the initials without a photo and hides unavailable members',()=>{
  const {rerender,container}=render(<BaitlyCrmAssigneeAvatar details={{...details,assigned_user_avatar_url:null}}/>);
  expect(screen.getByText('AU')).toBeInTheDocument();
  rerender(<BaitlyCrmAssigneeAvatar details={{...details,assignee_unavailable:true}}/>);
  expect(screen.queryByText('AU')).not.toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('svg')).not.toBeNull();
});
