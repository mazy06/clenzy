import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import DeviceDetail from './DeviceDetail';
import PropertyDevicesView from './PropertyDevicesView';

afterEach(cleanup);
function Destination() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
describe('legacy connected-object links', () => {
  it.each([
    ['/connected-objects/device/camera/7', '/connected-objects?device=camera%3A7'],
    ['/connected-objects/device/lock/12', '/connected-objects?device=lock%3A12'],
    ['/connected-objects/device/invalid/12', '/connected-objects'],
    ['/connected-objects/property/42', '/connected-objects?property=42'],
  ])('opens the unified workspace from %s', (url, destination) => {
    render(<MemoryRouter initialEntries={[url]}><Routes>
      <Route path="/connected-objects/device/:kind/:id" element={<DeviceDetail />} />
      <Route path="/connected-objects/property/:id" element={<PropertyDevicesView />} />
      <Route path="/connected-objects" element={<Destination />} />
    </Routes></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent(destination);
  });
});
