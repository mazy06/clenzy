// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SupervisionDemo } from '../components/SupervisionDemo';
import { MOCK_RESERVATION_FAMILLE_ROUX, MOCK_RESERVATION_LEA_MARCHAND } from '../provider/mockData';

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

describe('<SupervisionDemo>', () => {
  it('rend le bandeau planning avec des cellules ciblables par la comète', () => {
    const { container } = render(<SupervisionDemo />);
    expect(container.querySelector(`[data-reservation-id="${MOCK_RESERVATION_FAMILLE_ROUX}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-reservation-id="${MOCK_RESERVATION_LEA_MARCHAND}"]`)).toBeTruthy();
  });
});
