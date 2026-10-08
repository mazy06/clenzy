import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnimatedOwnerMockup from './AnimatedOwnerMockup';
import { SiteLanguageProvider } from '../lib/siteLanguage';

const visibility = vi.hoisted(() => ({ active: true, reduced: false }));
vi.mock('./useBaitlyDemoVisibility', async () => {
  const { useRef } = await import('react');
  return { useBaitlyDemoVisibility: () => ({ ...visibility, visibilityRef: useRef(null) }) };
});
beforeEach(() => { vi.useFakeTimers(); visibility.active = true; visibility.reduced = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const preview = () => <SiteLanguageProvider initialLanguage="fr"><AnimatedOwnerMockup /></SiteLanguageProvider>;

describe('Owner preview interaction and motion', () => {
  it('plays the same statement controls and pauses for manual input', () => {
    const { rerender } = render(preview());
    advance(3100);
    expect(screen.getByRole('button', { name: 'Juillet' })).toHaveAttribute('aria-pressed', 'true');
    const august = screen.getByRole('button', { name: 'Août' });
    fireEvent.pointerDown(august);
    fireEvent.click(august);
    advance(20000);
    expect(august).toHaveAttribute('aria-pressed', 'true');
    visibility.active = false;
    rerender(preview());
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeVisible();
  });
  it('keeps a complete interactive statement with reduced motion', () => {
    visibility.active = false; visibility.reduced = true;
    render(preview());
    advance(20000);
    expect(screen.getByRole('button', { name: 'Septembre' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Juillet' }));
    expect(screen.getByRole('button', { name: 'Juillet' })).toHaveAttribute('aria-pressed', 'true');
  });
});
