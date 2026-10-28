import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TokenMonitoringPage from '../../modules/admin/TokenMonitoringPage';

afterEach(cleanup);

function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}

it('keeps the historical JWT monitoring URL on the shared workspace', async () => {
  render(<MemoryRouter initialEntries={['/admin/token-monitoring']}>
    <Routes>
      <Route path="/admin/token-monitoring" element={<TokenMonitoringPage />} />
      <Route path="/admin/monitoring" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
  expect(await screen.findByText('/admin/monitoring?tab=tokens')).toBeInTheDocument();
});
