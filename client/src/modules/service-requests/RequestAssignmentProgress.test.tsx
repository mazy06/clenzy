import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequestAssignmentProgress, { type AssignmentProgress } from './RequestAssignmentProgress';

const invalidate=vi.hoisted(()=>vi.fn());
vi.mock('../../hooks/invalidateMissionWorkflow',()=>({invalidateMissionWorkflow:invalidate}));
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr',
  t:(key:string,options?:{count:number})=>key+(options?.count!=null?' '+options.count:'')})}));
function show(props:AssignmentProgress) {
  render(<QueryClientProvider client={new QueryClient()}><RequestAssignmentProgress {...props}/></QueryClientProvider>);
}
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
it('shows the real deadline for a manager without exposing recipient actions',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
  show({assignmentPhase:'PROPOSED',assignmentExpiresAt:'2026-09-16T10:37:00Z'});
  expect(screen.getByText('requestCommercial.expires 37')).toBeInTheDocument();
  act(()=>vi.advanceTimersByTime(60_000));
  expect(screen.getByText('requestCommercial.expires 36')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  act(()=>vi.advanceTimersByTime(36*60_000));
  expect(screen.getByText('assignmentProgress.reassigning')).toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledTimes(1);
});
it.each([
  [{assignmentPhase:'PUBLIC'},'public'],
  [{assignmentPhase:'INTERNAL',autoAssignStatus:'waiting_contact'},'contact'],
  [{assignmentPhase:'MANUAL',autoAssignStatus:'automation_disabled'},'automation_disabled'],
  [{assignmentPhase:'MANUAL',autoAssignStatus:'needs_qualification'},'needs_qualification'],
] as const)('explains a need without inventing a countdown (%j)',(props,key)=>{
  show(props);
  expect(screen.getByRole('status')).toHaveTextContent('assignmentProgress.'+key);
  expect(screen.queryByText(/requestCommercial.expires/)).not.toBeInTheDocument();
});
