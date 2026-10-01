import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AcademyTranscript from './AcademyTranscript';
import { ACADEMY_TRANSCRIPTS } from '../../data/baitlyAcademyTranscripts';

describe('Academy transcript', () => {
  it('lets readers expand the complete transcript with its actual language on an Arabic page', () => {
    const { container } = render(
      <AcademyTranscript slug="01-kpi" language="ar" />,
    );
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText('نص الحلقة'));
    expect(details.open).toBe(true);
    const body = details.querySelector('div')!;
    expect(body.lang).toBe('fr');
    expect(body.dir).toBe('ltr');
    expect(body.textContent).toBe(
      ACADEMY_TRANSCRIPTS['01-kpi'].fr.replace(/\n\s*\n/g, ''),
    );
  });
  it('does not invent a transcript for an unpublished episode', () => {
    const { container } = render(
      <AcademyTranscript slug="unknown" language="fr" />,
    );
    expect(container.querySelector('details')).toBeNull();
  });
});
