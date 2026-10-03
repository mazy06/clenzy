import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  BaitlyPmsPortability,
  BaitlyPortabilityCommitment,
} from './BaitlyPmsPortability';
import { PMS_PORTABILITY } from '../data/pmsPortability';
import { PMS_PORTABILITY_MESSAGES } from '../lib/messages/pmsPortability';
import { downloadText } from '../lib/downloadText';

vi.mock('../lib/downloadText', () => ({ downloadText: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PMS portability evidence', () => {
  it.each(['fr', 'en', 'ar'] as const)(
    'shows scoped evidence, source links and unknown fallback in %s',
    (language) => {
      const m = PMS_PORTABILITY_MESSAGES[language];
      render(<BaitlyPmsPortability language={language} />);
      const select = screen.getByRole('combobox', { name: m.label });
      expect(screen.getByRole('heading', { name: m.emptyTitle })).toBeVisible();
      for (const provider of PMS_PORTABILITY) {
        fireEvent.change(select, { target: { value: provider.id } });
        expect(
          screen.getByRole('heading', { name: provider.name }),
        ).toBeVisible();
        expect(screen.getByText(provider.caution[language])).toBeVisible();
        expect(screen.getByText(provider.timing[language])).toBeVisible();
        const links = within(screen.getByRole('navigation')).getAllByRole(
          'link',
        );
        expect(links.map((link) => link.getAttribute('href'))).toEqual(
          provider.sources.map((source) => source.url),
        );
        links.forEach((link) =>
          expect(link.getAttribute('href')).toMatch(/^https:\/\//),
        );
      }
      fireEvent.change(select, { target: { value: 'other' } });
      expect(
        screen.getByRole('heading', { name: m.unknownTitle }),
      ).toBeVisible();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.getByText(m.methodology, { exact: false })).toBeVisible();
    },
  );

  it('keeps the selected PMS when switching language and exports its limitations and sources', () => {
    const { rerender } = render(<BaitlyPmsPortability language="fr" />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'superhote' },
    });
    rerender(<BaitlyPmsPortability language="ar" />);
    expect(screen.getByRole('combobox')).toHaveValue('superhote');
    fireEvent.click(
      screen.getByRole('button', {
        name: PMS_PORTABILITY_MESSAGES.ar.download,
      }),
    );
    expect(downloadText).toHaveBeenCalledWith(
      'baitly-migration-superhote-ar.txt',
      expect.stringContaining(PMS_PORTABILITY[0].caution.ar),
    );
    const text = vi.mocked(downloadText).mock.calls[0][1];
    expect(text).toContain(PMS_PORTABILITY[0].sources[0].url);
    expect(text).toContain(PMS_PORTABILITY_MESSAGES.ar.methodology);
  });

  it.each(['fr', 'en', 'ar'] as const)(
    'labels full export as a pre-launch commitment in %s',
    (language) => {
      render(<BaitlyPortabilityCommitment language={language} />);
      expect(
        screen.getByText(PMS_PORTABILITY_MESSAGES[language].promiseStatus),
      ).toBeVisible();
    },
  );
});
