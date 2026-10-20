import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Home } from '../icons/glyphs';
import PageTabs from './PageTabs';

vi.mock('./ScreenChrome', () => ({
  useScreenChrome: () => ({ tabsSlot: null }),
  useScreenTrailSegment: () => {},
}));
afterEach(cleanup);

it('keeps tab colors stable when permissions hide another tab', () => {
  const options = [
    { value: 'home', label: 'Accueil', icon: <Home /> },
    { value: 'team', label: 'Équipe' },
    { value: 'billing', label: 'Facturation' },
  ];
  const { rerender } = render(<PageTabs options={options} value="billing" onChange={() => {}} trail={false} />);
  const color = screen.getByRole('tab', { name: 'Facturation' }).style.color;
  expect(new Set(screen.getAllByRole('tab').map(tab => tab.style.color)).size).toBe(3);
  rerender(<PageTabs options={options.map(opt => ({ ...opt, hidden: opt.value === 'team' }))} value="billing" onChange={() => {}} trail={false} />);
  expect(screen.getByRole('tab', { name: 'Facturation' }).style.color).toBe(color);
  expect(screen.getByRole('tab', { name: 'Facturation' })).toHaveAttribute('data-state', 'active');
});

it('preserves explicit colors, badges and disabled navigation', () => {
  const onChange = vi.fn();
  render(<PageTabs options={[
    { value: 'home', label: 'Accueil', color: '#7851b5', badge: 2 },
    { value: 'team', label: 'Équipe', disabled: true },
  ]} value="home" onChange={onChange} trail={false} />);
  expect(screen.getByRole('tab', { name: /Accueil/ }).style.color).toBe('rgb(120, 81, 181)');
  expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Équipe' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('tab', { name: 'Équipe' })).toBeDisabled();
});
