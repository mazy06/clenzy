import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ServiceProposalsRedirect from './ServiceProposalsRedirect';

afterEach(cleanup);
function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}
it.each([
  ['', '/interventions?tab=service-requests&scope=inbox'],
  ['?tab=public', '/interventions?tab=service-requests&scope=public'],
  ['?tab=contacts', '/account?tab=solicitation'],
  ['?tab=policy', '/settings?tab=general'],
])('preserves the destination of legacy links %s', async (query, destination) => {
  render(<MemoryRouter initialEntries={['/service-proposals' + query]}>
    <Routes>
      <Route path="/service-proposals" element={<ServiceProposalsRedirect />} />
      <Route path="*" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
  expect(await screen.findByText(destination)).toBeInTheDocument();
});
