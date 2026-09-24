import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BaitlyMigrationSources } from './BaitlyMigrationVisuals';
import { BAITLY_MIGRATION_MESSAGES } from '../lib/messages/baitlyMigration';

afterEach(cleanup);

describe('Exploration des méthodes de migration', () => {
  it.each(['fr', 'en', 'ar'] as const)(
    'actualise les instructions et la correspondance pour chaque source en %s',
    (language) => {
      const m = BAITLY_MIGRATION_MESSAGES[language];
      render(<BaitlyMigrationSources m={m} />);
      for (const source of m.channels) {
        const button = screen.getByRole('button', {
          name: source.name,
          exact: true,
        });
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(
          1,
        );
        const panel = screen.getByRole('region', {
          name: source.name,
        });
        expect(
          within(panel).getByRole('heading', { name: source.title }),
        ).toBeVisible();
        expect(within(panel).getByText(source.file)).toBeVisible();
        expect(within(panel).getByText(source.copy)).toBeVisible();
        for (const column of source.columns)
          expect(
            within(panel).getByText(column, { selector: 'bdi' }),
          ).toBeVisible();
      }
      expect(screen.getByText(m.sourceNote)).toBeVisible();
    },
  );
});
