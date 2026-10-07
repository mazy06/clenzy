import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PropertyFormSectionNav from '../PropertyFormSectionNav';

afterEach(cleanup);

describe('Sommaire du formulaire de logement', () => {
  it('whenASectionIsChosen_thenThePageScrollsToItAndMarksItAsCurrent', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <>
        <PropertyFormSectionNav
          label="Sections"
          sections={[
            { id: 'pf-identity', art: '/a.webp', title: 'Identité' },
            { id: 'pf-cleaning', art: '/b.webp', title: 'Ménage' },
          ]}
        />
        <section id="pf-identity" />
        <section id="pf-cleaning" />
      </>,
    );

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(screen.getByRole('button', { name: 'Identité' })).toHaveAttribute('aria-current', 'location');

    fireEvent.click(screen.getByRole('button', { name: 'Ménage' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ménage' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('button', { name: 'Identité' })).not.toHaveAttribute('aria-current');
    expect(nav).toBeVisible();
  });

  it('whenASectionIsChosen_thenItsButtonNeverSubmitsTheSurroundingForm', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <form onSubmit={submit}>
        <PropertyFormSectionNav label="Sections" sections={[{ id: 'pf-a', art: '/a.webp', title: 'Adresse' }]} />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Adresse' }));
    expect(submit).not.toHaveBeenCalled();
  });
});
