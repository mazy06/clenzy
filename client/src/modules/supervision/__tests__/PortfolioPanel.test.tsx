// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PortfolioPanel } from '../components/PortfolioPanel';
import { MockPortfolioProvider } from '../provider/MockSupervisionProvider';

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

describe('<PortfolioPanel>', () => {
  it('rend la constellation, la file multi-logements et le journal', async () => {
    const provider = new MockPortfolioProvider({ latencyMs: 0 });
    const { container } = render(<PortfolioPanel createProvider={() => provider} deps={['portfolio']} />);
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
    expect(container.querySelectorAll('[data-pending-action]')).toHaveLength(3);
    expect(screen.getAllByText(/Duplex Marais/).length).toBeGreaterThan(0); // chaque carte taguée du logement
    expect(container.querySelector('[data-activity-feed]')).toBeTruthy();
  });

  it('clic satellite → drawer ventilation par logement', async () => {
    const provider = new MockPortfolioProvider({ latencyMs: 0 });
    const { container } = render(<PortfolioPanel createProvider={() => provider} deps={['portfolio']} />);
    await waitFor(() => expect(container.querySelector('[data-agent="com"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-agent="com"]')!);
    await waitFor(() => expect(screen.getByText('Détail par logement')).toBeTruthy());
  });
});
