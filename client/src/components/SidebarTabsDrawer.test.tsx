import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SidebarProvider } from './ui';
import { SidebarTabsFlyoutRow, SidebarTabsSubRow } from './SidebarTabsDrawer';
import type { ResolvedScreenTab } from '../hooks/useScreenTabs';

afterEach(cleanup);

const tabs: ResolvedScreenTab[] = [
  { key: 'calendar', label: 'Calendrier des prix', hidden: false },
  { key: 'strategy', label: 'Stratégie tarifaire', hidden: false },
];

it.each([SidebarTabsFlyoutRow, SidebarTabsSubRow])('opens the list and enters the first visible tab while preserving subsequent selection (%#)', async Row => {
  const enter = vi.fn();
  const select = vi.fn();
  render(<SidebarProvider><ul><Row screenLabel="Prix dynamiques" tabs={tabs} activeKey="strategy"
    side="right" isActive onEnter={enter} onSelect={select}>Prix dynamiques</Row></ul></SidebarProvider>);

  const trigger = screen.getByRole('button', { name: 'Prix dynamiques' });
  fireEvent.click(trigger);
  expect(enter).toHaveBeenCalledExactlyOnceWith('calendar');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Stratégie tarifaire' }));
  expect(select).toHaveBeenCalledExactlyOnceWith('strategy');
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));

  fireEvent.click(trigger);
  expect(enter).toHaveBeenCalledTimes(2);
  fireEvent.click(trigger);
  expect(enter).toHaveBeenCalledTimes(2);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('uses the first permitted tab and keeps keyboard browsing from navigating implicitly', () => {
  const enter = vi.fn();
  render(<SidebarProvider><ul><SidebarTabsFlyoutRow screenLabel="Facturation" tabs={[tabs[1]]}
    side="left" isActive={false} onEnter={enter} onSelect={vi.fn()}>Facturation</SidebarTabsFlyoutRow></ul></SidebarProvider>);
  const trigger = screen.getByRole('button', { name: 'Facturation' });
  fireEvent.keyDown(trigger, { key: 'ArrowLeft' });
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(enter).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(enter).toHaveBeenCalledExactlyOnceWith('strategy');
});
