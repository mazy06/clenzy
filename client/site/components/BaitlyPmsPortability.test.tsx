import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  BaitlyPmsHomeSection,
  BaitlyPmsPortability,
  BaitlyPortabilityCommitment,
} from './BaitlyPmsPortability';
import {
  EXIT_CRITERIA,
  PMS_PORTABILITY,
  exitLevel,
} from '../data/pmsPortability';
import { PMS_PORTABILITY_MESSAGES } from '../lib/messages/pmsPortability';
import { HOME_HIGHLIGHT_MESSAGES } from '../lib/messages/homeHighlights';
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
        expect(
          screen.getByText(m.exitLevels[exitLevel(provider.exit)]),
        ).toBeVisible();
        expect(screen.getByText(provider.exitTerms[language])).toBeVisible();
        expect(
          screen.getByText(m.baitlyImportModes[provider.baitlyImport]),
        ).toBeVisible();
        const rows = within(screen.getByRole('table')).getAllByRole('row');
        expect(rows).toHaveLength(EXIT_CRITERIA.length + 1);
        EXIT_CRITERIA.forEach((criterion) =>
          expect(
            screen.getByRole('rowheader', { name: m.criteria[criterion] }),
          ).toBeVisible(),
        );
        if (provider.feedback) {
          expect(
            screen.getByText(provider.feedback[language], { exact: false }),
          ).toBeVisible();
          expect(screen.getByText(m.feedbackNote)).toBeVisible();
        } else {
          expect(screen.queryByText(m.feedbackNote)).not.toBeInTheDocument();
        }
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

  it('derives the exit level from documented criteria only', () => {
    expect(
      exitLevel({
        export: 'yes',
        api: 'yes',
        afterExit: 'yes',
        freeToLeave: 'no',
      }),
    ).toBe('smooth');
    expect(
      exitLevel({
        export: 'partial',
        api: 'yes',
        afterExit: 'no',
        freeToLeave: 'partial',
      }),
    ).toBe('prepare');
    expect(
      exitLevel({
        export: 'partial',
        api: 'yes',
        afterExit: 'unknown',
        freeToLeave: 'no',
      }),
    ).toBe('constrained');
    expect(
      exitLevel({
        export: 'yes',
        api: 'yes',
        afterExit: 'unknown',
        freeToLeave: 'unknown',
      }),
    ).toBe('undocumented');
    for (const provider of PMS_PORTABILITY) {
      if (provider.feedback)
        expect(
          provider.sources.some(
            (s) =>
              s.kind === 'review' ||
              s.kind === 'community' ||
              s.kind === 'exit',
          ),
        ).toBe(true);
    }
    expect(new Set(PMS_PORTABILITY.map((p) => p.id)).size).toBe(
      PMS_PORTABILITY.length,
    );
  });

  it.each(['fr', 'en', 'ar'] as const)(
    'summarises migration on the home page and links to the guide in %s',
    (language) => {
      const m = HOME_HIGHLIGHT_MESSAGES[language].migration;
      render(
        <MemoryRouter>
          <BaitlyPmsHomeSection language={language} />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { name: m.title })).toBeVisible();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByText(m.note)).toBeVisible();
      expect(screen.getByRole('link', { name: m.link })).toHaveAttribute(
        'href',
        `/migration?lang=${language}`,
      );
    },
  );

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
