// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ThreadEmptyState from './ThreadEmptyState';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : `${key}:${JSON.stringify(fallback ?? {})}`,
  }),
}));

afterEach(cleanup);

describe('ThreadEmptyState', () => {
  it('invite à choisir une conversation et résume la boîte', () => {
    render(<ThreadEmptyState total={12} unread={3} />);
    expect(screen.getByRole('heading', { name: 'Sélectionnez une conversation' })).toBeTruthy();
    expect(screen.getByText('messagingHub.conversationCount:{"count":12}')).toBeTruthy();
    expect(screen.getByText('messagingHub.unreadCount:{"count":3}')).toBeTruthy();
  });

  it('ne souligne les non-lus que s’il y en a', () => {
    const { container, rerender } = render(<ThreadEmptyState total={4} unread={0} />);
    expect(container.querySelector('[data-tone="alert"]')).toBeNull();
    rerender(<ThreadEmptyState total={4} unread={2} />);
    expect(container.querySelector('[data-tone="alert"]')).not.toBeNull();
  });
});
